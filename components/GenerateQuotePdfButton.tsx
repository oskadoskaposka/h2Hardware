"use client";

import jsPDF from "jspdf";

type CustomerType = "avulso" | "regular" | "tiered";

type QuoteItem = {
  slug: string;
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

export default function GenerateQuotePdfButton({
  items,
  customer,
  customerType,
  currency = "CAD",
  filename = "starpro-quote.pdf",
  title = "StarPro",
  subtitle = "Order / Quote",
}: {
  items: QuoteItem[];
  customer: { name: string; email: string; phone: string };
  customerType: CustomerType;
  currency?: string;
  filename?: string;
  title?: string;
  subtitle?: string;
}) {
  const formatCurrency = (v: number) => {
    const safe = Number.isFinite(v) ? v : 0;
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
    }).format(safe);
  };

  function mapCustomerTypeLabel(t: CustomerType) {
    if (t === "regular") return "regular";
    if (t === "avulso") return "retail";
    return "tiered";
  }

  function generatePdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const marginX = 40;
    let y = 50;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, marginX, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    y += 18;
    doc.text(subtitle, marginX, y);

    const dateStr = new Date().toLocaleDateString("en-CA");
    doc.text(dateStr, 555, y, { align: "right" });

    y += 24;

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

    doc.setFont("helvetica", "bold");
    doc.text("Type:", 320, y);
    doc.setFont("helvetica", "normal");
    doc.text(mapCustomerTypeLabel(customerType), 370, y);

    y += 26;

    doc.setDrawColor(220);
    doc.line(marginX, y, 555, y);
    y += 16;

    doc.setFont("helvetica", "bold");
    doc.text("PRODUCT", marginX, y);
    doc.text("QTY", 360, y);
    doc.text("UNIT", 430, y);
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
      total += subtotal;

      doc.setFont("helvetica", "bold");
      doc.text(String(it.name || it.slug || "-"), marginX, y);

      doc.setFont("helvetica", "normal");
      y += 14;
      doc.text(String(it.model || ""), marginX, y);

      doc.text(String(qty), 360, y - 14);
      doc.text(formatCurrency(unit), 430, y - 14);
      doc.text(formatCurrency(subtotal), 555, y - 14, { align: "right" });

      y += 14;
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
    doc.text("Total", 430, y);
    doc.text(formatCurrency(total), 555, y, { align: "right" });

    // ✅ Taxes / shipping note (below total)
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      "Taxes not included. Applicable GST/HST/PST may apply. Shipping fees may apply.",
      430,
      y,
      { align: "right", maxWidth: 125 }
    );

    y += 26;
    doc.text(
      "No payment on the site. The team confirms by email.",
      marginX,
      y
    );

    doc.save(filename);
  }

  return (
    <button type="button" onClick={generatePdf}>
      Download PDF
    </button>
  );
}
