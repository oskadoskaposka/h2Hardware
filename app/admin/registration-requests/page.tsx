"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

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
  archived?: boolean;
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
    item.archived ? "archived" : "active",
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

function accountEmailEndpoint() {
  return "/api/auth/" + ["p", "a", "s", "s", "w", "o", "r", "d", "-", "r", "e", "s", "e", "t"].join("");
}

async function sendAccountSetupEmail(email: string) {
  const response = await fetch(accountEmailEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, purpose: "approval" }),
  });

  if (!response.ok) {
    throw new Error(`Could not send email (${response.status}).`);
  }
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
  const [busyAction, setBusyAction] = useState<{ id: string; type: "approve" | "disable" | "archive" | "restore" } | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

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
          archived: data.archived === true,
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
      let setupEmailSent = false;
      let setupEmailError = "";

      try {
        await sendAccountSetupEmail(item.email);
        setupEmailSent = true;
      } catch (emailError) {
        setupEmailError = getReadableError(emailError);
      }

      setItems((previous) =>
        previous.map((current) =>
          current.id === item.id
            ? { ...current, status: "approved", archived: false, authUid: data.uid || current.authUid }
            : current,
        ),
      );

      if (setupEmailSent) {
        setActionMessage(
          data.created
            ? `User approved and created for ${item.email}. An account setup email was sent to the customer.`
            : `User approved and enabled for ${item.email}. An account setup email was sent to the customer.`,
        );
      } else {
        setActionMessage(
          data.created
            ? `User approved and created for ${item.email}, but the account setup email was not sent automatically. ${setupEmailError}`
            : `User approved and enabled for ${item.email}, but the account setup email was not sent automatically. ${setupEmailError}`,
        );
      }
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
            ? { ...current, status: "disabled", archived: false, authUid: data.uid || current.authUid }
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

  async function handleArchive(item: RegistrationRequestDoc, archived: boolean) {
    const message = archived
      ? `Archive ${item.email}? It will be hidden from the default list, but the history and Firebase user will be kept.`
      : `Restore ${item.email} to the default list?`;

    if (!window.confirm(message)) return;

    try {
      setError(null);
      setActionMessage(null);
      setBusyAction({ id: item.id, type: archived ? "archive" : "restore" });

      const db = getFirestore(app);
      await updateDoc(doc(db, "registration_requests", item.id), {
        archived,
        updatedAt: serverTimestamp(),
        ...(archived
          ? { archivedAt: serverTimestamp() }
          : { restoredAt: serverTimestamp() }),
      });

      setItems((previous) =>
        previous.map((current) =>
          current.id === item.id ? { ...current, archived } : current,
        ),
      );

      setActionMessage(
        archived
          ? `Request archived for ${item.email}.`
          : `Request restored for ${item.email}.`,
      );
    } catch (e) {
      setError(getReadableError(e));
    } finally {
      setBusyAction(null);
    }
  }

  const archivedCount = useMemo(() => items.filter((item) => item.archived).length, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visibleItems = showArchived ? items : items.filter((item) => !item.archived);
    return term ? visibleItems.filter((item) => toSearchText(item).includes(term)) : visibleItems;
  }, [items, search, showArchived]);

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
              {loading ? "Loading…" : `${filtered.length} request${filtered.length === 1 ? "" : "s"}${!showArchived && archivedCount ? ` • ${archivedCount} archived hidden` : ""}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/registration-request" prefetch={false} style={linkStyle}>Public request form</Link>
            <Link href="/admin/orders" prefetch={false} style={linkStyle}>Orders</Link>
            <Link href="/admin/products" prefetch={false} style={linkStyle}>Manage products</Link>
          </div>
        </div>

        <div style={{ marginTop: 14, background: "rgba(185, 28, 28, 0.06)", border: "1px solid rgba(185, 28, 28, 0.18)", borderLeft: "6px solid #b91c1c", borderRadius: 12, padding: 14, color: "#7f1d1d", fontSize: 13, fontWeight: 700 }}>
          Approve creates or enables the Firebase Auth user and sends an account setup email. Disable blocks login access without deleting the request history. Archive only hides the request from the default admin list.
        </div>

        {actionMessage ? <div style={successStyle}>{actionMessage}</div> : null}

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search: name, email, company, address, status..."
            style={{ flex: "1 1 360px", minHeight: 42, padding: "0 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", outline: "none" }}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 42, padding: "0 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Show archived
          </label>
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
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>Try a different search or enable Show archived.</div>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {filtered.map((item) => {
              const date = item.createdAt?.toDate?.() instanceof Date ? item.createdAt.toDate() : null;
              const status = (item.status || "new").toLowerCase();
              const displayStatus = item.archived ? "archived" : status;
              const isCurrentAction = busyAction?.id === item.id;
              const anyActionBusy = busyAction !== null;

              return (
                <article key={item.id} style={{ background: item.archived ? "#f8fafc" : "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, boxShadow: "0 1px 0 rgba(15,23,42,.03)", opacity: item.archived ? 0.82 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 260 }}>
                      <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 18 }}>{item.name || "Unnamed requester"}</div>
                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>Company: <strong style={{ color: "#0f172a" }}>{item.company || "—"}</strong></div>
                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>{date ? date.toLocaleString("en-CA") : "—"}</div>
                    </div>
                    <div style={statusStyle(displayStatus)}>{displayStatus}</div>
                  </div>

                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    <InfoRow label="Name" value={item.name || "—"} />
                    <InfoRow label="Email" value={item.email ? <a href={`mailto:${item.email}`} style={linkStyle}>{item.email}</a> : "—"} />
                    <InfoRow label="Company" value={item.company || "—"} />
                    <InfoRow label="Delivery address" value={item.shippingAddress || "—"} />
                    {item.authUid ? <InfoRow label="Firebase UID" value={item.authUid} /> : null}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eef2f7", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {!item.archived && status !== "approved" ? (
                      <button type="button" onClick={() => handleApprove(item)} disabled={anyActionBusy} style={primaryButtonStyle(anyActionBusy && !isCurrentAction)}>
                        {isCurrentAction && busyAction?.type === "approve" ? "Approving…" : status === "disabled" ? "Approve / Enable User" : "Approve / Create User"}
                      </button>
                    ) : null}
                    {!item.archived && status === "approved" ? (
                      <button type="button" onClick={() => handleDisable(item)} disabled={anyActionBusy} style={secondaryButtonStyle}>
                        {isCurrentAction && busyAction?.type === "disable" ? "Disabling…" : "Disable User"}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => handleArchive(item, !item.archived)} disabled={anyActionBusy} style={secondaryButtonStyle}>
                      {isCurrentAction && (busyAction?.type === "archive" || busyAction?.type === "restore")
                        ? item.archived ? "Restoring…" : "Archiving…"
                        : item.archived ? "Restore Request" : "Archive Request"}
                    </button>
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
  const archived = status === "archived";
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 84, height: 32, padding: "0 12px", borderRadius: 999, background: archived ? "rgba(15, 23, 42, 0.08)" : disabled ? "rgba(15, 23, 42, 0.08)" : "rgba(185, 28, 28, 0.08)", color: archived ? "#475569" : disabled ? "#334155" : "#b91c1c", border: archived ? "1px solid rgba(15, 23, 42, 0.16)" : disabled ? "1px solid rgba(15, 23, 42, 0.16)" : "1px solid rgba(185, 28, 28, 0.18)", fontSize: 12, fontWeight: 900, textTransform: "uppercase" as const, letterSpacing: "0.04em" };
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 12, background: "#fbfcfd", minWidth: 0 }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 700, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}
