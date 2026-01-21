"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { auth, app } from "../../lib/firebaseClient";

type OrderItem = {
  slug: string;
  name?: string;
  qty: number;

  // legacy
  unitPrice?: number;

  // preferred snapshot (newer)
  unitPriceApplied?: number;
  tierApplied?: string | null;
};

type OrderDoc = {
  id: string;
  uid: string;
  userEmail?: string;
  createdAt?: any; // Timestamp
  total: number;
  currency: string;
  items: OrderItem[];
};

const PAGE_SIZE = 40;

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(currency: string, value: number) {
  const v = safeNumber(value);
  try {
    return v.toLocaleString("en-CA", { style: "currency", currency });
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

function orderLabel(id: string) {
  const short = String(id || "").slice(0, 8).toUpperCase();
  return `ORDER-${short}`;
}

function toSearchText(o: OrderDoc, email?: string | null) {
  const idFull = (o.id || "").toLowerCase();
  const idShort = (o.id || "").slice(0, 8).toLowerCase();
  const em = (o.userEmail || email || "").toLowerCase();

  const itemsText = (o.items || [])
    .map((it) => `${it.slug} ${it.name || ""}`.toLowerCase())
    .join(" ");

  return `${idShort} ${idFull} ${em} ${itemsText}`.trim();
}

export default function OrdersPage() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  // filter + pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setEmail(u?.email ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) {
      setOrders([]);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const db = getFirestore(app);
        const col = collection(db, "orders");

        const q = query(col, where("uid", "==", uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        const list: OrderDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            uid: data.uid,
            userEmail: data.userEmail,
            createdAt: data.createdAt,
            total: safeNumber(data.total ?? 0),
            currency: data.currency ?? "CAD",
            items: Array.isArray(data.items) ? data.items : [],
          };
        });

        setOrders(list);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load orders.");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => toSearchText(o, email).includes(q));
  }, [orders, search, email]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE)),
    [filteredOrders.length]
  );

  const pageSafe = Math.min(Math.max(page, 1), totalPages);

  const pagedOrders = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, pageSafe]);

  const headerText = useMemo(() => {
    if (!uid) return "You must be logged in to see your orders.";
    if (loading) return "Loading…";
    return `${filteredOrders.length} order${filteredOrders.length === 1 ? "" : "s"}`;
  }, [uid, loading, filteredOrders.length]);

  return (
    <main style={{ padding: 24, background: "#f4f6f8", minHeight: "70vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0f172a", letterSpacing: -0.2 }}>
              My Orders
            </h1>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
              {headerText}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/catalog" style={{ fontWeight: 800, color: "#b91c1c", textDecoration: "none" }}>
              Back to catalog
            </Link>
          </div>
        </div>

        {/* Search + Pagination (only when logged in) */}
        {uid ? (
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search: Order ID, product…"
              style={{
                flex: 1,
                minWidth: 280,
                height: 40,
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                outline: "none",
              }}
            />

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: pageSafe <= 1 ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                Prev
              </button>

              <div style={{ color: "#64748b", fontSize: 13, whiteSpace: "nowrap" }}>
                Page <strong style={{ color: "#0f172a" }}>{pageSafe}</strong> / {totalPages} · {PAGE_SIZE}/page
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: pageSafe >= totalPages ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {/* States */}
        {!uid ? (
          <div style={{ marginTop: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
            <div style={{ color: "#0f172a", fontWeight: 900 }}>Please login first.</div>
            <div style={{ marginTop: 8 }}>
              <Link href="/login" style={{ fontWeight: 800, color: "#b91c1c", textDecoration: "none" }}>
                Go to Login
              </Link>
            </div>
          </div>
        ) : error ? (
          <div
            style={{
              marginTop: 16,
              background: "#fff",
              border: "1px solid rgba(185,28,28,.25)",
              borderLeft: "6px solid #b91c1c",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <strong>Firestore error:</strong> {error}
          </div>
        ) : loading ? (
          <div style={{ marginTop: 16, color: "#64748b" }}>Loading…</div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ marginTop: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 900, color: "#0f172a" }}>No orders found</div>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
              When you finish checkout, your orders will appear here.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {pagedOrders.map((o) => {
              const dt = o.createdAt?.toDate?.() instanceof Date ? o.createdAt.toDate() : null;

              const rows = (o.items || []).map((it) => {
                const qty = Math.max(1, Math.floor(safeNumber(it.qty) || 1));
                const unit =
                  typeof it.unitPriceApplied === "number"
                    ? safeNumber(it.unitPriceApplied)
                    : safeNumber(it.unitPrice);

                const lineTotal = unit * qty;

                return {
                  slug: it.slug,
                  name: it.name ?? it.slug,
                  qty,
                  unit,
                  lineTotal,
                  tierApplied: it.tierApplied ?? null,
                };
              });

              return (
                <div
                  key={o.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: "0 1px 0 rgba(15,23,42,.03)",
                  }}
                >
                  {/* Card header */}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 260 }}>
                      <div style={{ fontWeight: 950 as any, color: "#0f172a", fontSize: 16, letterSpacing: 0.2 }}>
                        {orderLabel(o.id)}
                      </div>

                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
                        <span style={{ color: "#0f172a", fontWeight: 800 }}>
                          {email || o.userEmail || "—"}
                        </span>
                      </div>

                      <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 12 }}>
                        {dt ? dt.toLocaleString("en-CA") : "—"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 950 as any, color: "#0f172a", fontSize: 18 }}>
                        {formatMoney(o.currency, o.total)}
                      </div>
                      <div style={{ marginTop: 2, color: "#64748b", fontSize: 12 }}>
                        {rows.length} item(s)
                      </div>
                    </div>
                  </div>

                  {/* Items list */}
                  <div style={{ marginTop: 10, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      {rows.map((r, idx) => (
                        <div
                          key={`${o.id}-${idx}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "baseline",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 850 as any, color: "#0f172a", fontSize: 14 }}>
                                {r.name}
                              </span>
                              <span style={{ color: "#64748b", fontWeight: 900, fontSize: 12 }}>
                                x{r.qty}
                              </span>
                            </div>

                            <div style={{ marginTop: 2, color: "#94a3b8", fontSize: 12 }}>
                              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                                {r.slug}
                              </span>
                              {r.tierApplied ? (
                                <>
                                  {" · "}
                                  <span style={{ color: "#64748b", fontWeight: 900 }}>
                                    Tier {r.tierApplied}
                                  </span>
                                </>
                              ) : null}
                              {" · "}
                              <span>
                                Unit: <strong style={{ color: "#0f172a" }}>{formatMoney(o.currency, r.unit)}</strong>
                              </span>
                            </div>
                          </div>

                          <div style={{ color: "#0f172a", fontWeight: 950 as any, fontSize: 14, whiteSpace: "nowrap" }}>
                            {formatMoney(o.currency, r.lineTotal)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination footer */}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: pageSafe <= 1 ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                Prev
              </button>
              <div style={{ alignSelf: "center", color: "#64748b", fontSize: 13 }}>
                Page <strong style={{ color: "#0f172a" }}>{pageSafe}</strong> / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: pageSafe >= totalPages ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
