import { initializeApp, getApps } from "firebase-admin/app";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import nodemailer from "nodemailer";

if (!getApps().length) {
  initializeApp();
}

const REGION = "us-central1";
const MAIL_REPLY_TO = "info@h2hardwareltd.com";
const CONTACT_EMAIL = "info@h2hardwareltd.com";
const CONTACT_PHONE = "+1 (226) 788-1924";
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

export const sendSampleRequestConfirmation = onDocumentCreated(
  {
    document: "sample_requests/{requestId}",
    region: REGION,
    secrets: [SMTP_USER, SMTP_PASSWORD],
  },
  async (event) => {
    const requestId = event.params.requestId;
    const data = event.data?.data() || {};
    const email = normalizeEmail(data.email);

    if (!email || !isValidEmail(email)) {
      logger.warn("Sample request confirmation skipped because email is invalid", { requestId, email });
      return;
    }

    const contactName = cleanText(data.contactName) || "there";
    const companyName = cleanText(data.companyName);
    const subject = "We received your H2 Hardware sample request";

    const text = [
      `Hello ${contactName},`,
      "",
      "Thank you for submitting your free sample request.",
      "We received your information and our team will organize everything to send your sample as soon as possible.",
      companyName ? `Company: ${companyName}` : "",
      "",
      "If we need any additional information, we will contact you using the details provided in the form.",
      "",
      "Questions? Contact us at " + CONTACT_EMAIL + " or " + CONTACT_PHONE + ".",
      "",
      "Thank you,",
      "H2 Hardware team",
    ].filter(Boolean).join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:640px;margin:0 auto;">
        <div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#fff;">
          <div style="background:#111;color:#fff;padding:18px 20px;border-bottom:4px solid #b91c1c;">
            <div style="font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#fca5a5;">H2 Hardware</div>
            <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">Sample request received</h1>
          </div>
          <div style="padding:22px 20px;background:#fff;">
            <p style="margin:0 0 12px;">Hello ${escapeHtml(contactName)},</p>
            <p style="margin:0 0 14px;">Thank you for submitting your free sample request.</p>
            <p style="margin:0 0 14px;">We received your information and our team will organize everything to send your sample as soon as possible.</p>
            ${companyName ? `<p style="margin:0 0 14px;color:#475569;">Company: <strong>${escapeHtml(companyName)}</strong></p>` : ""}
            <p style="margin:0 0 16px;color:#475569;">If we need any additional information, we will contact you using the details provided in the form.</p>
            <p style="margin:0 0 16px;">If you have any questions, contact us at ${escapeHtml(CONTACT_EMAIL)} or ${escapeHtml(CONTACT_PHONE)}.</p>
            <p style="margin:0;">Thank you,<br/>H2 Hardware team</p>
          </div>
        </div>
      </div>`;

    const user = SMTP_USER.value();
    const transporter = createTransporter();

    await transporter.sendMail({
      from: `H2 Hardware <${user}>`,
      to: email,
      replyTo: MAIL_REPLY_TO,
      subject,
      text,
      html,
    });

    logger.info("Sample request confirmation sent", { requestId, email });
  }
);
