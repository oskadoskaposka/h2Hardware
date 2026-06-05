"use client";

import { useState } from "react";
import jsPDF from "jspdf";

type CustomerType = "avulso" | "regular" | "tiered";

type QuoteItem = {
  slug: string;
  productId?: string;
  qty: number;

  name?: string;
  model?: string;

  price?: number;
  unitPrice?: number;
  unit?: number;
  publicPrice?: number;

  product?: {
    publicPrice?: number;
    price?: number;
    tiers?: { minQty: number; maxQty?: number | null; price: number }[];
    discountTiers?: { minQty: number; maxQty?: number | null; price: number }[];
  };
};

function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function resolveTierUnitPriceFromProduct(
  product: NonNullable<QuoteItem["product"]>,
  qty: number,
  customerType: CustomerType
): number {
  const publicUnit = toNumber(product.publicPrice ?? product.price ?? 0);

  if (customerType === "avulso") return publicUnit;

  const tiersRaw = Array.isArray(product.tiers)
    ? product.tiers
    : Array.isArray(product.discountTiers)
      ? product.discountTiers
      : [];

  const tiers = tiersRaw
    .map((t) => ({
      minQty: Math.max(1, Math.floor(toNumber(t.minQty))),
      maxQty:
        t.maxQty == null ? null : Math.max(1, Math.floor(toNumber(t.maxQty))),
      price: toNumber(t.price),
    }))
    .filter((t) => t.minQty > 0 && t.price > 0)
    .sort((a, b) => a.minQty - b.minQty);

  if (!tiers.length) return publicUnit;

  const q = Math.max(1, Math.floor(toNumber(qty) || 1));

  const match = tiers.find((t) => {
    const max = t.maxQty == null ? Infinity : t.maxQty;
    return q >= t.minQty && q <= max;
  });

  const matchPrice = match?.price ?? 0;
  return matchPrice > 0 ? matchPrice : publicUnit;
}

function resolveUnitPrice(
  it: QuoteItem,
  qty: number,
  customerType: CustomerType
): number {
  if (it.product) {
    const u = resolveTierUnitPriceFromProduct(it.product, qty, customerType);
    if (u > 0) return u;
  }

  return (
    toNumber(it.price) ||
    toNumber((it as any).unitPrice) ||
    toNumber((it as any).unit) ||
    toNumber((it as any).publicPrice)
  );
}

async function loadImageDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 220;
        canvas.height = img.naturalHeight || 120;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function GenerateQuotePdfButton({
  items,
  customer,
  customerType,
  currency = "CAD",
  filename = "h2-hardware-quote.pdf",
  subtitle = "Order / Quote",
  shippingAddress = "",
}: {
  items: QuoteItem[];
  customer: { name: string; email: string; phone: string };
  customerType: CustomerType;
  currency?: string;
  filename?: string;
  subtitle?: string;
  shippingAddress?: string;
}) {
  const [busy, setBusy] = useState(false);

  const formatCurrency = (v: number) => {
    const safe = Number.isFinite(v) ? v : 0;
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
    }).format(safe);
  };

  async function generatePdf() {
    setBusy(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });

      const marginX = 40;
      let y = 46;

      const logo = await loadImageDataUrl("/h2-logo.svg");
      if (logo) {
        doc.addImage(logo, "PNG", marginX, y - 8, 44, 52);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("H2 Hardware", marginX, y);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(subtitle, 555, y, { align: "right" });

      const dateStr = new Date().toLocaleDateString("en-CA");
      y += 16;
      doc.text(dateStr, 555, y, { align: "right" });

      y += 58;

      doc.setFont("helvetica", "bold");
      doc.text("Customer:", marginX, y);
      doc.setFont("helvetica", "normal");
      doc.text(customer.name || "-", marginX + 70, y);

      doc.setFont("helvetica", "bold");
      doc.text("Email:", 320, y);
      doc.setFont("helvetica", "normal");
      doc.text(customer.email || "-", 370, y);

      y += 16;

      doc.setFont("helvetica", "bold");
      doc.text("Phone:", marginX, y);
      doc.setFont("helvetica", "normal");
      doc.text(customer.phone || "-", marginX + 70, y);

      y += 18;

      doc.setFont("helvetica", "bold");
      doc.text("Shipping address:", marginX, y);
      doc.setFont("helvetica", "normal");
      const addressLines = doc.splitTextToSize(shippingAddress || "-", 395);
      doc.text(addressLines, marginX + 108, y);
      y += Math.max(18, addressLines.length * 13 + 8);

      doc.setDrawColor(220);
      doc.line(marginX, y, 555, y);
      y += 16;

      doc.setFont("helvetica", "bold");
      doc.text("PRODUCT", marginX, y);
      doc.text("PRODUCT ID", 240, y);
      doc.text("QTY", 350, y);
      doc.text("UNIT", 420, y);
      doc.text("SUBTOTAL", 555, y, { align: "right" });

      y += 10;
      doc.setFont("helvetica", "normal");
      doc.line(marginX, y, 555, y);
      y += 18;

      let total = 0;

      for (const it of items || []) {
        const qty = Math.max(1, Math.floor(toNumber(it.qty) || 1));
        const unit = resolveUnitPrice(it, qty, customerType);
        const subtotal = unit * qty;
        const productId = String(it.productId || it.slug || "-");
        total += subtotal;

        doc.setFont("helvetica", "bold");
        const productLines = doc.splitTextToSize(String(it.name || it.slug || "-"), 175);
        doc.text(productLines, marginX, y);

        doc.setFont("helvetica", "normal");
        doc.text(productId, 240, y);
        doc.text(String(qty), 350, y);
        doc.text(formatCurrency(unit), 420, y);
        doc.text(formatCurrency(subtotal), 555, y, { align: "right" });

        y += Math.max(14, productLines.length * 13);

        if (it.model) {
          doc.setFontSize(10);
          doc.text(String(it.model), marginX, y);
          doc.setFontSize(11);
          y += 12;
        }

        y += 8;
        doc.setDrawColor(235);
        doc.line(marginX, y, 555, y);
        y += 18;

        if (y > 740) {
          doc.addPage();
          y = 60;
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Total", 420, y);
      doc.text(formatCurrency(total), 555, y, { align: "right" });

      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        "Taxes not included. Applicable GST/HST/PST may apply. Shipping fees may apply.",
        555,
        y,
        { align: "right", maxWidth: 175 }
      );

      y += 30;
      doc.text(
        "No payment on the site. The team confirms by email.",
        marginX,
        y
      );

      doc.save(filename);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={generatePdf} disabled={busy}>
      {busy ? "Generating PDF..." : "Download PDF"}
    </button>
  );
}
