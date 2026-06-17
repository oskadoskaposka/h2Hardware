"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, app } from "../../../lib/firebaseClient";
import { isAdminEmail } from "../../../lib/admin";

const CONFIG_COLLECTION = "site_config";
const CONFIG_DOC = "catalog_menu";

type CategoryRow = {
  name: string;
  count: number;
};

function cleanCategory(value: unknown) {
  return String(value ?? "").trim();
}

function categoryKey(value: string) {
  return cleanCategory(value).toLowerCase();
}

function readHighlightedCategories(data: any) {
  const raw = data?.highlightedCategories;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => cleanCategory(item))
    .filter(Boolean);
}

export default function AdminCategoryHighlightsPage() {
  const [loadingUser, setLoadingUser] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(isAdminEmail(user?.email));
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const db = getFirestore(app);
        const productSnap = await getDocs(collection(db, "products"));
        const counts = new Map<string, { name: string; count: number }>();

        productSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const category = cleanCategory(data.series || "Other") || "Other";
          const key = categoryKey(category);
          const current = counts.get(key);

          counts.set(key, {
            name: current?.name || category,
            count: (current?.count || 0) + 1,
          });
        });

        const configSnap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC));
        const highlighted = configSnap.exists()
          ? readHighlightedCategories(configSnap.data())
          : [];

        setCategories(
          Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name)),
        );
        setSelected(highlighted);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load category settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  const selectedSet = useMemo(
    () => new Set(selected.map((item) => categoryKey(item))),
    [selected],
  );

  function toggleCategory(category: string) {
    const key = categoryKey(category);

    setMessage(null);
    setSelected((prev) => {
      const exists = prev.some((item) => categoryKey(item) === key);
      if (exists) return prev.filter((item) => categoryKey(item) !== key);
      return [...prev, category].sort((a, b) => a.localeCompare(b));
    });
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const cleaned = selected
        .map((item) => cleanCategory(item))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      const db = getFirestore(app);
      await setDoc(
        doc(db, CONFIG_COLLECTION, CONFIG_DOC),
        {
          highlightedCategories: cleaned,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setSelected(cleaned);
      setMessage("Category highlight settings saved.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save category settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingUser) return <p style={{ padding: 24 }}>Loading user…</p>;
  if (!isAdmin) return <p style={{ padding: 24 }}>Access denied. Admins only.</p>;

  return (
    <main style={{ padding: 24, background: "#f4f6f8", minHeight: "70vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, color: "#0f172a", fontSize: 28, fontWeight: 950 }}>
              Category Highlights
            </h1>
            <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
              Choose which catalog categories should appear with the red button and yellow text.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/catalog" style={{ color: "#b91c1c", fontWeight: 900, textDecoration: "none" }}>
              View catalog
            </Link>
            <Link href="/admin/products" style={{ color: "#b91c1c", fontWeight: 900, textDecoration: "none" }}>
              Manage products
            </Link>
          </div>
        </div>

        <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, boxShadow: "0 8px 22px rgba(15,23,42,.06)" }}>
          <div style={{ background: "rgba(185, 28, 28, 0.06)", border: "1px solid rgba(185, 28, 28, 0.18)", borderLeft: "6px solid #b91c1c", borderRadius: 12, padding: 14, color: "#7f1d1d", fontSize: 13, fontWeight: 750, lineHeight: 1.45 }}>
            This only changes the visual highlight in the catalog menu. It does not rename categories, change products, or remove any catalog filtering logic.
          </div>

          {error ? (
            <div style={{ marginTop: 14, border: "1px solid rgba(185,28,28,.25)", borderLeft: "6px solid #b91c1c", borderRadius: 12, padding: 14, color: "#7f1d1d", fontWeight: 800 }}>
              {error}
            </div>
          ) : null}

          {message ? (
            <div style={{ marginTop: 14, border: "1px solid rgba(16,185,129,.22)", borderLeft: "6px solid #10b981", borderRadius: 12, padding: 14, color: "#065f46", fontWeight: 800 }}>
              {message}
            </div>
          ) : null}

          {loading ? (
            <p style={{ marginTop: 16, color: "#64748b" }}>Loading categories…</p>
          ) : categories.length === 0 ? (
            <p style={{ marginTop: 16, color: "#64748b" }}>No categories found.</p>
          ) : (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {categories.map((category) => {
                const checked = selectedSet.has(categoryKey(category.name));

                return (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => toggleCategory(category.name)}
                    style={{
                      minHeight: 54,
                      borderRadius: 12,
                      border: checked ? "1px solid #7f1d1d" : "1px solid #e2e8f0",
                      background: checked ? "linear-gradient(180deg, #991b1b, #7f1d1d)" : "#fff",
                      color: checked ? "#fde047" : "#0f172a",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "0 14px",
                      fontWeight: 900,
                      boxShadow: checked ? "0 6px 16px rgba(185,28,28,.16)" : "none",
                    }}
                  >
                    <span>{category.name}</span>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>{category.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving || loading}
              style={{ minHeight: 42, border: "none", borderRadius: 12, background: "#b91c1c", color: "#fff", cursor: saving || loading ? "not-allowed" : "pointer", fontWeight: 950, padding: "0 16px", opacity: saving || loading ? 0.7 : 1 }}
            >
              {saving ? "Saving…" : "Save highlight settings"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setSelected([]);
              }}
              disabled={saving || loading}
              style={{ minHeight: 42, border: "1px solid #cbd5e1", borderRadius: 12, background: "#fff", color: "#0f172a", cursor: saving || loading ? "not-allowed" : "pointer", fontWeight: 900, padding: "0 16px", opacity: saving || loading ? 0.7 : 1 }}
            >
              Clear selection
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
