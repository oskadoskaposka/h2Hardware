import { jsPDF } from "jspdf";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function weight(lb: unknown, kg: unknown) {
  const pounds = num(lb);
  const kilograms = num(kg);
  if (pounds <= 0 && kilograms <= 0) return "";
  return `${pounds.toFixed(pounds >= 100 ? 1 : 2)} lb / ${kilograms.toFixed(kilograms >= 100 ? 1 : 2)} kg`;
}

function header(doc: jsPDF, orderId: string) {
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, PAGE_WIDTH, 66, "F");
  doc.setFillColor(185, 28, 28);
  doc.rect(0, 66, PAGE_WIDTH, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("H2 HARDWARE", MARGIN, 29);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text("ORDER DOCUMENT", MARGIN, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`Order / Copy - ORDER-${orderId.slice(0, 8).toUpperCase()}`, PAGE_WIDTH - MARGIN, 32, { align: "right" });
}

function tableHeader(doc: jsPDF, y: number) {
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

export function createOrderPdfBuffer(orderId: string, data: Record<string, any>) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const customer = (data.customer || {}) as Record<string, unknown>;
  const items = Array.isArray(data.items) ? data.items : [];
  const currency = String(data.currency || "CAD");
  const money = (value: unknown) => new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(num(value));

  header(doc, orderId);
  let y = 84;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("GENERATED", PAGE_WIDTH - MARGIN, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(new Date().toLocaleDateString("en-CA"), PAGE_WIDTH - MARGIN, y + 11, { align: "right" });

  const cardY = 105;
  const gap = 9;
  const cardWidth = (CONTENT_WIDTH - gap) / 2;
  const addressLines = doc.splitTextToSize(String(data.shippingAddress || "Not provided"), cardWidth - 20);
  const cardHeight = Math.max(68, 36 + addressLines.length * 10);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, cardY, cardWidth, cardHeight, 5, 5, "FD");
  doc.roundedRect(MARGIN + cardWidth + gap, cardY, cardWidth, cardHeight, 5, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(185, 28, 28);
  doc.text("CUSTOMER", MARGIN + 10, cardY + 14);
  doc.text("DELIVERY ADDRESS", MARGIN + cardWidth + gap + 10, cardY + 14);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(String(customer.name || "Not provided"), MARGIN + 10, cardY + 30, { maxWidth: cardWidth - 20 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  doc.text(String(customer.email || data.userEmail || "Email not provided"), MARGIN + 10, cardY + 44, { maxWidth: cardWidth - 20 });
  doc.text(String(customer.phone || "Phone not provided"), MARGIN + 10, cardY + 56, { maxWidth: cardWidth - 20 });
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(addressLines, MARGIN + cardWidth + gap + 10, cardY + 30);

  y = tableHeader(doc, cardY + cardHeight + 12);
  const nextPage = () => {
    doc.addPage();
    header(doc, orderId);
    y = tableHeader(doc, 84);
  };

  let total = 0;
  let totalLb = 0;
  let totalKg = 0;
  for (const [index, item] of items.entries()) {
    const qty = Math.max(1, Math.floor(num(item.qty) || 1));
    const unit = num(item.unitPriceApplied ?? item.unitPrice ?? item.unit ?? item.price);
    const subtotal = unit * qty;
    const nameLines = doc.splitTextToSize(String(item.name || item.slug || "Item"), 170);
    const details = [String(item.model || "").trim(), weight(item.totalWeightLb, item.totalWeightKg)].filter(Boolean).join(" | ");
    const rowHeight = Math.max(30, 13 + nameLines.length * 10 + (details ? 9 : 0));
    if (y + rowHeight > PAGE_HEIGHT - 70 || (items.length > 10 && index === items.length - 2 && y > 590)) nextPage();
    total += subtotal;
    totalLb += num(item.totalWeightLb);
    totalKg += num(item.totalWeightKg);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, rowHeight - 3, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(nameLines, MARGIN + 8, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(100, 116, 139);
    if (details) doc.text(details, MARGIN + 8, y + 12 + nameLines.length * 10, { maxWidth: 165 });
    doc.text(String(item.productId || item.slug || "-"), 252, y + 13, { maxWidth: 100 });
    doc.setTextColor(15, 23, 42);
    doc.text(String(qty), 375, y + 13, { align: "right" });
    doc.text(money(unit), 455, y + 13, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(money(subtotal), PAGE_WIDTH - MARGIN - 8, y + 13, { align: "right" });
    y += rowHeight;
  }

  const totalWeight = weight(totalLb, totalKg);
  const summaryHeight = totalWeight ? 78 : 64;
  if (y + summaryHeight > PAGE_HEIGHT - 70) {
    doc.addPage();
    header(doc, orderId);
    y = 84;
  }
  y += 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(320, y, PAGE_WIDTH - MARGIN - 320, summaryHeight, 5, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("ORDER TOTAL", 332, y + 18);
  doc.setFontSize(15);
  doc.setTextColor(185, 28, 28);
  doc.text(money(total || data.total), PAGE_WIDTH - MARGIN - 12, y + 20, { align: "right" });
  if (totalWeight) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Total weight", 332, y + 39);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(totalWeight, PAGE_WIDTH - MARGIN - 12, y + 39, { align: "right" });
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Taxes and shipping fees are not included and may apply.", 332, y + (totalWeight ? 57 : 41), { maxWidth: 200 });
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Our team will contact you to review and finalize this order. No payment is collected on the website.", MARGIN, y + summaryHeight - 6, { maxWidth: 245 });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, PAGE_HEIGHT - 37, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 37);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("H2 Hardware - Order document", MARGIN, PAGE_HEIGHT - 21);
    doc.text(`Page ${page} of ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 21, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
