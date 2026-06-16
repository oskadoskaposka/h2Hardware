import { initializeApp } from "firebase-admin/app";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import nodemailer from "nodemailer";

initializeApp();

const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

const MAIL_TO = "info@h2hardwareltd.com";
const MAIL_REPLY_TO = "info@h2hardwareltd.com";
const REGION = "us-central1";

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

    const rows =
      field("Request ID", requestId) +
      field("Name", data.name) +
      field("Email", data.email) +
      field("Company", data.company) +
      field("Status", data.status || "new");

    const html = emailFrame("New account access request", rows);
    const text = [
      "New account access request",
      `Request ID: ${requestId}`,
      `Name: ${data.name || "—"}`,
      `Email: ${data.email || "—"}`,
      `Company: ${data.company || "—"}`,
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
