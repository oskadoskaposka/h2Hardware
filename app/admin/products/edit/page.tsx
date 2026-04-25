// app/admin/products/edit/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  getFirestore,
} from "firebase/firestore";
import { auth, app } from "../../../../lib/firebaseClient";

type TierRow = {
  id?: string;
  minQty: number;
  maxQty: number | null; // null = no limit
  price: number;
};

const adminEmails =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) || [];

function toNumberOr(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTierRow(row: Partial<TierRow>): TierRow {
  const minQty = Math.max(1, Math.floor(toNumberOr(row.minQty, 1)));
  const maxQtyRaw = row.maxQty;
  const maxQty =
    maxQtyRaw === null || maxQtyRaw === undefined || maxQtyRaw === ("" as any)
      ? null
      : Math.floor(toNumberOr(maxQtyRaw, minQty));
  const price = Math.max(0, toNumberOr(row.price, 0));

  const id = row.id ? String(row.id) : undefined;

  return { id, minQty, maxQty, price };
}

function normalizeTiers(tiers: any[]): TierRow[] {
  if (!Array.isArray(tiers)) return [];
  const rows = tiers.map((t) =>
    normalizeTierRow({
      id: t?.id,
      minQty: t?.minQty,
      maxQty: t?.maxQty,
      price: t?.price,
    }),
  );

  rows.sort((a, b) => a.minQty - b.minQty);
  return rows;
}

/**
 * If user types "garage doors" but an existing option is "Garage Doors",
 * we keep the existing canonical casing to avoid duplicates caused by case sensitivity.
 */
function canonicalizeFromOptions(input: string, options: string[]) {
  const v = String(input || "").trim();
  if (!v) return "";
  const hit = options.find((o) => o.toLowerCase() === v.toLowerCase());
  return hit ?? v;
}

function AdminProductEditInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // querystring slug: /admin/products/edit?slug=xxx | /admin/products/edit?slug=new
  const slugParam = (searchParams.get("slug") || "new").trim() || "new";

  const [loadingUser, setLoadingUser] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Suggestions (for dropdown with search)
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [form, setForm] = useState({
    slug: "",
    name: "",

    // Firestore fields are still: series (Category) and category (Subcategory)
    category: "", // UI label: Category (maps to Firestore: series)
    subcategory: "", // UI label: Subcategory (maps to Firestore: category)

    description: "",

    publicPrice: 0,
    currency: "CAD", // mantemos no state, mas fica FIXO
    active: true,
    sortOrder: 9999,
    stock: 0,
    imagesCsv: "",
    featuresCsv: "",
  });

  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [bulkTiersText, setBulkTiersText] = useState("");
  const [saving, setSaving] = useState(false);

  // Change slug
  const [newSlug, setNewSlug] = useState("");
  const [renaming, setRenaming] = useState(false);

  const title = useMemo(() => {
    if (slugParam === "new") return "Create Product";
    return `Edit Product: ${slugParam}`;
  }, [slugParam]);

  // Auth / admin gate
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const email = user?.email?.toLowerCase() || "";
      setIsAdmin(!!email && adminEmails.includes(email));
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  // Load options for Category/Subcategory (from existing products)
  useEffect(() => {
    if (!isAdmin) return;

    (async () => {
      setLoadingOptions(true);
      try {
        const db = getFirestore(app);
        const q = query(collection(db, "products"), limit(1000));
        const snap = await getDocs(q);

        const categories = new Set<string>(); // series
        const subcategories = new Set<string>(); // category

        snap.forEach((d) => {
          const data = d.data() as any;

          const cat = String(data.series ?? "").trim();
          const sub = String(data.category ?? "").trim();

          if (cat) categories.add(cat);
          if (sub) subcategories.add(sub);
        });

        const cats = Array.from(categories).sort((a, b) => a.localeCompare(b));
        const subs = Array.from(subcategories).sort((a, b) =>
          a.localeCompare(b),
        );

        setCategoryOptions(cats);
        setSubcategoryOptions(subs);
      } catch {
        // não bloqueia o form se falhar
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, [isAdmin]);

  // Load product
  useEffect(() => {
    if (!isAdmin) return;

    (async () => {
      setLoadingData(true);
      try {
        if (slugParam === "new") {
          setForm({
            slug: "",
            name: "",
            category: "",
            subcategory: "",
            description: "",
            publicPrice: 0,
            currency: "CAD", // FIXO
            active: true,
            sortOrder: 9999,
            stock: 0,
            imagesCsv: "",
            featuresCsv: "",
          });
          setTiers([]);
          setNewSlug("");
          return;
        }

        const db = getFirestore(app);
        const ref = doc(db, "products", slugParam);
        const snap = await getDoc(ref);

        if (!snap.exists()) return;

        const data = snap.data() as any;

        // Compatibility with old fields if they still exist:
        const publicPrice = data.publicPrice ?? data.price ?? 0;
        const loadedTiers = data.tiers ?? data.discountTiers ?? [];

        // Firestore: series=Category, category=Subcategory
        setForm({
          slug: data.slug ?? slugParam,
          name: data.name ?? "",

          category: String(data.series ?? "").trim(),
          subcategory: String(data.category ?? "").trim(),

          description: data.description ?? "",

          publicPrice: toNumberOr(publicPrice, 0),

          // ✅ currency FIXO
          currency: "CAD",

          active: data.active ?? true,
          sortOrder: toNumberOr(data.sortOrder, 9999),
          stock: toNumberOr(data.stock, 0),
          imagesCsv: Array.isArray(data.images) ? data.images.join(", ") : "",
          featuresCsv: Array.isArray(data.features)
            ? data.features.join(", ")
            : "",
        });

        setTiers(normalizeTiers(loadedTiers));
        setNewSlug(data.slug ?? slugParam);
      } catch (e) {
        alert("Failed to load product.");
      } finally {
        setLoadingData(false);
      }
    })();
  }, [isAdmin, slugParam]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value, type } = e.target as any;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((p) => ({ ...p, [name]: checked }));
      return;
    }

    setForm((p) => ({ ...p, [name]: value }));
  }

  function addTier() {
    setTiers((prev) => [
      ...prev,
      { id: `t${prev.length + 1}`, minQty: 1, maxQty: null, price: 0 },
    ]);
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTier(index: number, patch: Partial<TierRow>) {
    setTiers((prev) =>
      prev.map((t, i) =>
        i === index ? normalizeTierRow({ ...t, ...patch }) : t,
      ),
    );
  }

  function parseBulkTiers(text: string): TierRow[] {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const out: TierRow[] = [];

    for (const line of lines) {
      const parts = line.split("=");
      if (parts.length !== 2) continue;

      const left = parts[0].trim();
      const price = toNumberOr(parts[1].trim(), NaN);
      if (!Number.isFinite(price)) continue;

      if (left.endsWith("+")) {
        const min = toNumberOr(left.replace("+", "").trim(), NaN);
        if (!Number.isFinite(min)) continue;
        out.push({
          id: undefined,
          minQty: Math.floor(min),
          maxQty: null,
          price,
        });
        continue;
      }

      if (left.includes("-")) {
        const [a, b] = left.split("-").map((s) => s.trim());
        const min = toNumberOr(a, NaN);
        const max = toNumberOr(b, NaN);
        if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
        out.push({
          id: undefined,
          minQty: Math.floor(min),
          maxQty: Math.floor(max),
          price,
        });
        continue;
      }

      const minOnly = toNumberOr(left, NaN);
      if (Number.isFinite(minOnly)) {
        out.push({
          id: undefined,
          minQty: Math.floor(minOnly),
          maxQty: null,
          price,
        });
      }
    }

    return normalizeTiers(out);
  }

  function applyBulkTiers() {
    const parsed = parseBulkTiers(bulkTiersText);
    if (!parsed.length) {
      alert("No valid tiers found. Example:\n1-10=9\n11-20=8\n21+=7");
      return;
    }
    const withIds = parsed.map((t, idx) => ({
      ...t,
      id: t.id ?? `t${idx + 1}`,
    }));
    setTiers(withIds);
    setBulkTiersText("");
  }

  function buildPayload(slugOverride?: string) {
    const slug = String(slugOverride ?? form.slug ?? "").trim();
    if (!slug) {
      throw new Error("Slug is required.");
    }

    const name = String(form.name || "").trim();
    if (!name) {
      throw new Error("Name is required.");
    }

    const category = canonicalizeFromOptions(
      String(form.category || ""),
      categoryOptions,
    );
    const subcategory = canonicalizeFromOptions(
      String(form.subcategory || ""),
      subcategoryOptions,
    );

    if (!category) {
      throw new Error("Category is required.");
    }
    if (!subcategory) {
      throw new Error("Subcategory is required.");
    }

    const stock = Math.floor(toNumberOr(form.stock, NaN));
    if (!Number.isFinite(stock)) {
      throw new Error("Stock is required.");
    }

    const publicPrice = toNumberOr(form.publicPrice, NaN);
    if (!Number.isFinite(publicPrice)) {
      throw new Error("Public price is required.");
    }

    const images = String(form.imagesCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const features = String(form.featuresCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const normalizedTiers = normalizeTiers(tiers).map((t, idx) => {
      if (t.maxQty !== null && t.maxQty < t.minQty) {
        throw new Error(
          `Tier ${t.id ?? `t${idx + 1}`}: Max qty cannot be less than Min qty.`,
        );
      }

      return {
        id: t.id ?? `t${idx + 1}`,
        minQty: t.minQty,
        maxQty: t.maxQty,
        price: t.price,
      };
    });

    const payload: any = {
      slug,
      name,

      // Firestore field names unchanged:
      series: category,
      category: subcategory,

      description: String(form.description || "").trim(),

      publicPrice: Math.max(0, publicPrice),

      // ✅ FIXO
      currency: "CAD",

      tiers: normalizedTiers,

      active: !!form.active,
      sortOrder: Math.floor(toNumberOr(form.sortOrder, 9999)),
      stock: Math.max(0, stock),
      images,
      features,
    };

    if (!payload.description) delete payload.description;

    return payload;
  }

  async function handleChangeSlug() {
    if (slugParam === "new") return;
    if (renaming || saving) return;

    const targetSlug = String(newSlug || "").trim();
    const currentSlug = String(slugParam || "").trim();

    if (!targetSlug) {
      alert("New slug is required.");
      return;
    }

    if (targetSlug === currentSlug) {
      alert("The new slug is the same as the current slug.");
      return;
    }

    const confirmed = confirm(
      `Change slug from '${currentSlug}' to '${targetSlug}'?\n\nThis will create a new product record with the new slug and delete the current one.`,
    );
    if (!confirmed) return;

    try {
      setRenaming(true);

      const db = getFirestore(app);
      const oldRef = doc(db, "products", currentSlug);
      const newRef = doc(db, "products", targetSlug);

      const newSnap = await getDoc(newRef);
      if (newSnap.exists()) {
        alert("A product with this slug already exists.");
        return;
      }

      const oldSnap = await getDoc(oldRef);
      if (!oldSnap.exists()) {
        alert("Current product not found.");
        return;
      }

      const payload = buildPayload(targetSlug);

      await setDoc(newRef, payload);
      await deleteDoc(oldRef);

      alert("Slug changed successfully.");
      router.push(`/admin/products/edit?slug=${encodeURIComponent(targetSlug)}`);
    } catch (err: any) {
      alert(err?.message ?? "Failed to change slug.");
    } finally {
      setRenaming(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);

      const payload = buildPayload();

      const db = getFirestore(app);
      const ref = doc(db, "products", payload.slug);

      if (slugParam === "new") {
        await setDoc(ref, payload);
      } else {
        await updateDoc(ref, payload as any);
      }

      // keep options fresh (in case admin added new values)
      const category = String(payload.series || "").trim();
      const subcategory = String(payload.category || "").trim();

      if (
        category &&
        !categoryOptions.some((c) => c.toLowerCase() === category.toLowerCase())
      ) {
        setCategoryOptions((p) =>
          [...p, category].sort((a, b) => a.localeCompare(b)),
        );
      }
      if (
        subcategory &&
        !subcategoryOptions.some(
          (c) => c.toLowerCase() === subcategory.toLowerCase(),
        )
      ) {
        setSubcategoryOptions((p) =>
          [...p, subcategory].sort((a, b) => a.localeCompare(b)),
        );
      }

      alert("Saved!");
      router.push("/admin/products");
    } catch (err: any) {
      alert(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingUser) return <p style={{ padding: 24 }}>Loading user…</p>;
  if (!isAdmin) return <p style={{ padding: 24 }}>Access denied.</p>;
  if (loadingData) return <p style={{ padding: 24 }}>Loading product…</p>;

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>{title}</h1>
        <button onClick={() => router.push("/admin/products")} type="button">
          Back to list
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        {/* Basics */}
        <section
          style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 16 }}
        >
          <h2 style={{ marginTop: 0 }}>Basics</h2>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <label>
              Slug (Document ID)
              <input
                name="slug"
                value={form.slug}
                onChange={handleChange}
                disabled={slugParam !== "new"}
                required
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Name <span style={{ color: "#b00" }}>*</span>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                style={{ width: "100%" }}
              />
            </label>

            {/* Label changed: Series -> Category (Firestore: series) */}
            <label>
              Category <span style={{ color: "#b00" }}>*</span>
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                list="category-options"
                style={{ width: "100%" }}
                placeholder={
                  loadingOptions ? "Loading categories..." : "e.g. Garage Doors"
                }
              />
              <datalist id="category-options">
                {categoryOptions.map((c) => (
                  <option value={c} key={c} />
                ))}
              </datalist>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                {categoryOptions.length
                  ? "Type to search or add a new Category."
                  : "Type to add a Category."}
              </div>
            </label>

            {/* Label changed: Category -> Subcategory (Firestore: category) */}
            <label>
              Subcategory <span style={{ color: "#b00" }}>*</span>
              <input
                name="subcategory"
                value={form.subcategory}
                onChange={handleChange}
                required
                list="subcategory-options"
                style={{ width: "100%" }}
                placeholder={
                  loadingOptions
                    ? "Loading subcategories..."
                    : "e.g. Standard / Premium / etc"
                }
              />
              <datalist id="subcategory-options">
                {subcategoryOptions.map((c) => (
                  <option value={c} key={c} />
                ))}
              </datalist>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                {subcategoryOptions.length
                  ? "Type to search or add a new Subcategory."
                  : "Type to add a Subcategory."}
              </div>
            </label>

            <label>
              Sort order
              <input
                name="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={handleChange}
                style={{ width: "100%" }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 22,
              }}
            >
              <input
                name="active"
                type="checkbox"
                checked={form.active}
                onChange={handleChange as any}
              />
              Active
            </label>

            <label>
              Stock <span style={{ color: "#b00" }}>*</span>
              <input
                name="stock"
                type="number"
                value={form.stock}
                onChange={handleChange}
                required
                style={{ width: "100%" }}
              />
            </label>
          </div>
        </section>

        {/* Change slug */}
        {slugParam !== "new" ? (
          <section
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: 16,
              marginTop: 16,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Change slug</h2>

            <div style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
              This will create a new product record with the new slug and delete
              the current one. Old links, cart items, or carousel references
              using the previous slug will not update automatically.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "end",
              }}
            >
              <label>
                New slug
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  style={{ width: "100%" }}
                  placeholder="Enter the new slug"
                />
              </label>

              <button
                type="button"
                onClick={handleChangeSlug}
                disabled={renaming || saving}
                style={{ height: 38 }}
              >
                {renaming ? "Changing…" : "Change slug"}
              </button>
            </div>
          </section>
        ) : null}

        {/* Pricing */}
        <section
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            padding: 16,
            marginTop: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Pricing</h2>

          {/* ✅ Mantém grid, mas remove Currency */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              alignItems: "end",
            }}
          >
            <label>
              Public price (unit) — $ <span style={{ color: "#b00" }}>*</span>
              <input
                name="publicPrice"
                type="number"
                step="0.01"
                value={form.publicPrice}
                onChange={handleChange}
                required
                style={{ width: "100%" }}
              />
            </label>

            {/* espaço "fantasma" pra manter layout */}
            <div />

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={addTier}>
                + Add tier
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Tier ID
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Min qty
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Max qty
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Unit price ($)
                  </th>
                  <th style={{ padding: 8, borderBottom: "1px solid #eee" }} />
                </tr>
              </thead>
              <tbody>
                {tiers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 10, color: "#666" }}>
                      No tiers yet. Public price will be used for all
                      quantities.
                    </td>
                  </tr>
                ) : (
                  tiers.map((t, idx) => (
                    <tr key={`${t.id ?? "tier"}-${idx}`}>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f3f3f3",
                        }}
                      >
                        <input
                          value={t.id ?? ""}
                          onChange={(e) =>
                            updateTier(idx, { id: e.target.value })
                          }
                          placeholder="t1"
                          style={{ width: "100%" }}
                        />
                      </td>

                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f3f3f3",
                        }}
                      >
                        <input
                          type="number"
                          value={t.minQty}
                          onChange={(e) =>
                            updateTier(idx, { minQty: Number(e.target.value) })
                          }
                          style={{ width: "100%" }}
                        />
                      </td>

                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f3f3f3",
                        }}
                      >
                        <input
                          type="number"
                          value={t.maxQty ?? ""}
                          onChange={(e) =>
                            updateTier(idx, {
                              maxQty:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="(no limit)"
                          style={{ width: "100%" }}
                        />
                      </td>

                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f3f3f3",
                        }}
                      >
                        <input
                          type="number"
                          step="0.01"
                          value={t.price}
                          onChange={(e) =>
                            updateTier(idx, { price: Number(e.target.value) })
                          }
                          style={{ width: "100%" }}
                        />
                      </td>

                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f3f3f3",
                          textAlign: "right",
                        }}
                      >
                        <button type="button" onClick={() => removeTier(idx)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14 }}>
            <details>
              <summary style={{ cursor: "pointer" }}>Bulk paste tiers</summary>
              <div style={{ marginTop: 10 }}>
                <div style={{ color: "#666", marginBottom: 8 }}>
                  Paste one per line. Examples:
                  <br />
                  <code>1-10=9</code>, <code>11-20=8</code>, <code>21+=7</code>,{" "}
                  <code>50=6.5</code>
                </div>
                <textarea
                  value={bulkTiersText}
                  onChange={(e) => setBulkTiersText(e.target.value)}
                  rows={6}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="button" onClick={applyBulkTiers}>
                    Apply tiers
                  </button>
                  <button type="button" onClick={() => setBulkTiersText("")}>
                    Clear
                  </button>
                </div>
              </div>
            </details>
          </div>
        </section>

        {/* Content */}
        <section
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            padding: 16,
            marginTop: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Content</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <label>
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                style={{ width: "100%" }}
                placeholder="Write a short description for the product..."
              />
            </label>

            <label>
              Images (comma-separated URLs)
              <input
                name="imagesCsv"
                value={form.imagesCsv}
                onChange={handleChange}
                style={{ width: "100%" }}
                placeholder="https://... , https://..."
              />
            </label>

            <label>
              Features (comma-separated)
              <input
                name="featuresCsv"
                value={form.featuresCsv}
                onChange={handleChange}
                style={{ width: "100%" }}
                placeholder="Heavy-duty hardware, Quiet operation, ..."
              />
            </label>
          </div>
        </section>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="submit" disabled={saving || renaming}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => router.push("/admin/products")}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <AdminProductEditInner />
    </Suspense>
  );
}