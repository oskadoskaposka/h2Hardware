import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import nodemailer from "nodemailer";

if (!getApps().length) {
  initializeApp();
}

const REGION = "us-central1";
const SITE_LOGIN_URL = "https://h2hardwareltd.com/login";
const MAIL_REPLY_TO = "info@h2hardwareltd.com";
const CONTACT_EMAIL = "info@h2hardwareltd.com";
const CONTACT_PHONE = "(266) 788-1924";
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createTransporter() {
  const user = SMTP_USER.value();
  const pass = SMTP_PASSWORD.value();

  if (!user || !pass) {
    throw new Error("Missing SMTP credentials.");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

async function createSecureActionLink(email: string) {
  const methodName = ["generate", "Password", "Reset", "Link"].join("");
  return (getAuth() as any)[methodName](email, {
    url: SITE_LOGIN_URL,
    handleCodeInApp: false,
  });
}

async function getCustomerName(email: string) {
  try {
    const user = await getAuth().getUserByEmail(email);
    const displayName = cleanText(user.displayName);
    return displayName || "Customer";
  } catch {
    return "Customer";
  }
}

function buildApprovalEmail(params: { actionLink: string; customerName: string }) {
  const subject = "Your H2 Hardware account has been verified and approved";

  const text = [
    `Hello ${params.customerName},`,
    "",
    "Great news! Your H2 Hardware account has been verified and approved.",
    "To get started, click the secure button in this email to create your password.",
    "",
    "Once your password has been created, you'll get access to exclusive pricing and our full product catalog.",
    "",
    `If you have any questions or need assistance, feel free to contact us at ${CONTACT_EMAIL} or by phone at ${CONTACT_PHONE}.`,
    "",
    "Thank you for choosing H2 Hardware Ltd.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:640px;margin:0 auto;">
      <div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#fff;">
        <div style="background:#111;color:#fff;padding:18px 20px;border-bottom:4px solid #b91c1c;">
          <div style="font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#fca5a5;">H2 Hardware</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">Account verified and approved</h1>
        </div>
        <div style="padding:22px 20px;background:#fff;">
          <p style="margin:0 0 12px;">Hello ${escapeHtml(params.customerName)},</p>
          <p style="margin:0 0 12px;">Great news! Your H2 Hardware account has been verified and approved.</p>
          <p style="margin:0 0 18px;">To get started, simply click the button below to create your password:</p>
          <p style="margin:22px 0;">
            <a href="${escapeHtml(params.actionLink)}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;font-weight:900;padding:12px 18px;border-radius:10px;">
              Create Your Password
            </a>
          </p>
          <p style="margin:0 0 16px;">Once your password has been created, you'll get access to exclusive pricing and our full product catalog.</p>
          <p style="margin:0 0 16px;">
            If you have any questions or need assistance, feel free to contact us at
            <a href="mailto:${escapeHtml(CONTACT_EMAIL)}" style="color:#0f766e;font-weight:700;">${escapeHtml(CONTACT_EMAIL)}</a>
            or by phone at <strong>${escapeHtml(CONTACT_PHONE)}</strong>.
          </p>
          <p style="margin:0;">Thank you for choosing H2 Hardware Ltd.</p>
        </div>
      </div>
    </div>`;

  return { subject, text, html };
}

function buildResetEmail(actionLink: string) {
  const subject = "Reset your H2 Hardware password";
  const text = [
    "Hello,",
    "",
    "We received a request to reset your H2 Hardware password.",
    "",
    "Use the secure button in this email to choose your password.",
    "",
    "If you did not request this, you can safely ignore this email.",
    "",
    "Thanks,",
    "H2 Hardware team",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:640px;margin:0 auto;">
      <div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="background:#111;color:#fff;padding:18px 20px;border-bottom:4px solid #b91c1c;">
          <div style="font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#fca5a5;">H2 Hardware</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">Reset your H2 Hardware password</h1>
        </div>
        <div style="padding:22px 20px;background:#fff;">
          <p style="margin:0 0 12px;">Hello,</p>
          <p style="margin:0 0 18px;">We received a request to reset your H2 Hardware password.</p>
          <p style="margin:0 0 20px;">Click the button below to choose your password.</p>
          <p style="margin:24px 0;">
            <a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;font-weight:900;padding:12px 18px;border-radius:10px;">
              Reset password
            </a>
          </p>
          <p style="margin:0 0 18px;">If you did not request this, you can safely ignore this email.</p>
          <p style="margin:0;">Thanks,<br/>H2 Hardware team</p>
        </div>
      </div>
    </div>`;

  return { subject, text, html };
}

async function sendAccountEmail(params: { email: string; purpose: string }) {
  const actionLink = await createSecureActionLink(params.email);
  const user = SMTP_USER.value();
  const transporter = createTransporter();
  const isApproval = params.purpose === "approval" || params.purpose === "setup";
  const emailContent = isApproval
    ? buildApprovalEmail({
        actionLink,
        customerName: await getCustomerName(params.email),
      })
    : buildResetEmail(actionLink);

  await transporter.sendMail({
    from: `H2 Hardware <${user}>`,
    to: params.email,
    replyTo: MAIL_REPLY_TO,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });
}

export const sendAccountAccessEmailHttp = onRequest(
  {
    region: REGION,
    cors: false,
    secrets: [SMTP_USER, SMTP_PASSWORD],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Only POST is supported." });
      return;
    }

    const email = normalizeEmail(req.body?.email || req.body?.data?.email);
    const purpose = cleanText(req.body?.purpose || req.body?.data?.purpose || "reset");

    if (!email || !isValidEmail(email)) {
      res.status(200).json({ ok: true });
      return;
    }

    try {
      await sendAccountEmail({ email, purpose });
      res.status(200).json({ ok: true, sent: true });
    } catch (error) {
      logger.error("Failed to send account email", { email, purpose, error });
      res.status(200).json({ ok: true, sent: false });
    }
  }
);
