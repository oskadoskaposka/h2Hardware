import { randomBytes } from "crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  accessCodeHash,
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
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return cleanText(value).toLowerCase();
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

function validatePassword(value: unknown) {
  const password = typeof value === "string" ? value : "";

  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new HttpsError(
      "invalid-argument",
      `Password must contain between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`
    );
  }

  return password;
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

async function registrationCodeIsActive(code: string) {
  if (!isValidAccessCode(code)) return false;

  const codeSnap = await db
    .collection("registration_codes")
    .doc(accessCodeHash(code))
    .get();

  return codeSnap.exists && codeSnap.data()?.active === true;
}

async function claimRegistrationRequest(
  requestId: string,
  codeId: string,
  code: string
) {
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
        submittedAccessCode: code,
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

async function createApprovedAccount(
  requestId: string,
  codeId: string,
  codeName: string,
  password: string,
  registration: FirebaseFirestore.DocumentData,
  requestRef: FirebaseFirestore.DocumentReference
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
    throw new HttpsError(
      "failed-precondition",
      "Registration request is invalid."
    );
  }

  try {
    await getAuth().getUserByEmail(email);
    throw new HttpsError(
      "already-exists",
      "An account already exists for this email. Please log in or use Forgot password."
    );
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    if (errorCode(error) !== "auth/user-not-found") {
      logger.error("Failed to check registration-code user", {
        requestId,
        errorCode: errorCode(error),
      });
      throw new HttpsError("internal", "Could not create the account.");
    }
  }

  let userRecord;

  try {
    userRecord = await getAuth().createUser({
      email,
      displayName,
      password,
      emailVerified: false,
      disabled: false,
    });
  } catch (error) {
    if (errorCode(error) === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "An account already exists for this email. Please log in or use Forgot password."
      );
    }

    logger.error("Failed to create registration-code user", {
      requestId,
      errorCode: errorCode(error),
    });
    throw new HttpsError("internal", "Could not create the account.");
  }

  try {
    const customerRef = db.collection("customers").doc(userRecord.uid);
    const customerSnap = await customerRef.get();
    const batch = db.batch();

    batch.set(
      customerRef,
      {
        name,
        company,
        website,
        email,
        phone,
        shippingAddress,
        disabled: false,
        updatedAt: FieldValue.serverTimestamp(),
        ...(customerSnap.exists
          ? {}
          : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );

    batch.set(
      requestRef,
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

    await batch.commit();
  } catch (error) {
    await getAuth().deleteUser(userRecord.uid).catch((deleteError) =>
      logger.error("Failed to remove incomplete registration-code user", {
        requestId,
        uid: userRecord.uid,
        errorCode: errorCode(deleteError),
      })
    );

    logger.error("Failed to finalize registration-code account", {
      requestId,
      uid: userRecord.uid,
      errorCode: errorCode(error),
    });
    throw new HttpsError("internal", "Could not create the account.");
  }

  logger.info("Registration request approved with access code", {
    requestId,
    email,
    uid: userRecord.uid,
    codeId,
  });

  return { approved: true, created: true, email };
}

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

      const code = normalizeAccessCode(req.body?.code);

      if (cleanText(req.body?.mode) === "verify") {
        const valid = await registrationCodeIsActive(code);

        if (valid) {
          await clearAttempts(req);
        }

        res.status(200).json({ ok: true, valid });
        return;
      }

      const requestId = cleanText(req.body?.requestId);
      const password = validatePassword(req.body?.password);

      if (!requestId || requestId.length > 160 || !isValidAccessCode(code)) {
        res.status(200).json({ ok: true, approved: false });
        return;
      }

      const codeId = accessCodeHash(code);
      claim = await claimRegistrationRequest(requestId, codeId, code);

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

      const result = await createApprovedAccount(
        requestId,
        codeId,
        claim.codeName,
        password,
        claim.registration,
        claim.requestRef
      );

      await clearAttempts(req);
      res.status(200).json({ ok: true, ...result });
    } catch (error) {
      if (claim?.requestRef && claim.processingToken) {
        await rollbackClaim(claim.requestRef, claim.processingToken).catch(
          (rollbackError) =>
            logger.error("Failed to rollback registration-code claim", {
              errorCode: errorCode(rollbackError),
            })
        );
      }

      logger.error("redeemRegistrationCodeHttp failed", {
        errorCode: errorCode(error),
      });
      res.status(getStatus(error)).json({ error: getMessage(error) });
    }
  }
);
