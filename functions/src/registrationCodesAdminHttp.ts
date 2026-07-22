import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
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
  const email = cleanText(decoded.email).toLowerCase();

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
    throw new HttpsError(
      "invalid-argument",
      "Name must contain between 2 and 80 characters."
    );
  }
  return name;
}

function validateCode(value: unknown) {
  const code = normalizeAccessCode(value);
  if (!isValidAccessCode(code)) {
    throw new HttpsError(
      "invalid-argument",
      "Code must contain 10 to 64 letters, numbers, hyphens or underscores."
    );
  }
  return code;
}

function readCodeDocument(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  return {
    id: doc.id,
    name: cleanText(data.name),
    code: cleanText(data.code),
    active: data.active === true,
  };
}

async function listCodes() {
  const snapshot = await db
    .collection("registration_codes")
    .orderBy("name", "asc")
    .get();

  return snapshot.docs.map(readCodeDocument);
}

async function createCode(req: any, admin: { uid: string; email: string }) {
  const name = validateName(req.body?.name);
  const code = validateCode(req.body?.code);
  const active = req.body?.active !== false;
  const id = accessCodeHash(code);
  const ref = db.collection("registration_codes").doc(id);
  const existing = await ref.get();

  if (existing.exists) {
    throw new HttpsError("already-exists", "This code already exists.");
  }

  await ref.set({
    name,
    code,
    codeHash: id,
    active,
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: admin.uid,
    createdByEmail: admin.email,
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUid: admin.uid,
    updatedByEmail: admin.email,
  });

  return { id, name, code, active };
}

async function updateCode(req: any, admin: { uid: string; email: string }) {
  const currentId = cleanText(req.body?.id);
  const name = validateName(req.body?.name);
  const active = req.body?.active === true;

  if (!currentId) {
    throw new HttpsError("invalid-argument", "Code id is required.");
  }

  const currentRef = db.collection("registration_codes").doc(currentId);
  const currentSnap = await currentRef.get();

  if (!currentSnap.exists) {
    throw new HttpsError("not-found", "Access code not found.");
  }

  const currentData = currentSnap.data() || {};
  const submittedCode = normalizeAccessCode(req.body?.code);
  const storedCode = normalizeAccessCode(currentData.code);
  const code = validateCode(submittedCode || storedCode);
  const nextId = accessCodeHash(code);
  const nextRef = db.collection("registration_codes").doc(nextId);

  await db.runTransaction(async (transaction) => {
    const latestCurrent = await transaction.get(currentRef);

    if (!latestCurrent.exists) {
      throw new HttpsError("not-found", "Access code not found.");
    }

    if (nextId !== currentId) {
      const nextSnap = await transaction.get(nextRef);
      if (nextSnap.exists) {
        throw new HttpsError("already-exists", "This code already exists.");
      }
    }

    const latestData = latestCurrent.data() || {};
    transaction.set(
      nextRef,
      {
        ...latestData,
        name,
        code,
        codeHash: nextId,
        active,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: admin.uid,
        updatedByEmail: admin.email,
      },
      { merge: false }
    );

    if (nextId !== currentId) {
      transaction.delete(currentRef);
    }
  });

  return { id: nextId, name, code, active };
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
