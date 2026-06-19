import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";

initializeApp();

const db = getFirestore();

const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

const MAIL_TO = "info@h2hardwareltd.com";
const MAIL_REPLY_TO = "info@h2hardwareltd.com";
const REGION = "us-central1";
const DEFAULT_ADMIN_EMAILS = ["maia@h2hardwareltd.com"];

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: unknown) {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(safe);
}

function field(label: string, value: unknown) {
  const clean = String(value ?? "").trim() || "—";
  return `<tr><td style="padding:6px 10px;font-weight:700;border-bottom:1px solid #eee;white-space:nowrap;">${escapeHtml(
    label
  )}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(clean)}</td></tr>`;
}

function emailFrame(title: string, rowsHtml: string, extraHtml = "") {
  return `
  <div style="font-family:Arial,sans-serif;color:#111;line-height:1.45;max-width:720px;">
    <h2 style="margin:0 0 12px;color:#b91c1c;">${escapeHtml(title)}</h2>
    <table style="border-collapse:collapse;width:100%;border:1px solid #eee;border-radius:8px;overflow:hidden;">
      ${rowsHtml}
    </table>
    ${extraHtml}
    <p style="margin-top:18px;font-size:12px;color:#666;">
      This is an automatic notification from the H2 Hardware website.
    </p>
  </div>`;
}

function createTransporter() {
  const user = SMTP_USER.value();
  const pass = SMTP_PASSWORD.value();

  if (!user || !pass) {
    throw new Error("Missing SMTP_USER or SMTP_PASSWORD secret.");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

async function sendNotification(subject: string, text: string, html: string) {
  const user = SMTP_USER.value();
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `H2 Hardware Notifications <${user}>`,
    to: MAIL_TO,
    replyTo: MAIL_REPLY_TO,
    subject,
    text,
    html,
  });
}

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

async function assertAdmin(authData: { uid?: string; token?: { email?: string } } | undefined) {
  const adminEmail = String(authData?.token?.email || "").trim().toLowerCase();

  if (!authData?.uid || !adminEmail) {
    throw new HttpsError("unauthenticated", "Admin login is required.");
  }

  if (!configuredAdminEmails().has(adminEmail)) {
    throw new HttpsError("permission-denied", "Only admins can perform this action.");
  }

  return {
    uid: authData.uid,
    email: adminEmail,
  };
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
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

export const approveRegistrationRequest = onCall(
  {
    region: REGION,
    cors: true,
  },
  async (request) => {
    const admin = await assertAdmin(request.auth);
    const requestId = cleanText(request.data?.requestId);

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
);

export const disableRegistrationUser = onCall(
  {
    region: REGION,
    cors: true,
  },
  async (request) => {
    const admin = await assertAdmin(request.auth);
    const requestId = cleanText(request.data?.requestId);

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
);

export const notifyNewOrder = onDocumentCreated(
  {
    document: "orders/{orderId}",
    region: REGION,
    secrets: [SMTP_USER, SMTP_PASSWORD],
  },
  async (event) => {
    const orderId = event.params.orderId;
    const data = event.data?.data() || {};
    const customer = (data.customer || {}) as Record<string, unknown>;
    const items = Array.isArray(data.items) ? data.items : [];

    const itemLines = items
      .map((item: any) => {
        const name = item?.name || item?.slug || "Item";
        const model = item?.model ? ` - ${item.model}` : "";
        const qty = item?.qty ?? "";
        const unit = money(item?.unitPriceApplied ?? item?.unit ?? 0);
        return `<li>${escapeHtml(name)}${escapeHtml(model)} — Qty: ${escapeHtml(qty)} — Unit: ${escapeHtml(unit)}</li>`;
      })
      .join("");

    const rows =
      field("Order ID", orderId) +
      field("Customer", customer.name) +
      field("Email", customer.email || data.userEmail) +
      field("Phone", customer.phone) +
      field("Total", money(data.total)) +
      field("Delivery address", data.shippingAddress);

    const html = emailFrame(
      "New order received",
      rows,
      `<h3 style="margin:18px 0 8px;">Items</h3><ul>${itemLines || "<li>—</li>"}</ul>`
    );

    const text = [
      "New order received",
      `Order ID: ${orderId}`,
      `Customer: ${customer.name || "—"}`,
      `Email: ${customer.email || data.userEmail || "—"}`,
      `Phone: ${customer.phone || "—"}`,
      `Total: ${money(data.total)}`,
      `Delivery address: ${data.shippingAddress || "—"}`,
      "",
      "Items:",
      items
        .map((item: any) => `- ${item?.name || item?.slug || "Item"} | Qty: ${item?.qty || "—"} | Unit: ${money(item?.unitPriceApplied ?? item?.unit ?? 0)}`)
        .join("\n") || "—",
    ].join("\n");

    await sendNotification("[H2 Hardware] New order received", text, html);
    logger.info("Order notification sent", { orderId });
  }
);

export const notifyNewRegistrationRequest = onDocumentCreated(
  {
    document: "registration_requests/{requestId}",
    region: REGION,
    secrets: [SMTP_USER, SMTP_PASSWORD],
  },
  async (event) => {
    const requestId = event.params.requestId;
    const data = event.data?.data() || {};
    const shippingAddress = data.shippingAddress || data.deliveryAddress;

    const rows =
      field("Request ID", requestId) +
      field("Name", data.name) +
      field("Email", data.email) +
      field("Company", data.company) +
      field("Delivery address", shippingAddress) +
      field("Status", data.status || "new");

    const html = emailFrame("New account access request", rows);
    const text = [
      "New account access request",
      `Request ID: ${requestId}`,
      `Name: ${data.name || "—"}`,
      `Email: ${data.email || "—"}`,
      `Company: ${data.company || "—"}`,
      `Delivery address: ${shippingAddress || "—"}`,
      `Status: ${data.status || "new"}`,
    ].join("\n");

    await sendNotification("[H2 Hardware] New account access request", text, html);
    logger.info("Registration request notification sent", { requestId });
  }
);

export const notifyNewSampleRequest = onDocumentCreated(
  {
    document: "sample_requests/{requestId}",
    region: REGION,
    secrets: [SMTP_USER, SMTP_PASSWORD],
  },
  async (event) => {
    const requestId = event.params.requestId;
    const data = event.data?.data() || {};

    const rows =
      field("Request ID", requestId) +
      field("Company", data.companyName) +
      field("Contact", data.contactName) +
      field("Website", data.website) +
      field("Phone", data.phone) +
      field("Email", data.email) +
      field("Delivery address", data.deliveryAddress) +
      field("Status", data.status || "new");

    const html = emailFrame("New sample request", rows);
    const text = [
      "New sample request",
      `Request ID: ${requestId}`,
      `Company: ${data.companyName || "—"}`,
      `Contact: ${data.contactName || "—"}`,
      `Website: ${data.website || "—"}`,
      `Phone: ${data.phone || "—"}`,
      `Email: ${data.email || "—"}`,
      `Delivery address: ${data.deliveryAddress || "—"}`,
      `Status: ${data.status || "new"}`,
    ].join("\n");

    await sendNotification("[H2 Hardware] New sample request", text, html);
    logger.info("Sample request notification sent", { requestId });
  }
);
