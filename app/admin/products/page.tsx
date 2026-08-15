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
  updateDoc,
} from "firebase/firestore";
import { auth, app } from "../../../lib/firebaseClient";
import { isAdminUser } from "../../../lib/admin";
import { formatUnitWeightPair, normalizeWeightUnit, type WeightUnit } from "../../../lib/weight";
import styles from "./admin-products.module.css";

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
  publicPrice?: number;
  currency?: string;
  stock?: number;
  unitWeight?: number;
  weightUnit?: WeightUnit;
  price?: number;
};

type DraftById = Record<
  string,
  {
    publicPrice: string;
    stock: string;
    active: boolean;
    unitWeight: string;
    weightUnit: WeightUnit;
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
  const [draft, setDraft] = useState<DraftById>({});
  const [saveState, setSaveState] = useState<SaveStateById>({});
  const [query, setQuery] = useState("");
  const PAGE_SIZE = 40;
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAdmin(await isAdminUser(user));
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

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

        const initial: DraftById = {};
        for (const p of list) {
          const publicPrice = p.publicPrice ?? p.price ?? 0;
          const stock = p.stock ?? 0;
          const active = p.active ?? true;
          const unitWeight = p.unitWeight ?? 0;
          const weightUnit = normalizeWeightUnit(p.weightUnit);

          initial[p.id] = {
            publicPrice: String(publicPrice),
            stock: String(stock),
            active: !!active,
            unitWeight: String(unitWeight),
            weightUnit,
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

  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE)), [filteredProducts.length]);
  const pageSafe = Math.min(Math.max(page, 1), totalPages);
  const pagedProducts = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, pageSafe]);

  function setRowDraft(id: string, patch: Partial<DraftById[string]>) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setSaveState((prev) => ({ ...prev, [id]: { ...prev[id], saved: false, error: null } }));
  }

  function isRowDirty(p: ProductRow) {
    const d = draft[p.id];
    if (!d) return false;

    return (
      d.publicPrice !== String(p.publicPrice ?? p.price ?? 0) ||
      d.stock !== String(p.stock ?? 0) ||
      String(d.active) !== String(!!(p.active ?? true)) ||
      d.unitWeight !== String(p.unitWeight ?? 0) ||
      d.weightUnit !== normalizeWeightUnit(p.weightUnit)
    );
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
      const unitWeight = Math.max(0, toNumberOr(d.unitWeight, 0));
      const weightUnit = normalizeWeightUnit(d.weightUnit);

      const db = getFirestore(app);
      await updateDoc(doc(db, "products", id), { publicPrice, stock, active, unitWeight, weightUnit });

      setProducts((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, publicPrice, stock, active, unitWeight, weightUnit } : x,
        ),
      );

      setDraft((prev) => ({
        ...prev,
        [id]: { ...prev[id], publicPrice: String(publicPrice), stock: String(stock), active, unitWeight: String(unitWeight), weightUnit },
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
    } catch {
      alert("Failed to delete.");
    }
  }

  if (loadingUser) return <p style={{ padding: 24 }}>Loading user…</p>;
  if (!isAdmin) return <p style={{ padding: 24 }}>Access denied. Admins only.</p>;

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Catalog management</p>
          <h1 className={styles.title}>Products</h1>
          <p className={styles.subtitle}>Manage product details, pricing, inventory, and visibility.</p>
        </div>
        <Link className={styles.primaryButton} href="/admin/products/edit?slug=new">+ New product</Link>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by slug or name…" />
        <div className={styles.meta}>
          Showing <strong>{pagedProducts.length}</strong> on page <strong>{pageSafe}</strong> / {totalPages}
          <span style={{ marginLeft: 8 }}>({filteredProducts.length} filtered / {products.length} total)</span>
        </div>
      </div>

      <div className={styles.pager}>
        <button className={styles.secondaryButton} type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1}>Prev</button>
        <span className={styles.pagerText}>Page <strong>{pageSafe}</strong> of <strong>{totalPages}</strong></span>
        <button className={styles.secondaryButton} type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages}>Next</button>
        <span className={styles.pagerText}>{PAGE_SIZE} per page</span>
      </div>

      {loadingProducts ? (
        <p style={{ marginTop: 16 }}>Loading products…</p>
      ) : error ? (
        <p style={{ marginTop: 16, color: "red" }}>{error}</p>
      ) : (
        <div className={`${styles.card} ${styles.tableCard}`}>
          <div className={styles.tableScroller}>
          <table className={styles.productTable}>
            <thead>
              <tr>
                <th style={th}>Slug</th>
                <th style={th}>Name</th>
                <th style={th}>Currency</th>
                <th style={th}>Public price</th>
                <th style={th}>Stock</th>
                <th style={th}>Unit weight</th>
                <th style={th}>Unit</th>
                <th style={th}>Both units</th>
                <th style={th}>Active</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedProducts.map((p) => {
                const d = draft[p.id] || {
                  publicPrice: String(p.publicPrice ?? p.price ?? 0),
                  stock: String(p.stock ?? 0),
                  active: !!(p.active ?? true),
                  unitWeight: String(p.unitWeight ?? 0),
                  weightUnit: normalizeWeightUnit(p.weightUnit),
                };
                const rowState = saveState[p.id] || {};
                const dirty = isRowDirty(p);
                const weightPreview = formatUnitWeightPair(d.unitWeight, d.weightUnit);

                return (
                  <tr key={p.id}>
                    <td style={td} className={styles.slug}>{p.slug || p.id}</td>
                    <td style={td} className={styles.productName}>{p.name || ""}</td>
                    <td style={td}>{p.currency || "CAD"}</td>
                    <td style={td}><input type="number" step="0.01" value={d.publicPrice} onChange={(e) => setRowDraft(p.id, { publicPrice: e.target.value })} style={{ width: 120, padding: 6 }} /></td>
                    <td style={td}><input type="number" value={d.stock} onChange={(e) => setRowDraft(p.id, { stock: e.target.value })} style={{ width: 95, padding: 6 }} /></td>
                    <td style={td}><input type="number" step="0.01" min="0" value={d.unitWeight} onChange={(e) => setRowDraft(p.id, { unitWeight: e.target.value })} style={{ width: 110, padding: 6 }} /></td>
                    <td style={td}>
                      <select value={d.weightUnit} onChange={(e) => setRowDraft(p.id, { weightUnit: normalizeWeightUnit(e.target.value) })} style={{ width: 76, padding: 6 }}>
                        <option value="lb">lb</option>
                        <option value="kg">kg</option>
                      </select>
                    </td>
                    <td style={{ ...td, color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>{weightPreview || "—"}</td>
                    <td style={td}><input type="checkbox" checked={!!d.active} onChange={(e) => setRowDraft(p.id, { active: e.target.checked })} /></td>
                    <td style={td}>
                      <div className={styles.rowActions}>
                        <Link className={styles.textLink} href={`/admin/products/edit?slug=${encodeURIComponent(p.id)}`}>Edit</Link>
                        <button className={styles.secondaryButton} type="button" onClick={() => saveRow(p)} disabled={rowState.saving || !dirty}>{rowState.saving ? "Saving…" : "Save"}</button>
                        {rowState.saved ? <span className={styles.saved}>Saved</span> : null}
                        {rowState.error ? <span className={styles.error}>{rowState.error}</span> : null}
                        <button className={styles.dangerButton} type="button" onClick={() => handleDelete(p.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <p className={styles.tip}>
            Tip: use <strong>Save</strong> to quickly update Public price, Stock, Unit weight, Weight unit, and Active without opening the product. Use <strong>Edit</strong> for tiers, images, and details. Weight preview always shows both lb and kg.
          </p>
        </div>
      )}
    </main>
  );
}

const th = { borderBottom: "1px solid #ddd", textAlign: "left" as const, padding: 8 };
const td = { borderBottom: "1px solid #f2f2f2", padding: 8 };
