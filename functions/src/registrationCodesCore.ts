import { createHash } from "crypto";

export const ACCESS_CODE_MIN_LENGTH = 10;
export const ACCESS_CODE_MAX_LENGTH = 64;

export function normalizeAccessCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isValidAccessCode(value: unknown) {
  const code = normalizeAccessCode(value);
  return (
    code.length >= ACCESS_CODE_MIN_LENGTH &&
    code.length <= ACCESS_CODE_MAX_LENGTH &&
    /^[A-Z0-9_-]+$/.test(code)
  );
}

export function accessCodeHash(value: unknown) {
  return createHash("sha256").update(normalizeAccessCode(value)).digest("hex");
}

export function accessCodePreview(value: unknown) {
  const code = normalizeAccessCode(value);
  if (!code) return "";
  if (code.length <= 8) return `${code.slice(0, 2)}••••${code.slice(-2)}`;
  return `${code.slice(0, 4)}••••${code.slice(-4)}`;
}
