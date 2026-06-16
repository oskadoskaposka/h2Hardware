"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import { formatWeight } from "../lib/weight";

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
  unitWeightLb?: number;
  unitWeightKg?: number;
  totalWeightLb?: number;
  totalWeightKg?: number;
};

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

export default function GenerateWeightedQuotePdfButton({
  items,
  customer,
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

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
    }).format(toNumber(value));
  }

  async function generatePdf() {
    setBusy(true);

    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const marginX = 40;
      let y = 48;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("H2 Hardware", marginX, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(subtitle, 555, y, { align: "right" });
      y += 16;
      doc.text(new Date().toLocaleDateString("en-CA"), 555, y, { align: "right" });

      y += 44;
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
      doc.line(marginX, y, 555, y);
      y += 18;

      let total = 0;
      let totalWeightLb = 0;
      let totalWeightKg = 0;

      for (const item of items || []) {
        const qty = Math.max(1, Math.floor(toNumber(item.qty) || 1));
        const unit = toNumber(item.unitPrice) || toNumber(item.unit) || toNumber(item.price) || toNumber(item.publicPrice);
        const subtotal = unit * qty;
        const productId = String(item.productId || item.slug || "-");
        const unitWeight = weightText(item.unitWeightLb, item.unitWeightKg);
        const totalWeight = weightText(item.totalWeightLb, item.totalWeightKg);

        total += subtotal;
        totalWeightLb += toNumber(item.totalWeightLb);
        totalWeightKg += toNumber(item.totalWeightKg);

        doc.setFont("helvetica", "bold");
        const productLines = doc.splitTextToSize(String(item.name || item.slug || "-"), 175);
        doc.text(productLines, marginX, y);

        doc.setFont("helvetica", "normal");
        doc.text(productId, 240, y);
        doc.text(String(qty), 350, y);
        doc.text(formatCurrency(unit), 420, y);
        doc.text(formatCurrency(subtotal), 555, y, { align: "right" });

        y += Math.max(14, productLines.length * 13);

        if (item.model) {
          doc.setFontSize(10);
          doc.text(String(item.model), marginX, y);
          doc.setFontSize(11);
          y += 12;
        }

        if (unitWeight) {
          doc.setFontSize(10);
          doc.text(`Unit weight: ${unitWeight}`, marginX, y);
          doc.setFontSize(11);
          y += 12;
        }

        if (totalWeight) {
          doc.setFontSize(10);
          doc.text(`Total weight: ${totalWeight}`, marginX, y);
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

      const finalWeight = weightText(totalWeightLb, totalWeightKg);
      if (finalWeight) {
        y += 16;
        doc.setFontSize(11);
        doc.text("Total weight", 420, y);
        doc.text(finalWeight, 555, y, { align: "right" });
      }

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
      doc.text("No payment on the site. The team confirms by email.", marginX, y);

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
