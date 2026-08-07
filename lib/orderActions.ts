import type { User } from "firebase/auth";

export async function orderAction(user: User, data: Record<string, unknown>) {
  const response = await fetch("/api/orders/action", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Order action failed.");
  return result;
}
