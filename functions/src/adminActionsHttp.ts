import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { randomBytes } from "crypto";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const REGION = "us-central1";
const DEFAULT_ADMIN_EMAILS = [
  "maia@h2hardwareltd.com",
  "admin@starpro.com",
  "admin@h2hardware.com",
];

function configuredAdminEmails() {
  const envEmails = [
    process.env.ADMIN_EMAILS || "",
    process.env.NEXT_PUBLIC_ADMIN_EMAILS || "",
  ]
    .join(",")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set(
    [...DEFAULT_ADMIN_EMAILS, ...envEmails].map((email) =>
      email.trim().toLowerCase()
    )
  );
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function temporaryPassword() {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

function errorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code || "");
  }

  return "";
}

function getStatus(error: unknown) {
  const code = errorCode(error);

  if (code === "functions/unauthenticated" || code === "unauthenticated") return 401;
  if (code === "functions/permission-denied" || code === "permission-denied") return 403;
  if (code === "functions/not-found" || code === "not-found") return 404;
  if (code === "functions/invalid-argument" || code === "invalid-argument") return 400;
  if (code === "functions/failed-precondition" || code === "failed-precondition") return 412;

  return 500;
}

function getMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }

  return "Action failed.";
}

async function assertAdminFromRequest(req: any) {
  const rawHeader = String(req.get("authorization") || "").trim();
  const match = rawHeader.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw new HttpsError("unauthenticated", "Admin login is required.");
  }

  const decoded = await getAuth().verifyIdToken(match[1]);
  const adminEmail = String(decoded.email || "").trim().toLowerCase();

  if (!decoded.uid || !adminEmail) {
    throw new HttpsError("unauthenticated", "Admin login is required.");
  }

  if (!configuredAdminEmails().has(adminEmail)) {
    throw new HttpsError("permission-denied", "Only admins can perform this action.");
  }

  return {
    uid: decoded.uid,
    email: adminEmail,
  };
}

function getRequestId(req: any) {
  return cleanText(req.body?.requestId || req.body?.data?.requestId);
}

function assertPost(req: any) {
  if (req.method !== "POST") {
    throw new HttpsError("invalid-argument", "Only POST is supported.");
  }
}

async function approveRegistrationRequestCore(requestId: string, admin: { uid: string; email: string }) {
  if (!requestId) {
    throw new HttpsError("invalid-argument", "requestId is required.");
  }

  const requestRef = db.collection("registration_requests").doc(requestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    throw new HttpsError("not-found", "Registration request not found.");
  }

  const registration = requestSnap.data() || {};
  const email = normalizeEmail(registration.email);
  const name = cleanText(registration.name);
  const company = cleanText(registration.company);
  const shippingAddress = cleanText(registration.shippingAddress || registration.deliveryAddress);
  const displayName = name || company || email;

  if (!email || !email.includes("@")) {
    throw new HttpsError(
      "failed-precondition",
      "Registration request has no valid email."
    );
  }

  let created = false;
  let userRecord;

  try {
    userRecord = await getAuth().getUserByEmail(email);
    userRecord = await getAuth().updateUser(userRecord.uid, {
      displayName,
      disabled: false,
    });
  } catch (error) {
    if (errorCode(error) !== "auth/user-not-found") {
      logger.error("Failed to check registration user", { requestId, email, error });
      throw new HttpsError("internal", "Failed to check Firebase user.");
    }

    userRecord = await getAuth().createUser({
      email,
      displayName,
      password: temporaryPassword(),
      emailVerified: false,
      disabled: false,
    });
    created = true;
  }

  const customerRef = db.collection("customers").doc(userRecord.uid);
  const customerSnap = await customerRef.get();

  await customerRef.set(
    {
      name,
      company,
      email,
      shippingAddress,
      disabled: false,
      updatedAt: FieldValue.serverTimestamp(),
      ...(customerSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );

  await requestRef.set(
    {
      status: "approved",
      authUid: userRecord.uid,
      approvedAt: FieldValue.serverTimestamp(),
      approvedByUid: admin.uid,
      approvedByEmail: admin.email,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info("Registration request approved", {
    requestId,
    email,
    uid: userRecord.uid,
    created,
    approvedBy: admin.email,
  });

  return {
    ok: true,
    created,
    uid: userRecord.uid,
    email,
  };
}

async function disableRegistrationUserCore(requestId: string, admin: { uid: string; email: string }) {
  if (!requestId) {
    throw new HttpsError("invalid-argument", "requestId is required.");
  }

  const requestRef = db.collection("registration_requests").doc(requestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    throw new HttpsError("not-found", "Registration request not found.");
  }

  const registration = requestSnap.data() || {};
  const email = normalizeEmail(registration.email);
  let uid = cleanText(registration.authUid);

  if (!uid && email) {
    try {
      const userByEmail = await getAuth().getUserByEmail(email);
      uid = userByEmail.uid;
    } catch (error) {
      if (errorCode(error) === "auth/user-not-found") {
        throw new HttpsError("not-found", "Firebase user not found for this request.");
      }

      logger.error("Failed to find user by email", { requestId, email, error });
      throw new HttpsError("internal", "Failed to find Firebase user.");
    }
  }

  if (!uid) {
    throw new HttpsError("failed-precondition", "Request has no Firebase user UID.");
  }

  await getAuth().updateUser(uid, {
    disabled: true,
  });

  await db.collection("customers").doc(uid).set(
    {
      disabled: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await requestRef.set(
    {
      status: "disabled",
      authUid: uid,
      disabledAt: FieldValue.serverTimestamp(),
      disabledByUid: admin.uid,
      disabledByEmail: admin.email,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info("Registration user disabled", {
    requestId,
    email,
    uid,
    disabledBy: admin.email,
  });

  return {
    ok: true,
    uid,
    email,
  };
}

export const approveRegistrationRequestHttp = onRequest(
  {
    region: REGION,
    cors: false,
  },
  async (req, res) => {
    try {
      assertPost(req);
      const admin = await assertAdminFromRequest(req);
      const result = await approveRegistrationRequestCore(getRequestId(req), admin);
      res.status(200).json(result);
    } catch (error) {
      logger.error("approveRegistrationRequestHttp failed", { error });
      res.status(getStatus(error)).json({ error: getMessage(error) });
    }
  }
);

export const disableRegistrationUserHttp = onRequest(
  {
    region: REGION,
    cors: false,
  },
  async (req, res) => {
    try {
      assertPost(req);
      const admin = await assertAdminFromRequest(req);
      const result = await disableRegistrationUserCore(getRequestId(req), admin);
      res.status(200).json(result);
    } catch (error) {
      logger.error("disableRegistrationUserHttp failed", { error });
      res.status(getStatus(error)).json({ error: getMessage(error) });
    }
  }
);
