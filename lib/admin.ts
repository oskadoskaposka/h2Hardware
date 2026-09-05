export const SUPER_ADMIN_EMAILS = [
  "maia@h2hardwareltd.com",
  "admin@starpro.com",
  "admin@h2hardware.com",
  "admin@h2hardwareltd.com",
] as const;

function normalizeEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

export function isSuperAdminEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  return !!normalized && SUPER_ADMIN_EMAILS.includes(normalized as (typeof SUPER_ADMIN_EMAILS)[number]);
}

/**
 * Kept for backwards compatibility with older imports.
 * Fixed email based access is now reserved for the four protected super admins.
 * Every other admin must be granted the Firebase custom claim `admin: true`.
 */
export function isAdminEmail(email: string | null | undefined) {
  return isSuperAdminEmail(email);
}

export async function isAdminUser(user: any) {
  if (!user) return false;
  if (isSuperAdminEmail(user.email)) return true;

  try {
    const token = await user.getIdTokenResult();
    return token.claims?.admin === true;
  } catch {
    return false;
  }
}
