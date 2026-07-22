import { randomBytes } from "crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  accessCodeHash,
  accessCodePreview,
  isValidAccessCode,
  normalizeAccessCode,
} from "./registrationCodesCore";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const REGION = "us-central1";
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_ADMIN_EMAILS = [
  "maia@h2hardwareltd.com",
  "admin@starpro.com",
  "admin@h2hardware.com",
  "admin@h2hardwareltd.com",
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
  return cleanText(value).toLowerCase();
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
  if (code.includes("unauthenticated")) return 401;
  if (code.includes("permission-denied")) return 403;
  if (code.includes("not-found")) return 404;
  if (code.includes("already-exists")) return 409;
  if (code.includes("resource-exhausted")) return 429;
  if (code.includes("invalid-argument")) return 400;
  if (code.includes("failed-precondition")) return 412;
  return 500;
}

function getMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = cleanText((error as { message?: unknown }).message);
    if (message) return message;
  }
  return "Action failed.";
}

function assertPost(req: any) {
  if (req.method !== "POST") {
    throw new HttpsError("invalid-argument", "Only POST is supported.");
  }
}

async function assertAdminFromRequest(req: any) {
  const rawHeader = cleanText(req.get("authorization"));
  const match = rawHeader.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw new HttpsError("unauthenticated", "Admin login is required.");
  }

  const decoded = await getAuth().verifyIdToken(match[1]);
  const email = normalizeEmail(decoded.email);

  if (!decoded.uid || !email) {
    throw new HttpsError("unauthenticated", "Admin login is required.");
  }

  if (decoded.admin !== true && !configuredAdminEmails().has(email)) {
    throw new HttpsError("permission-denied", "Only admins can manage access codes.");
  }

  return { uid: decoded.uid, email };
}

function validateName(value: unknown) {
  const name = cleanText(value);
  if (name.length < 2 || name.length > 80) {
    throw new HttpsError("invalid-argument", "Name must contain between 2 and 80 characters.");
  }
  return name;
}

function readCodeDocument(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  return {
    id: doc.id,
    name: cleanText(data.name),
    codePreview: cleanText(data.codePreview),
    active: data.active === true,
  };
}

async function listCodes() {
  const snapshot = await db.collection("registration_codes").orderBy("name", "asc").get();
  return snapshot.docs.map(readCodeDocument);
}

async function createCode(req: any, admin: { uid: string; email: string }) {
  const name = validateName(req.body?.name);
  const code = normalizeAccessCode(req.body?.code);
  const active = req.body?.active !== false;

  if (!isValidAccessCode(code)) {
    throw new HttpsError(
      "invalid-argument",
      "Code must contain 10 to 64 letters, numbers, hyphens or underscores."
    );
  }

  const id = accessCodeHash(code);
  const ref = db.collection("registration_codes").doc(id);
  const existing = await ref.get();

  if (existing.exists) {
    throw new HttpsError("already-exists", "This code already exists.");
  }

  await ref.set({
    name,
    codeHash: id,
    codePreview: accessCodePreview(code),
    active,
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: admin.uid,
    createdByEmail: admin.email,
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUid: admin.uid,
    updatedByEmail: admin.email,
  });

  return {
    id,
    name,
    codePreview: accessCodePreview(code),
    active,
    code,
  };
}

async function updateCode(req: any, admin: { uid: string; email: string }) {
  const currentId = cleanText(req.body?.id);
  const name = validateName(req.body?.name);
  const active = req.body?.active === true;
  const replacementCode = normalizeAccessCode(req.body?.code);

  if (!currentId) {
    throw new HttpsError("invalid-argument", "Code id is required.");
  }

  const currentRef = db.collection("registration_codes").doc(currentId);
  const currentSnap = await currentRef.get();

  if (!currentSnap.exists) {
    throw new HttpsError("not-found", "Access code not found.");
  }

  if (!replacementCode) {
    await currentRef.set(
      {
        name,
        active,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: admin.uid,
        updatedByEmail: admin.email,
      },
      { merge: true }
    );

    return {
      id: currentId,
      name,
      codePreview: cleanText(currentSnap.data()?.codePreview),
      active,
    };
  }

  if (!isValidAccessCode(replacementCode)) {
    throw new HttpsError(
      "invalid-argument",
      "Code must contain 10 to 64 letters, numbers, hyphens or underscores."
    );
  }

  const replacementId = accessCodeHash(replacementCode);
  const replacementRef = db.collection("registration_codes").doc(replacementId);

  await db.runTransaction(async (transaction) => {
    const latestCurrent = await transaction.get(currentRef);
    if (!latestCurrent.exists) {
      throw new HttpsError("not-found", "Access code not found.");
    }

    if (replacementId !== currentId) {
      const replacementSnap = await transaction.get(replacementRef);
      if (replacementSnap.exists) {
        throw new HttpsError("already-exists", "This code already exists.");
      }
    }

    const currentData = latestCurrent.data() || {};
    transaction.set(
      replacementRef,
      {
        ...currentData,
        name,
        codeHash: replacementId,
        codePreview: accessCodePreview(replacementCode),
        active,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: admin.uid,
        updatedByEmail: admin.email,
      },
      { merge: false }
    );

    if (replacementId !== currentId) {
      transaction.delete(currentRef);
    }
  });

  return {
    id: replacementId,
    name,
    codePreview: accessCodePreview(replacementCode),
    active,
    code: replacementCode,
  };
}

async function toggleCode(req: any, admin: { uid: string; email: string }) {
  const id = cleanText(req.body?.id);
  const active = req.body?.active === true;

  if (!id) {
    throw new HttpsError("invalid-argument", "Code id is required.");
  }

  const ref = db.collection("registration_codes").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Access code not found.");
  }

  await ref.set(
    {
      active,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: admin.uid,
      updatedByEmail: admin.email,
    },
    { merge: true }
  );

  return { ok: true, id, active };
}

async function deleteCode(req: any) {
  const id = cleanText(req.body?.id);
  if (!id) {
    throw new HttpsError("invalid-argument", "Code id is required.");
  }
  await db.collection("registration_codes").doc(id).delete();
  return { ok: true, id };
}

function clientAddress(req: any) {
  const forwarded = cleanText(req.get("x-forwarded-for"));
  return cleanText(forwarded.split(",")[0] || req.ip || "unknown");
}

function attemptReference(req: any) {
  const id = accessCodeHash(`registration-code:${clientAddress(req)}`);
  return db.collection("registration_code_attempts").doc(id);
}

async function registerAttempt(req: any) {
  const ref = attemptReference(req);
  const now = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.data() || {};
    const previousStart = data.windowStartedAt as Timestamp | undefined;
    const previousCount = Number(data.attempts || 0);
    const stillInWindow =
      previousStart instanceof Timestamp &&
      now.toMillis() - previousStart.toMillis() < RATE_LIMIT_WINDOW_MS;

    if (stillInWindow && previousCount >= RATE_LIMIT_MAX_ATTEMPTS) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many attempts. Please wait 15 minutes and try again."
      );
    }

    transaction.set(
      ref,
      stillInWindow
        ? { attempts: previousCount + 1, updatedAt: now }
        : { attempts: 1, windowStartedAt: now, updatedAt: now },
      { merge: false }
    );
  });
}

async function clearAttempts(req: any) {
  await attemptReference(req).delete().catch(() => undefined);
}

async function claimRegistrationRequest(requestId: string, codeId: string) {
  const requestRef = db.collection("registration_requests").doc(requestId);
  const codeRef = db.collection("registration_codes").doc(codeId);
  const processingToken = randomBytes(18).toString("hex");

  return db.runTransaction(async (transaction) => {
    const [requestSnap, codeSnap] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(codeRef),
    ]);

    if (!requestSnap.exists || !codeSnap.exists || codeSnap.data()?.active !== true) {
      return null;
    }

    const registration = requestSnap.data() || {};
    const status = cleanText(registration.status || "new");

    if (status === "approved" && cleanText(registration.authUid)) {
      return {
        alreadyApproved: true,
        requestRef,
        processingToken: "",
        registration,
        codeName: cleanText(codeSnap.data()?.name),
      };
    }

    if (status !== "new") {
      return null;
    }

    transaction.set(
      requestRef,
      {
        status: "processing",
        autoApprovalCodeId: codeId,
        autoApprovalStartedAt: FieldValue.serverTimestamp(),
        autoApprovalProcessingToken: processingToken,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      alreadyApproved: false,
      requestRef,
      processingToken,
      registration,
      codeName: cleanText(codeSnap.data()?.name),
    };
  });
}

async function rollbackClaim(
  requestRef: FirebaseFirestore.DocumentReference,
  processingToken: string
) {
  if (!processingToken) return;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(requestRef);
    if (
      snap.exists &&
      cleanText(snap.data()?.status) === "processing" &&
      cleanText(snap.data()?.autoApprovalProcessingToken) === processingToken
    ) {
      transaction.set(
        requestRef,
        {
          status: "new",
          autoApprovalProcessingToken: FieldValue.delete(),
          autoApprovalFailedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });
}

async function approveWithCode(
  requestId: string,
  codeId: string,
  codeName: string,
  registration: FirebaseFirestore.DocumentData,
  requestRef: FirebaseFirestore.DocumentReference,
  processingToken: string
) {
  const email = normalizeEmail(registration.email);
  const name = cleanText(registration.name);
  const phone = cleanText(registration.phone);
  const company = cleanText(registration.company);
  const website = cleanText(registration.website);
  const shippingAddress = cleanText(
    registration.shippingAddress || registration.deliveryAddress
  );
  const displayName = name || company || email;

  if (!email || !email.includes("@")) {
    throw new HttpsError("failed-precondition", "Registration request is invalid.");
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
      logger.error("Failed to check access-code user", { requestId, error });
      throw new HttpsError("internal", "Could not create the account.");
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
      website,
      email,
      phone,
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
      archived: false,
      authUid: userRecord.uid,
      autoApproved: true,
      autoApprovalCodeId: codeId,
      autoApprovalCodeName: codeName,
      autoApprovalProcessingToken: FieldValue.delete(),
      approvedAt: FieldValue.serverTimestamp(),
      approvedByUid: "registration-code",
      approvedByEmail: "registration-code",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info("Registration request approved with access code", {
    requestId,
    email,
    uid: userRecord.uid,
    created,
    codeId,
  });

  return { approved: true, created, email };
}

export const registrationCodesAdminHttp = onRequest(
  { region: REGION, cors: false },
  async (req, res) => {
    res.set("Cache-Control", "no-store");

    try {
      assertPost(req);
      const admin = await assertAdminFromRequest(req);
      const action = cleanText(req.body?.action);

      if (action === "list") {
        res.status(200).json({ ok: true, codes: await listCodes() });
        return;
      }
      if (action === "create") {
        res.status(200).json({ ok: true, code: await createCode(req, admin) });
        return;
      }
      if (action === "update") {
        res.status(200).json({ ok: true, code: await updateCode(req, admin) });
        return;
      }
      if (action === "toggle") {
        res.status(200).json(await toggleCode(req, admin));
        return;
      }
      if (action === "delete") {
        res.status(200).json(await deleteCode(req));
        return;
      }

      throw new HttpsError("invalid-argument", "Unknown action.");
    } catch (error) {
      logger.error("registrationCodesAdminHttp failed", { error });
      res.status(getStatus(error)).json({ error: getMessage(error) });
    }
  }
);

export const redeemRegistrationCodeHttp = onRequest(
  { region: REGION, cors: false },
  async (req, res) => {
    res.set("Cache-Control", "no-store");

    let claim:
      | Awaited<ReturnType<typeof claimRegistrationRequest>>
      | null = null;

    try {
      assertPost(req);
      await registerAttempt(req);

      const requestId = cleanText(req.body?.requestId);
      const code = normalizeAccessCode(req.body?.code);

      if (!requestId || requestId.length > 160 || !isValidAccessCode(code)) {
        res.status(200).json({ ok: true, approved: false });
        return;
      }

      const codeId = accessCodeHash(code);
      claim = await claimRegistrationRequest(requestId, codeId);

      if (!claim) {
        res.status(200).json({ ok: true, approved: false });
        return;
      }

      if (claim.alreadyApproved) {
        await clearAttempts(req);
        res.status(200).json({
          ok: true,
          approved: true,
          alreadyApproved: true,
          email: normalizeEmail(claim.registration.email),
        });
        return;
      }

      const result = await approveWithCode(
        requestId,
        codeId,
        claim.codeName,
        claim.registration,
        claim.requestRef,
        claim.processingToken
      );

      await clearAttempts(req);
      res.status(200).json({ ok: true, ...result });
    } catch (error) {
      if (claim?.requestRef && claim.processingToken) {
        await rollbackClaim(claim.requestRef, claim.processingToken).catch(
          (rollbackError) =>
            logger.error("Failed to rollback registration-code claim", {
              rollbackError,
            })
        );
      }

      logger.error("redeemRegistrationCodeHttp failed", { error });
      res.status(getStatus(error)).json({ error: getMessage(error) });
    }
  }
);
