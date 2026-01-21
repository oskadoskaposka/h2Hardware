"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, app } from "../../../lib/firebaseClient";

const adminEmails =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) || [];

function toNumberOr(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

type ProductRow = {
  id: string;
  slug?: string;
  name?: string;
  active?: boolean;
  sortOrder?: number;

  // New pricing model (Form A)
  publicPrice?: number;
  currency?: string;
  stock?: number;

  // Compatibility (old)
  price?: number;
};

type DraftById = Record<
  string,
  {
    publicPrice: string; // keep as string for inputs
    stock: string;
    active: boolean;
  }
>;

type SaveStateById = Record<
  string,
  { saving?: boolean; saved?: boolean; error?: string | null }
>;

export default function AdminProductsPage() {
  const [loadingUser, setLoadingUser] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Edit state
  const [draft, setDraft] = useState<DraftById>({});
  const [saveState, setSaveState] = useState<SaveStateById>({});

  const [query, setQuery] = useState("");

  // ✅ Pagination (client-side)
  const PAGE_SIZE = 40;
  const [page, setPage] = useState(1);

  // Auth gate
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const email = user?.email?.toLowerCase() || "";
      setIsAdmin(!!email && adminEmails.includes(email));
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  // Load products
  useEffect(() => {
    if (!isAdmin) return;

    (async () => {
      try {
        setLoadingProducts(true);
        setError(null);

        const db = getFirestore(app);
        const snap = await getDocs(collection(db, "products"));
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ProductRow[];

        list.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
        setProducts(list);

        // Initialize draft from DB values (publicPrice/stock/active)
        const initial: DraftById = {};
        for (const p of list) {
          const publicPrice = p.publicPrice ?? p.price ?? 0; // compat
          const stock = p.stock ?? 0;
          const active = p.active ?? true;

          initial[p.id] = {
            publicPrice: String(publicPrice),
            stock: String(stock),
            active: !!active,
          };
        }
        setDraft(initial);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load products.");
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, [isAdmin]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;

    return products.filter((p) => {
      const slug = (p.slug || p.id || "").toLowerCase();
      const name = (p.name || "").toLowerCase();
      return slug.includes(q) || name.includes(q);
    });
  }, [products, query]);

  // ✅ Reset to page 1 when filter changes (prevents blank pages)
  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  }, [filteredProducts.length]);

  const pageSafe = Math.min(Math.max(page, 1), totalPages);

  const pagedProducts = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, pageSafe]);

  function setRowDraft(id: string, patch: Partial<DraftById[string]>) {
    setDraft((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
    // Clear "saved" badge on change
    setSaveState((prev) => ({
      ...prev,
      [id]: { ...prev[id], saved: false, error: null },
    }));
  }

  function isRowDirty(p: ProductRow) {
    const d = draft[p.id];
    if (!d) return false;

    const dbPublicPrice = String(p.publicPrice ?? p.price ?? 0);
    const dbStock = String(p.stock ?? 0);
    const dbActive = String(!!(p.active ?? true));

    return d.publicPrice !== dbPublicPrice || d.stock !== dbStock || String(d.active) !== dbActive;
  }

  async function saveRow(p: ProductRow) {
    const id = p.id;
    const d = draft[id];
    if (!d) return;

    try {
      setSaveState((prev) => ({ ...prev, [id]: { saving: true, saved: false, error: null } }));

      const publicPrice = Math.max(0, toNumberOr(d.publicPrice, 0));
      const stock = Math.max(0, Math.floor(toNumberOr(d.stock, 0)));
      const active = !!d.active;

      const db = getFirestore(app);
      await updateDoc(doc(db, "products", id), {
        publicPrice,
        stock,
        active,
      });

      // Update local products list to reflect saved values
      setProducts((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                publicPrice,
                stock,
                active,
              }
            : x
        )
      );

      // Keep input strings consistent after save
      setDraft((prev) => ({
        ...prev,
        [id]: { ...prev[id], publicPrice: String(publicPrice), stock: String(stock), active },
      }));

      setSaveState((prev) => ({ ...prev, [id]: { saving: false, saved: true, error: null } }));
      setTimeout(() => {
        setSaveState((prev) => ({ ...prev, [id]: { ...prev[id], saved: false } }));
      }, 1500);
    } catch (e: any) {
      setSaveState((prev) => ({
        ...prev,
        [id]: { saving: false, saved: false, error: e?.message ?? "Failed to save." },
      }));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete product '${id}'?`)) return;
    try {
      const db = getFirestore(app);
      await deleteDoc(doc(db, "products", id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setDraft((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (e) {
      alert("Failed to delete.");
    }
  }

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  if (loadingUser) return <p style={{ padding: 24 }}>Loading user…</p>;
  if (!isAdmin) return <p style={{ padding: 24 }}>Access denied. Admins only.</p>;

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Manage Products</h1>

        {/* ✅ FIX: New must use querystring */}
        <Link href="/admin/products/edit?slug=new">+ New product</Link>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by slug or name…"
          style={{ flex: 1, padding: 8 }}
        />

        <div style={{ color: "#666", fontSize: 14, whiteSpace: "nowrap" }}>
          Showing <strong>{pagedProducts.length}</strong> on page{" "}
          <strong>{pageSafe}</strong> / {totalPages}{" "}
          <span style={{ marginLeft: 8 }}>
            ({filteredProducts.length} filtered / {products.length} total)
          </span>
        </div>
      </div>

      {/* ✅ Pagination controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={goPrev} disabled={pageSafe <= 1}>
          Prev
        </button>

        <span style={{ color: "#444", fontSize: 14 }}>
          Page <strong>{pageSafe}</strong> of <strong>{totalPages}</strong>
        </span>

        <button type="button" onClick={goNext} disabled={pageSafe >= totalPages}>
          Next
        </button>

        <span style={{ marginLeft: 6, color: "#888", fontSize: 13 }}>
          {PAGE_SIZE} per page
        </span>
      </div>

      {loadingProducts ? (
        <p style={{ marginTop: 16 }}>Loading products…</p>
      ) : error ? (
        <p style={{ marginTop: 16, color: "red" }}>{error}</p>
      ) : (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Slug</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Name</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Currency</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Public price</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Stock</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Active</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {pagedProducts.map((p) => {
                const d = draft[p.id] || {
                  publicPrice: String(p.publicPrice ?? p.price ?? 0),
                  stock: String(p.stock ?? 0),
                  active: !!(p.active ?? true),
                };

                const rowState = saveState[p.id] || {};
                const dirty = isRowDirty(p);

                return (
                  <tr key={p.id}>
                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                      {p.slug || p.id}
                    </td>

                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                      {p.name || ""}
                    </td>

                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                      {p.currency || "CAD"}
                    </td>

                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                      <input
                        type="number"
                        step="0.01"
                        value={d.publicPrice}
                        onChange={(e) => setRowDraft(p.id, { publicPrice: e.target.value })}
                        style={{ width: 140, padding: 6 }}
                      />
                    </td>

                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                      <input
                        type="number"
                        value={d.stock}
                        onChange={(e) => setRowDraft(p.id, { stock: e.target.value })}
                        style={{ width: 120, padding: 6 }}
                      />
                    </td>

                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!d.active}
                        onChange={(e) => setRowDraft(p.id, { active: e.target.checked })}
                      />
                    </td>

                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        {/* ✅ FIX: Edit must use querystring */}
                        <Link href={`/admin/products/edit?slug=${encodeURIComponent(p.id)}`}>
                          Edit
                        </Link>

                        <button
                          type="button"
                          onClick={() => saveRow(p)}
                          disabled={rowState.saving || !dirty}
                          style={{ padding: "6px 10px" }}
                        >
                          {rowState.saving ? "Saving…" : "Save"}
                        </button>

                        {rowState.saved ? (
                          <span style={{ color: "green", fontSize: 13 }}>Saved</span>
                        ) : null}

                        {rowState.error ? (
                          <span style={{ color: "red", fontSize: 13 }}>{rowState.error}</span>
                        ) : null}

                        <button type="button" onClick={() => handleDelete(p.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p style={{ color: "#666", marginTop: 10, fontSize: 13 }}>
            Tip: use <strong>Save</strong> to quickly update Public price, Stock, and Active without opening the product.
            Use <strong>Edit</strong> for tiers, images, and details.
          </p>
        </div>
      )}
    </main>
  );
}
