"use client";

import { useMemo, useState } from "react";
import jsPDF from "jspdf";

type CatalogProduct = {
  slug: string;
  name: string;
  series?: string;
  category?: string;
  description?: string;
  images?: string[];
  features?: string[];
  sortOrder?: number;
};

const CONTACT_EMAIL = "info@h2hardwareltd.com";
const CONTACT_PHONE = "+1 (226) 788-1924";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function filenameDate() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function groupProducts(products: CatalogProduct[]) {
  const grouped = new Map<string, CatalogProduct[]>();

  for (const product of products) {
    const group = clean(product.series) || "Other";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(product);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([series, items]) => ({
      series,
      items: items
        .slice()
        .sort((a, b) =>
          Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999) ||
          clean(a.name).localeCompare(clean(b.name)),
        ),
    }));
}

async function imageToDataUrl(src: string, maxWidth = 260, maxHeight = 180) {
  const cleanSrc = clean(src);
  if (!cleanSrc) return "";

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const width = Math.max(1, Math.floor(img.width * ratio));
        const height = Math.max(1, Math.floor(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve("");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        resolve("");
      }
    };

    img.onerror = () => resolve("");
    img.src = cleanSrc;
  });
}

function drawRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  doc.setFillColor(fill);
  if (stroke) {
    doc.setDrawColor(stroke);
    doc.roundedRect(x, y, w, h, r, r, "FD");
  } else {
    doc.roundedRect(x, y, w, h, r, r, "F");
  }
}

function addFooter(doc: jsPDF, pageNumber: number) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  doc.setDrawColor("#e5e7eb");
  doc.line(40, height - 42, width - 40, height - 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#64748b");
  doc.text("H2 Hardware Ltd. - Product Catalog", 40, height - 24);
  doc.text(String(pageNumber), width - 40, height - 24, { align: "right" });
}

function ensureSpace(doc: jsPDF, y: number, needed: number, pageNumberRef: { value: number }) {
  const height = doc.internal.pageSize.getHeight();
  if (y + needed <= height - 58) return y;

  addFooter(doc, pageNumberRef.value);
  doc.addPage();
  pageNumberRef.value += 1;
  return 54;
}

export default function DownloadCatalogPdfButton({ products }: { products: CatalogProduct[] }) {
  const [busy, setBusy] = useState(false);

  const activeProducts = useMemo(() => {
    return (products || []).filter((product) => clean(product.slug) && clean(product.name));
  }, [products]);

  async function generatePdf() {
    if (!activeProducts.length || busy) return;

    setBusy(true);

    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const width = doc.internal.pageSize.getWidth();
      const pageNumberRef = { value: 1 };
      const margin = 40;
      let y = 42;

      const logo = await imageToDataUrl("/h2-logo.svg", 110, 70);

      doc.setFillColor("#050505");
      doc.rect(0, 0, width, 112, "F");

      if (logo) {
        doc.addImage(logo, "JPEG", margin, 28, 54, 54);
      } else {
        doc.setFillColor("#ffffff");
        doc.roundedRect(margin, 28, 54, 54, 4, 4, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.setTextColor("#111111");
        doc.text("H2", margin + 27, 58, { align: "center" });
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor("#ffffff");
      doc.text("Product Catalog", margin + 72, 50);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor("#d1d5db");
      doc.text("Garage door hardware products", margin + 72, 68);
      doc.text(`Generated ${new Date().toLocaleDateString("en-CA")}`, margin + 72, 84);

      y = 142;

      drawRoundedRect(doc, margin, y, width - margin * 2, 76, 12, "#ffffff", "#e5e7eb");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor("#b91c1c");
      doc.text("H2 Hardware Ltd.", margin + 18, y + 24);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor("#334155");
      doc.text(`Email: ${CONTACT_EMAIL}`, margin + 18, y + 42);
      doc.text(`Phone: ${CONTACT_PHONE}`, margin + 18, y + 58);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor("#111827");
      doc.text("Pricing available after sign in", width - margin - 18, y + 30, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.8);
      doc.setTextColor("#64748b");
      doc.text("Approved customers can view pricing and place orders online.", width - margin - 18, y + 48, { align: "right" });

      y += 104;

      const grouped = groupProducts(activeProducts);

      for (const group of grouped) {
        y = ensureSpace(doc, y, 40, pageNumberRef);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor("#111827");
        doc.text(group.series, margin, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor("#64748b");
        doc.text(`${group.items.length} product${group.items.length === 1 ? "" : "s"}`, width - margin, y, { align: "right" });

        y += 14;
        doc.setDrawColor("#b91c1c");
        doc.setLineWidth(1.5);
        doc.line(margin, y, width - margin, y);
        y += 18;

        for (const product of group.items) {
          const cardHeight = 96;
          y = ensureSpace(doc, y, cardHeight + 14, pageNumberRef);

          drawRoundedRect(doc, margin, y, width - margin * 2, cardHeight, 12, "#ffffff", "#e5e7eb");

          const image = await imageToDataUrl(product.images?.[0] || "", 120, 90);
          const imageX = margin + 12;
          const imageY = y + 12;
          const imageW = 72;
          const imageH = 72;

          doc.setFillColor("#f8fafc");
          doc.roundedRect(imageX, imageY, imageW, imageH, 8, 8, "F");

          if (image) {
            doc.addImage(image, "JPEG", imageX + 4, imageY + 4, imageW - 8, imageH - 8);
          } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor("#94a3b8");
            doc.text("No image", imageX + imageW / 2, imageY + imageH / 2 + 3, { align: "center" });
          }

          const contentX = margin + 100;
          const contentW = width - margin * 2 - 118;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11.5);
          doc.setTextColor("#111827");
          const nameLines = doc.splitTextToSize(clean(product.name), contentW - 98).slice(0, 2);
          doc.text(nameLines, contentX, y + 24);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.8);
          doc.setTextColor("#64748b");
          const meta = [clean(product.category), `Item code: ${clean(product.slug)}`].filter(Boolean).join("  |  ");
          doc.text(doc.splitTextToSize(meta, contentW).slice(0, 1), contentX, y + 52);

          const description = clean(product.description);
          if (description) {
            doc.setTextColor("#475569");
            doc.text(doc.splitTextToSize(description, contentW).slice(0, 2), contentX, y + 68);
          } else if (Array.isArray(product.features) && product.features.length > 0) {
            doc.setTextColor("#475569");
            doc.text(doc.splitTextToSize(clean(product.features[0]), contentW).slice(0, 2), contentX, y + 68);
          }

          y += cardHeight + 12;
        }

        y += 6;
      }

      addFooter(doc, pageNumberRef.value);
      doc.save(`h2-hardware-catalog-${filenameDate()}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={generatePdf}
      disabled={busy || activeProducts.length === 0}
      className="catalogPdfButton"
      title="Download product catalog as PDF"
    >
      {busy ? "Preparing PDF..." : "Download Catalog PDF"}
    </button>
  );
}
