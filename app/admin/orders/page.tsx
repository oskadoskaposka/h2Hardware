"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
} from "firebase/firestore";
import { auth, app } from "../../../lib/firebaseClient";
import { formatWeight } from "../../../lib/weight";
import GenerateQuotePdfButton from "../../../components/GenerateQuotePdfButton";

type OrderItem = {
  slug: string;
  name?: string;
  model?: string;
  qty: number;

  unitPriceApplied?: number;
  tierApplied?: string | null;

  unitPrice?: number; // legacy fallback
  unitWeightLb?: number;
  unitWeightKg?: number;
  totalWeightLb?: number;
  totalWeightKg?: number;
};

type OrderDoc = {
  id: string;
  uid: string;
  userEmail?: string;
  createdAt?: any;
  total: number;
  currency: string;
  totalWeightLb?: number;
  totalWeightKg?: number;
  customer?: { name?: string; phone?: string; email?: string };
  items: OrderItem[];
};

const adminEmails =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) || [];

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function approxEqual(a: number, b: number, tolerance = 0.02) {
  return Math.abs(a - b) <= tolerance;
}

function isAdminEmail(email: string | null | undefined) {
  return !!email && adminEmails.includes((email || "").toLowerCase());
}

function formatMoney(currency: string, v: number) {
  const n = safeNumber(v);
  try {
    return n.toLocaleString("en-CA", { style: "currency", currency });
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function formatTotalWeight(lb: unknown, kg: unknown) {
  const weightLb = safeNumber(lb);
  const weightKg = safeNumber(kg);
  if (weightLb <= 0 && weightKg <= 0) return "";
  return `${formatWeight(weightLb, "lb")} / ${formatWeight(weightKg, "kg")}`;
}

function toSearchText(o: OrderDoc) {
  const shortId = o.id.slice(0, 8).toLowerCase();
  const fullId = (o.id || "").toLowerCase();
  const email = (o.customer?.email || o.userEmail || "").toLowerCase();
  const name = (o.customer?.name || "").toLowerCase();
  const uid = (o.uid || "").toLowerCase();

  // also searchable by product slugs/names (helps a LOT in admin)
  const itemsText = (o.items || [])
    .map((it) => `${it.slug} ${it.name || ""}`.toLowerCase())
    .join(" ");

  return `${shortId} ${fullId} ${email} ${name} ${uid} ${itemsText}`.trim();
}

function orderLabel(o: OrderDoc) {
  const short = o.id.slice(0, 8).toUpperCase();
  return `ORDER-${short}`;
}

export default function AdminOrdersPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  // search + pagination
  const [search, setSearch] = useState("");
  const PAGE_SIZE = 40;
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) =>
      setIsAdmin(isAdminEmail(u?.email)),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
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
        const qq = query(col, orderBy("createdAt", "desc"));
        const snap = await getDocs(qq);

        const list: OrderDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            uid: data.uid ?? "",
            userEmail: data.userEmail ?? "",
            createdAt: data.createdAt,
            total: safeNumber(data.total),
            currency: data.currency ?? "CAD",
            totalWeightLb: safeNumber(data.totalWeightLb),
            totalWeightKg: safeNumber(data.totalWeightKg),
            customer: data.customer ?? undefined,
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
  }, [isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => toSearchText(o).includes(q));
  }, [orders, search]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE)),
    [filteredOrders.length],
  );

  const pageSafe = Math.min(Math.max(page, 1), totalPages);

  const pagedOrders = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, pageSafe]);

  const headerText = useMemo(() => {
    if (!isAdmin) return "Admin access only.";
    if (loading) return "Loading…";
    return `${filteredOrders.length} order${filteredOrders.length === 1 ? "" : "s"}`;
  }, [isAdmin, loading, filteredOrders.length]);

  function buildPdfProps(o: OrderDoc) {
    const customer = {
      name: (o.customer?.name || "").trim(),
      email: (o.customer?.email || o.userEmail || "").trim(),
      phone: (o.customer?.phone || "").trim(),
    };

    const items = (o.items || []).map((it) => {
      const qty = Math.max(1, Math.floor(safeNumber(it.qty) || 1));
      const unit =
        typeof it.unitPriceApplied === "number"
          ? safeNumber(it.unitPriceApplied)
          : safeNumber(it.unitPrice);

      // keep tier visible in PDF, but subtle
      const tierTxt = it.tierApplied ? ` (tier: ${it.tierApplied})` : "";

      return {
        slug: it.slug,
        qty,
        name: it.name ?? it.slug,
        model: `${it.model ?? ""}${tierTxt}`.trim(),
        price: unit,
        unitWeightLb: safeNumber(it.unitWeightLb),
        unitWeightKg: safeNumber(it.unitWeightKg),
        totalWeightLb: safeNumber(it.totalWeightLb),
        totalWeightKg: safeNumber(it.totalWeightKg),
      };
    });

    const fileId = o.id.slice(0, 8).toLowerCase();
    const filename = `starpro-order-${fileId}.pdf`;

    return { customer, items, filename };
  }

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteOrder(orderId: string) {
    const ok = window.confirm(
      `Delete order ${orderId.slice(0, 8).toUpperCase()}?\n\nThis cannot be undone.`,
    );
    if (!ok) return;

    try {
      setDeletingId(orderId);
      setError(null);

      const db = getFirestore(app);
      await deleteDoc(doc(db, "orders", orderId));

      // remove from UI immediately
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete order.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!isAdmin) return <p style={{ padding: 24 }}>Access denied.</p>;

  return (
    <main style={{ padding: 24, background: "#f4f6f8", minHeight: "70vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 18px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: -0.2,
              }}
            >
              Orders
            </h1>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
              {headerText}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Link
              href="/admin/products"
              style={{
                fontWeight: 800,
                color: "#b91c1c",
                textDecoration: "none",
              }}
            >
              Manage products
            </Link>
            <Link
              href="/catalog"
              style={{
                fontWeight: 800,
                color: "#b91c1c",
                textDecoration: "none",
              }}
            >
              Catalog
            </Link>
          </div>
        </div>

        {/* Search + Pagination */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search: Order ID, email, name, UID, product…"
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

            <div
              style={{ color: "#64748b", fontSize: 13, whiteSpace: "nowrap" }}
            >
              Page <strong style={{ color: "#0f172a" }}>{pageSafe}</strong> /{" "}
              {totalPages} · {PAGE_SIZE}/page
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

        {error ? (
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
          <div
            style={{
              marginTop: 16,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 900, color: "#0f172a" }}>
              No orders found
            </div>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
              Try a different search.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {pagedOrders.map((o) => {
              const dt =
                o.createdAt?.toDate?.() instanceof Date
                  ? o.createdAt.toDate()
                  : null;
              const pdf = buildPdfProps(o);
              const totalWeight = formatTotalWeight(o.totalWeightLb, o.totalWeightKg);

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

              const itemsSum = rows.reduce(
                (acc, r) => acc + safeNumber(r.lineTotal),
                0,
              );
              const showMismatch = !approxEqual(
                itemsSum,
                safeNumber(o.total),
                0.05,
              );

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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 260 }}>
                      <div
                        style={{
                          fontWeight: 950 as any,
                          color: "#0f172a",
                          fontSize: 16,
                          letterSpacing: 0.2,
                        }}
                      >
                        {orderLabel(o)}
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          color: "#64748b",
                          fontSize: 12,
                          lineHeight: 1.2,
                        }}
                      >
                        <span
                          style={{
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          }}
                        >
                          {o.id}
                        </span>
                      </div>

                      <div
                        style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}
                      >
                        <span style={{ color: "#0f172a", fontWeight: 800 }}>
                          {o.customer?.email || o.userEmail || o.uid}
                        </span>
                        {o.customer?.name ? (
                          <span> · {o.customer.name}</span>
                        ) : null}
                      </div>

                      <div
                        style={{ marginTop: 4, color: "#94a3b8", fontSize: 12 }}
                      >
                        {dt ? dt.toLocaleString("en-CA") : "—"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontWeight: 950 as any,
                          color: "#0f172a",
                          fontSize: 18,
                        }}
                      >
                        {formatMoney(o.currency, o.total)}
                      </div>
                      <div
                        style={{ marginTop: 2, color: "#64748b", fontSize: 12 }}
                      >
                        {rows.length} item(s)
                      </div>
                      {totalWeight ? (
                        <div style={{ marginTop: 5, color: "#475569", fontSize: 12, fontWeight: 800 }}>
                          Total weight: {totalWeight}
                        </div>
                      ) : null}

                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <GenerateQuotePdfButton
                          items={pdf.items as any}
                          customer={pdf.customer}
                          customerType={"tiered" as any}
                          currency={o.currency || "CAD"}
                          filename={pdf.filename}
                          subtitle={`Order / Copy — ${orderLabel(o)}`}
                        />

                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(o.id)}
                          disabled={deletingId === o.id}
                          style={{
                            height: 40,
                            padding: "0 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(185,28,28,.35)",
                            background:
                              deletingId === o.id ? "#fee2e2" : "#fff",
                            cursor:
                              deletingId === o.id ? "not-allowed" : "pointer",
                            fontWeight: 900,
                            color: "#b91c1c",
                          }}
                          title="Delete order"
                        >
                          {deletingId === o.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Items list */}
                  <div
                    style={{
                      marginTop: 10,
                      borderTop: "1px solid #f1f5f9",
                      paddingTop: 10,
                    }}
                  >
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
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "baseline",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 850 as any,
                                  color: "#0f172a",
                                  fontSize: 14,
                                }}
                              >
                                {r.name}
                              </span>
                              <span
                                style={{
                                  color: "#64748b",
                                  fontWeight: 900,
                                  fontSize: 12,
                                }}
                              >
                                x{r.qty}
                              </span>
                            </div>

                            <div
                              style={{
                                marginTop: 2,
                                color: "#94a3b8",
                                fontSize: 12,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily:
                                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                }}
                              >
                                {r.slug}
                              </span>
                              {r.tierApplied ? (
                                <>
                                  {" · "}
                                  <span
                                    style={{
                                      color: "#64748b",
                                      fontWeight: 900,
                                    }}
                                  >
                                    Tier {r.tierApplied}
                                  </span>
                                </>
                              ) : null}
                              {" · "}
                              <span>
                                Unit:{" "}
                                <strong style={{ color: "#0f172a" }}>
                                  {formatMoney(o.currency, r.unit)}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              color: "#0f172a",
                              fontWeight: 950 as any,
                              fontSize: 14,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatMoney(o.currency, r.lineTotal)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Only show reconciliation if mismatch */}
                    {showMismatch ? (
                      <div
                        style={{
                          marginTop: 10,
                          borderTop: "1px dashed #e2e8f0",
                          paddingTop: 10,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          color: "#b91c1c",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        <div>Mismatch detected</div>
                        <div>
                          Items sum: {formatMoney(o.currency, itemsSum)} ·
                          Stored total: {formatMoney(o.currency, o.total)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {/* Pagination footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 10,
                marginTop: 4,
              }}
            >
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
              <div
                style={{ alignSelf: "center", color: "#64748b", fontSize: 13 }}
              >
                Page <strong style={{ color: "#0f172a" }}>{pageSafe}</strong> /{" "}
                {totalPages}
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
