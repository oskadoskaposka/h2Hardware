"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, getDocs, getFirestore, orderBy, query } from "firebase/firestore";

import { auth, app } from "../../../lib/firebaseClient";
import { isAdminEmail } from "../../../lib/admin";

const functions = getFunctions(app, "us-central1");
const approveRegistrationRequestFn = httpsCallable(functions, "approveRegistrationRequest");
const disableRegistrationUserFn = httpsCallable(functions, "disableRegistrationUser");

type RegistrationRequestDoc = {
  id: string;
  name: string;
  email: string;
  company: string;
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
  return [item.id, item.name, item.email, item.company, item.status || "", item.authUid || ""]
    .join(" ")
    .toLowerCase();
}

function getReadableError(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }

  return "Action failed.";
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
    const unsub = onAuthStateChanged(auth, (u) => {
      setIsAdmin(isAdminEmail(u?.email));
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
      const col = collection(db, "registration_requests");
      const qq = query(col, orderBy("createdAt", "desc"));
      const snap = await getDocs(qq);

      const list: RegistrationRequestDoc[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: String(data.name ?? "").trim(),
          email: String(data.email ?? "").trim(),
          company: String(data.company ?? "").trim(),
          status: String(data.status ?? "new").trim(),
          authUid: String(data.authUid ?? "").trim(),
          createdAt: data.createdAt,
        };
      });

      setItems(list);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load registration requests.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadRegistrationRequests();
  }, [loadRegistrationRequests]);

  async function handleApprove(item: RegistrationRequestDoc) {
    const label = item.status === "disabled" ? "approve and re-enable" : "approve and create";
    const confirmed = window.confirm(`Do you want to ${label} the Firebase user for ${item.email}?`);

    if (!confirmed) return;

    try {
      setError(null);
      setActionMessage(null);
      setBusyAction({ id: item.id, type: "approve" });

      const result = await approveRegistrationRequestFn({ requestId: item.id });
      const data = result.data as UserActionResult;

      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? {
                ...current,
                status: "approved",
                authUid: data.uid || current.authUid,
              }
            : current
        )
      );

      setActionMessage(
        data.created
          ? `User approved and created for ${item.email}. Ask the customer to use Forgot password on the login page to set their password.`
          : `User approved and enabled for ${item.email}.`
      );
    } catch (e) {
      setError(getReadableError(e));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisable(item: RegistrationRequestDoc) {
    const confirmed = window.confirm(`Disable login access for ${item.email}?`);

    if (!confirmed) return;

    try {
      setError(null);
      setActionMessage(null);
      setBusyAction({ id: item.id, type: "disable" });

      const result = await disableRegistrationUserFn({ requestId: item.id });
      const data = result.data as UserActionResult;

      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? {
                ...current,
                status: "disabled",
                authUid: data.uid || current.authUid,
              }
            : current
        )
      );

      setActionMessage(`User disabled for ${item.email}.`);
    } catch (e) {
      setError(getReadableError(e));
    } finally {
      setBusyAction(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => toSearchText(item).includes(q));
  }, [items, search]);

  if (!isAdmin) {
    return <p style={{ padding: 24 }}>Access denied.</p>;
  }

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
            <Link href="/registration-request" style={{ fontWeight: 800, color: "#b91c1c", textDecoration: "none" }}>
              Public request form
            </Link>
            <Link href="/admin/orders" style={{ fontWeight: 800, color: "#b91c1c", textDecoration: "none" }}>
              Orders
            </Link>
            <Link href="/admin/products" style={{ fontWeight: 800, color: "#b91c1c", textDecoration: "none" }}>
              Manage products
            </Link>
          </div>
        </div>

        <div style={{ marginTop: 14, background: "rgba(185, 28, 28, 0.06)", border: "1px solid rgba(185, 28, 28, 0.18)", borderLeft: "6px solid #b91c1c", borderRadius: 12, padding: 14, color: "#7f1d1d", fontSize: 13, fontWeight: 700 }}>
          Approve creates or enables the Firebase Auth user. Disable blocks login access without deleting the request history.
        </div>

        {actionMessage ? (
          <div style={{ marginTop: 14, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.24)", borderLeft: "6px solid #10b981", borderRadius: 12, padding: 14, color: "#065f46", fontSize: 13, fontWeight: 800 }}>
            {actionMessage}
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search: name, email, company, status..."
            style={{ width: "100%", minHeight: 42, padding: "0 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", outline: "none" }}
          />
        </div>

        {error ? (
          <div style={{ marginTop: 16, background: "#fff", border: "1px solid rgba(185,28,28,.25)", borderLeft: "6px solid #b91c1c", borderRadius: 12, padding: 14 }}>
            <strong>Admin error:</strong> {error}
          </div>
        ) : loading ? (
          <div style={{ marginTop: 16, color: "#64748b" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ marginTop: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 900, color: "#0f172a" }}>No registration requests found</div>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>Try a different search.</div>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {filtered.map((item) => {
              const dt = item.createdAt?.toDate?.() instanceof Date ? item.createdAt.toDate() : null;
              const status = (item.status || "new").toLowerCase();
              const isActionBusy = busyAction?.id === item.id;
              const isAnyActionBusy = busyAction !== null;
              const approveLabel = status === "disabled" ? "Approve / Enable User" : "Approve / Create User";

              return (
                <div key={item.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, boxShadow: "0 1px 0 rgba(15,23,42,.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 260 }}>
                      <div style={{ fontWeight: 950 as any, color: "#0f172a", fontSize: 18, letterSpacing: 0.1 }}>
                        {item.name || "Unnamed requester"}
                      </div>
                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
                        Company: <strong style={{ color: "#0f172a" }}>{item.company || "—"}</strong>
                      </div>
                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                        ID: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{item.id}</span>
                      </div>
                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                        {dt ? dt.toLocaleString("en-CA") : "—"}
                      </div>
                    </div>

                    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 84, height: 32, padding: "0 12px", borderRadius: 999, background: status === "disabled" ? "rgba(15, 23, 42, 0.08)" : "rgba(185, 28, 28, 0.08)", color: status === "disabled" ? "#334155" : "#b91c1c", border: status === "disabled" ? "1px solid rgba(15, 23, 42, 0.16)" : "1px solid rgba(185, 28, 28, 0.18)", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {item.status || "new"}
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    <InfoRow label="Name" value={item.name || "—"} />
                    <InfoRow label="Email" value={item.email ? <a href={`mailto:${item.email}`} style={{ color: "#b91c1c", fontWeight: 800 }}>{item.email}</a> : "—"} />
                    <InfoRow label="Company" value={item.company || "—"} />
                    {item.authUid ? <InfoRow label="Firebase UID" value={item.authUid} /> : null}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eef2f7", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {status !== "approved" ? (
                      <button
                        type="button"
                        onClick={() => handleApprove(item)}
                        disabled={isAnyActionBusy}
                        style={{ minHeight: 38, padding: "0 14px", borderRadius: 10, border: "none", background: "#b91c1c", color: "#fff", cursor: isAnyActionBusy ? "not-allowed" : "pointer", fontWeight: 900, opacity: isAnyActionBusy && !isActionBusy ? 0.55 : 1 }}
                      >
                        {isActionBusy && busyAction?.type === "approve" ? "Approving…" : approveLabel}
                      </button>
                    ) : null}

                    {status === "approved" ? (
                      <button
                        type="button"
                        onClick={() => handleDisable(item)}
                        disabled={isAnyActionBusy}
                        style={{ minHeight: 38, padding: "0 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", cursor: isAnyActionBusy ? "not-allowed" : "pointer", fontWeight: 900, opacity: isAnyActionBusy && !isActionBusy ? 0.55 : 1 }}
                      >
                        {isActionBusy && busyAction?.type === "disable" ? "Disabling…" : "Disable User"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 12, background: "#fbfcfd", minWidth: 0 }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}
