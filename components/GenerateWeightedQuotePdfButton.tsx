"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import { formatWeight } from "../lib/weight";

type CustomerType = "avulso" | "regular" | "tiered";

export type QuoteItem = {
  slug: string;
  productId?: string;
  qty: number;
  name?: string;
  model?: string;
  price?: number;
  unitPrice?: number;
  unit?: number;
  publicPrice?: number;
  unitWeightLb?: number;
  unitWeightKg?: number;
  totalWeightLb?: number;
  totalWeightKg?: number;
};

export type OrderPdfData = {
  items: QuoteItem[];
  customer: { name: string; email: string; phone: string };
  currency?: string;
  subtitle?: string;
  shippingAddress?: string;
  logoDataUrl?: string;
  generatedAt?: Date;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BRAND_RED = [185, 28, 28] as const;
const INK = [15, 23, 42] as const;
const MUTED = [100, 116, 139] as const;
const BORDER = [226, 232, 240] as const;

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function weightText(lb: unknown, kg: unknown) {
  const lbValue = toNumber(lb);
  const kgValue = toNumber(kg);
  if (lbValue <= 0 && kgValue <= 0) return "";
  return `${formatWeight(lbValue, "lb")} / ${formatWeight(kgValue, "kg")}`;
}

function loadImageDataUrl(url: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.94));
    };
    image.onerror = () => reject(new Error("Logo could not be loaded."));
    image.src = url;
  });
}

function setTextColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function drawHeader(doc: jsPDF, subtitle: string, logoDataUrl?: string) {
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, PAGE_WIDTH, 66, "F");
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 66, PAGE_WIDTH, 3, "F");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "JPEG", MARGIN, 10, 36, 42, undefined, "FAST");
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("H2 HARDWARE", logoDataUrl ? 88 : MARGIN, 29);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text("ORDER DOCUMENT", logoDataUrl ? 88 : MARGIN, 43);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(subtitle, PAGE_WIDTH - MARGIN, 32, { align: "right", maxWidth: 265 });
}

function drawTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 22, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("PRODUCT", MARGIN + 8, y + 15);
  doc.text("PRODUCT ID", 252, y + 15);
  doc.text("QTY", 375, y + 15, { align: "right" });
  doc.text("UNIT", 455, y + 15, { align: "right" });
  doc.text("SUBTOTAL", PAGE_WIDTH - MARGIN - 8, y + 15, { align: "right" });
  return y + 27;
}

function drawFooter(doc: jsPDF, pageNumber: number, pageCount: number) {
  doc.setDrawColor(...BORDER);
  doc.line(MARGIN, PAGE_HEIGHT - 37, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 37);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextColor(doc, MUTED);
  doc.text("H2 Hardware - Order document", MARGIN, PAGE_HEIGHT - 21);
  doc.text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 21, { align: "right" });
}

export function buildOrderPdf({
  items,
  customer,
  currency = "CAD",
  subtitle = "Order / Quote",
  shippingAddress = "",
  logoDataUrl,
  generatedAt = new Date(),
}: OrderPdfData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(toNumber(value));

  drawHeader(doc, subtitle, logoDataUrl);

  let y = 84;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setTextColor(doc, MUTED);
  doc.text("GENERATED", PAGE_WIDTH - MARGIN, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, INK);
  doc.text(generatedAt.toLocaleDateString("en-CA"), PAGE_WIDTH - MARGIN, y + 11, { align: "right" });

  const cardY = 105;
  const gap = 9;
  const cardWidth = (CONTENT_WIDTH - gap) / 2;
  const addressLines = doc.splitTextToSize(shippingAddress.trim() || "Not provided", cardWidth - 20);
  const cardHeight = Math.max(68, 36 + addressLines.length * 10);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(MARGIN, cardY, cardWidth, cardHeight, 5, 5, "FD");
  doc.roundedRect(MARGIN + cardWidth + gap, cardY, cardWidth, cardHeight, 5, 5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setTextColor(doc, BRAND_RED);
  doc.text("CUSTOMER", MARGIN + 10, cardY + 14);
  doc.text("DELIVERY ADDRESS", MARGIN + cardWidth + gap + 10, cardY + 14);

  doc.setFontSize(9.5);
  setTextColor(doc, INK);
  doc.text(customer.name || "Not provided", MARGIN + 10, cardY + 30, { maxWidth: cardWidth - 20 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  setTextColor(doc, MUTED);
  doc.text(customer.email || "Email not provided", MARGIN + 10, cardY + 44, { maxWidth: cardWidth - 20 });
  doc.text(customer.phone || "Phone not provided", MARGIN + 10, cardY + 56, { maxWidth: cardWidth - 20 });

  doc.setFontSize(8.2);
  setTextColor(doc, INK);
  doc.text(addressLines, MARGIN + cardWidth + gap + 10, cardY + 30);

  y = drawTableHeader(doc, cardY + cardHeight + 12);
  let total = 0;
  let totalWeightLb = 0;
  let totalWeightKg = 0;

  const newItemsPage = () => {
    doc.addPage();
    drawHeader(doc, subtitle, logoDataUrl);
    y = drawTableHeader(doc, 84);
  };

  for (const [itemIndex, item] of (items || []).entries()) {
    const qty = Math.max(1, Math.floor(toNumber(item.qty) || 1));
    const unit = toNumber(item.unitPrice) || toNumber(item.unit) || toNumber(item.price) || toNumber(item.publicPrice);
    const subtotal = unit * qty;
    const productId = String(item.productId || item.slug || "-");
    const productLines = doc.splitTextToSize(String(item.name || item.slug || "-"), 170);
    const details = [String(item.model || "").trim(), weightText(item.totalWeightLb, item.totalWeightKg) ? weightText(item.totalWeightLb, item.totalWeightKg) : ""].filter(Boolean).join(" | ");
    const rowHeight = Math.max(30, 13 + productLines.length * 10 + (details ? 9 : 0));

    const shouldKeepLastItemsWithSummary = items.length > 10
      && itemIndex === items.length - 2
      && y > 590;
    if (y + rowHeight > PAGE_HEIGHT - 70 || shouldKeepLastItemsWithSummary) newItemsPage();

    total += subtotal;
    totalWeightLb += toNumber(item.totalWeightLb);
    totalWeightKg += toNumber(item.totalWeightKg);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, rowHeight - 3, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setTextColor(doc, INK);
    doc.text(productLines, MARGIN + 8, y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    setTextColor(doc, MUTED);
    if (details) doc.text(details, MARGIN + 8, y + 12 + productLines.length * 10, { maxWidth: 165 });
    doc.text(productId, 252, y + 13, { maxWidth: 100 });
    setTextColor(doc, INK);
    doc.text(String(qty), 375, y + 13, { align: "right" });
    doc.text(formatCurrency(unit), 455, y + 13, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(subtotal), PAGE_WIDTH - MARGIN - 8, y + 13, { align: "right" });
    y += rowHeight;
  }

  const finalWeight = weightText(totalWeightLb, totalWeightKg);
  const summaryHeight = finalWeight ? 78 : 64;
  if (y + summaryHeight > PAGE_HEIGHT - 70) {
    doc.addPage();
    drawHeader(doc, subtitle, logoDataUrl);
    y = 84;
  }

  y += 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(320, y, PAGE_WIDTH - MARGIN - 320, summaryHeight, 5, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setTextColor(doc, MUTED);
  doc.text("ORDER TOTAL", 332, y + 18);
  doc.setFontSize(15);
  setTextColor(doc, BRAND_RED);
  doc.text(formatCurrency(total), PAGE_WIDTH - MARGIN - 12, y + 20, { align: "right" });
  if (finalWeight) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, MUTED);
    doc.text("Total weight", 332, y + 39);
    doc.setFont("helvetica", "bold");
    setTextColor(doc, INK);
    doc.text(finalWeight, PAGE_WIDTH - MARGIN - 12, y + 39, { align: "right" });
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setTextColor(doc, MUTED);
  const taxLines = doc.splitTextToSize("Taxes and shipping fees are not included and may apply.", PAGE_WIDTH - MARGIN - 348);
  doc.text(taxLines, 332, y + (finalWeight ? 57 : 41));

  doc.setFontSize(8);
  setTextColor(doc, INK);
  doc.text("Our team will contact you to review and finalize this order. No payment is collected on the website.", MARGIN, y + summaryHeight - 6, { maxWidth: 245 });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, pageCount);
  }

  return doc;
}

export default function GenerateWeightedQuotePdfButton({
  items,
  customer,
  currency = "CAD",
  filename = "h2-hardware-quote.pdf",
  subtitle = "Order / Quote",
  shippingAddress = "",
  variant = "default",
}: {
  items: QuoteItem[];
  customer: { name: string; email: string; phone: string };
  customerType: CustomerType;
  currency?: string;
  filename?: string;
  subtitle?: string;
  shippingAddress?: string;
  variant?: "default" | "icon";
}) {
  const [busy, setBusy] = useState(false);

  async function generatePdf() {
    setBusy(true);
    try {
      const logoDataUrl = await loadImageDataUrl("/h2-logo.svg").catch(() => undefined);
      buildOrderPdf({ items, customer, currency, subtitle, shippingAddress, logoDataUrl }).save(filename);
    } finally {
      setBusy(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={generatePdf}
        disabled={busy}
        aria-label={busy ? "Generating order PDF" : "Download order PDF"}
        aria-busy={busy}
        title={busy ? "Generating PDF..." : "Download PDF"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: 9,
          border: "1px solid #cbd5e1",
          background: "#fff",
          color: "#475569",
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? (
          <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>...</span>
        ) : (
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        )}
      </button>
    );
  }

  return <button type="button" onClick={generatePdf} disabled={busy}>{busy ? "Generating PDF..." : "Download PDF"}</button>;
}
