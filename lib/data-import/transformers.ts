import type { ImportCell, TransformKind } from "./types";

function normalizeNumericString(value: string) {
  const raw = value.trim().replace(/\s+/g, "");
  if (!raw) return "";

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    const commaIsDecimal = raw.lastIndexOf(",") > raw.lastIndexOf(".");
    return commaIsDecimal
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  }

  if (hasComma) return raw.replace(",", ".");
  return raw;
}

export function toNumber(value: ImportCell) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  const normalized = normalizeNumericString(String(value ?? ""));
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function toBoolean(value: ImportCell) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (["true", "1", "yes", "y", "sim", "s", "active", "ativo"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "nao", "não", "inactive", "inativo"].includes(normalized)) return false;
  return null;
}

export function toIsoDate(value: ImportCell) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function slugify(value: ImportCell) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function transformValue(value: ImportCell, transform: TransformKind): unknown {
  switch (transform) {
    case "number":
    case "currency":
      return toNumber(value);
    case "boolean":
      return toBoolean(value);
    case "date":
      return toIsoDate(value);
    case "slug":
      return slugify(value);
    case "text":
    default:
      return String(value ?? "").trim();
  }
}
