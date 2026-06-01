const DEFAULT_ADMIN_EMAILS = ["maia@h2hardwareltd.com"];

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
