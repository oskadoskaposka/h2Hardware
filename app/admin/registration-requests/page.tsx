"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getFirestore } from "firebase/firestore";

import { auth, app } from "../../../lib/firebaseClient";
import { isAdminEmail } from "../../../lib/admin";

type RegistrationRequestDoc = {
  id: string;
  name: string;
  email: string;
  company: string;
  shippingAddress?: string;
  status?: string;
  authUid?: string;
  createdAt?: any;
};

type UserActionResult = {
  ok?: boolean;
  created?: boolean;
  uid?: string;
  email?: string;
};

function toSearchText(item: RegistrationRequestDoc) {
  return [
    item.id,
    item.name,
    item.email,
    item.company,
    item.shippingAddress || "",
    item.status || "",
    item.authUid || "",
  ]
    .join(" ")
    .toLowerCase();
}

function toMillis(value: any) {
  const date = value?.toDate?.();
  return date instanceof Date ? date.getTime() : 0;
}

function getReadableError(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }

  return "Action failed.";
}

async function callAdminRegistrationAction(action: "approve" | "disable", requestId: string) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Admin login is required.");
  }

  const token = await user.getIdToken();
  const response = await fetch(`/api/admin/registration-requests/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requestId }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(data?.error || `Action failed (${response.status}).`));
  }

  return data as UserActionResult;
}

export default function AdminRegistrationRequestsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RegistrationRequestDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<{ id: string; type: "approve" | "disable" } | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAdmin(isAdminEmail(user?.email));
    });

    return () => unsub();
  }, []);

  const loadRegistrationRequests = useCallback(async () => {
    if (!isAdmin) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const db = getFirestore(app);
      // Do not rely on Firestore server-side orderBy here. Existing historical
      // requests can have inconsistent timestamps, and a plain collection read
      // keeps the page available even when the ordered query fails.
      const snap = await getDocs(collection(db, "registration_requests"));

      const list: RegistrationRequestDoc[] = snap.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: String(data.name ?? "").trim(),
          email: String(data.email ?? "").trim(),
          company: String(data.company ?? "").trim(),
          shippingAddress: String(data.shippingAddress ?? data.deliveryAddress ?? "").trim(),
          status: String(data.status ?? "new").trim(),
          authUid: String(data.authUid ?? "").trim(),
          createdAt: data.createdAt,
        };
      });

      list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setItems(list);
    } catch (e) {
      setError(getReadableError(e));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadRegistrationRequests();
  }, [loadRegistrationRequests]);

  async function handleApprove(item: RegistrationRequestDoc) {
    const action = item.status === "disabled" ? "approve and re-enable" : "approve and create";
    if (!window.confirm(`Do you want to ${action} the Firebase user for ${item.email}?`)) return;

    try {
      setError(null);
      setActionMessage(null);
      setBusyAction({ id: item.id, type: "approve" });

      const data = await callAdminRegistrationAction("approve", item.id);

      setItems((previous) =>
        previous.map((current) =>
          current.id === item.id
            ? { ...current, status: "approved", authUid: data.uid || current.authUid }
            : current,
        ),
      );

      setActionMessage(
        data.created
          ? `User approved and created for ${item.email}. Ask the customer to use Forgot password on the login page to set their password.`
          : `User approved and enabled for ${item.email}.`,
      );
    } catch (e) {
      setError(getReadableError(e));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisable(item: RegistrationRequestDoc) {
    if (!window.confirm(`Disable login access for ${item.email}?`)) return;

    try {
      setError(null);
      setActionMessage(null);
      setBusyAction({ id: item.id, type: "disable" });

      const data = await callAdminRegistrationAction("disable", item.id);

      setItems((previous) =>
        previous.map((current) =>
          current.id === item.id
            ? { ...current, status: "disabled", authUid: data.uid || current.authUid }
            : current,
        ),
      );

      setActionMessage(`User disabled for ${item.email}.`);
    } catch (e) {
      setError(getReadableError(e));
    } finally {
      setBusyAction(null);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => toSearchText(item).includes(term)) : items;
  }, [items, search]);

  if (!isAdmin) return <p style={{ padding: 24 }}>Access denied.</p>;

  return (
    <main style={{ padding: 24, background: "#f4f6f8", minHeight: "70vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 18px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0f172a", letterSpacing: -0.2 }}>
              Registration Requests
            </h1>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
              {loading ? "Loading…" : `${filtered.length} request${filtered.length === 1 ? "" : "s"}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/registration-request" prefetch={false} style={linkStyle}>Public request form</Link>
            <Link href="/admin/orders" prefetch={false} style={linkStyle}>Orders</Link>
            <Link href="/admin/products" prefetch={false} style={linkStyle}>Manage products</Link>
          </div>
        </div>

        <div style={{ marginTop: 14, background: "rgba(185, 28, 28, 0.06)", border: "1px solid rgba(185, 28, 28, 0.18)", borderLeft: "6px solid #b91c1c", borderRadius: 12, padding: 14, color: "#7f1d1d", fontSize: 13, fontWeight: 700 }}>
          Approve creates or enables the Firebase Auth user. Disable blocks login access without deleting the request history.
        </div>

        {actionMessage ? <div style={successStyle}>{actionMessage}</div> : null}

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search: name, email, company, address, status..."
            style={{ width: "100%", minHeight: 42, padding: "0 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", outline: "none" }}
          />
          <button type="button" onClick={loadRegistrationRequests} disabled={loading} style={secondaryButtonStyle}>
            Refresh
          </button>
        </div>

        {error ? (
          <div style={errorStyle}>
            <strong>Admin error:</strong> {error}
          </div>
        ) : loading ? (
          <div style={{ marginTop: 16, color: "#64748b" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={emptyStyle}>
            <div style={{ fontWeight: 900, color: "#0f172a" }}>No registration requests found</div>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>Try a different search.</div>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {filtered.map((item) => {
              const date = item.createdAt?.toDate?.() instanceof Date ? item.createdAt.toDate() : null;
              const status = (item.status || "new").toLowerCase();
              const isCurrentAction = busyAction?.id === item.id;
              const anyActionBusy = busyAction !== null;

              return (
                <article key={item.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, boxShadow: "0 1px 0 rgba(15,23,42,.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 260 }}>
                      <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 18 }}>{item.name || "Unnamed requester"}</div>
                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>Company: <strong style={{ color: "#0f172a" }}>{item.company || "—"}</strong></div>
                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>{date ? date.toLocaleString("en-CA") : "—"}</div>
                    </div>
                    <div style={statusStyle(status)}>{item.status || "new"}</div>
                  </div>

                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    <InfoRow label="Name" value={item.name || "—"} />
                    <InfoRow label="Email" value={item.email ? <a href={`mailto:${item.email}`} style={linkStyle}>{item.email}</a> : "—"} />
                    <InfoRow label="Company" value={item.company || "—"} />
                    <InfoRow label="Delivery address" value={item.shippingAddress || "—"} />
                    {item.authUid ? <InfoRow label="Firebase UID" value={item.authUid} /> : null}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eef2f7", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {status !== "approved" ? (
                      <button type="button" onClick={() => handleApprove(item)} disabled={anyActionBusy} style={primaryButtonStyle(anyActionBusy && !isCurrentAction)}>
                        {isCurrentAction && busyAction?.type === "approve" ? "Approving…" : status === "disabled" ? "Approve / Enable User" : "Approve / Create User"}
                      </button>
                    ) : null}
                    {status === "approved" ? (
                      <button type="button" onClick={() => handleDisable(item)} disabled={anyActionBusy} style={secondaryButtonStyle}>
                        {isCurrentAction && busyAction?.type === "disable" ? "Disabling…" : "Disable User"}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

const linkStyle = { fontWeight: 800, color: "#b91c1c", textDecoration: "none" };
const successStyle = { marginTop: 14, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.24)", borderLeft: "6px solid #10b981", borderRadius: 12, padding: 14, color: "#065f46", fontSize: 13, fontWeight: 800 };
const errorStyle = { marginTop: 16, background: "#fff", border: "1px solid rgba(185,28,28,.25)", borderLeft: "6px solid #b91c1c", borderRadius: 12, padding: 14 };
const emptyStyle = { marginTop: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 };
const secondaryButtonStyle = { minHeight: 42, padding: "0 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", cursor: "pointer", fontWeight: 900 };

function primaryButtonStyle(dimmed: boolean) {
  return { minHeight: 38, padding: "0 14px", borderRadius: 10, border: "none", background: "#b91c1c", color: "#fff", cursor: dimmed ? "not-allowed" : "pointer", fontWeight: 900, opacity: dimmed ? 0.55 : 1 };
}

function statusStyle(status: string) {
  const disabled = status === "disabled";
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 84, height: 32, padding: "0 12px", borderRadius: 999, background: disabled ? "rgba(15, 23, 42, 0.08)" : "rgba(185, 28, 28, 0.08)", color: disabled ? "#334155" : "#b91c1c", border: disabled ? "1px solid rgba(15, 23, 42, 0.16)" : "1px solid rgba(185, 28, 28, 0.18)", fontSize: 12, fontWeight: 900, textTransform: "uppercase" as const, letterSpacing: "0.04em" };
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 12, background: "#fbfcfd", minWidth: 0 }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 700, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}
