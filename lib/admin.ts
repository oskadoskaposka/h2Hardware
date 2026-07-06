const DEFAULT_ADMIN_EMAILS = [
  "maia@h2hardwareltd.com",
  "admin@starpro.com",
  "admin@h2hardware.com",
  "admin@h2hardwareltd.com",
];

export const ADMIN_EMAILS = Array.from(
  new Set(
    [
      ...DEFAULT_ADMIN_EMAILS,
      ...(process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ].map((email) => email.trim().toLowerCase()),
  ),
);

export function isAdminEmail(email: string | null | undefined) {
  return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export async function isAdminUser(user: any) {
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;

  try {
    const token = await user.getIdTokenResult();
    return token.claims?.admin === true;
  } catch {
    return false;
  }
}
