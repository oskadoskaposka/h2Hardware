// app/admin/carousel-builder/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from "firebase/firestore";

/**
 * IMPORTANT MAPPING (do not change without updating the homepage renderer):
 * - Firestore field "series" is displayed/used as "Category"
 * - Firestore field "category" is displayed/used as "Subcategory"
 * There is NO third level (no "subcategory" field in this carousel config).
 */

type LinkType = "filter" | "product" | "page" | "url";

type Slide = {
  id: string;

  // Display
  title: string;
  subtitle?: string;
  src?: string; // "/carousel/slide1.jpg"

  // Link behavior
  linkType: LinkType;

  // FILTER target (2 levels only)
  // "series" = Category (required)
  // "category" = Subcategory (optional)
  series?: string;
  category?: string;

  // Product target
  productSlug?: string;

  // Internal page target
  pagePath?: string;

  // External URL target
  url?: string;
};

function uid() {
  return `slide-${Math.random().toString(16).slice(2)}-${Date.now().toString(
    16
  )}`;
}

/** Firebase client init (self-contained) */
function getFirebaseApp(): FirebaseApp {
  const existing = getApps();
  if (existing.length) return existing[0];

  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) {
    throw new Error(
      "Missing Firebase config. Check NEXT_PUBLIC_FIREBASE_API_KEY / NEXT_PUBLIC_FIREBASE_PROJECT_ID / NEXT_PUBLIC_FIREBASE_APP_ID in your .env."
    );
  }

  return initializeApp(cfg);
}

function getDb(): Firestore {
  const app = getFirebaseApp();
  getAuth(app); // ensure auth initialized
  return getFirestore(app);
}

const DOC_PATH = { col: "site_config", id: "catalog_carousel" };

function cleanStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeLinkType(v: any): LinkType {
  const s = String(v ?? "").toLowerCase();
  if (s === "product" || s === "page" || s === "url") return s;
  return "filter";
}

function isValidHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeInternalPath(p: string) {
  const v = (p ?? "").trim();
  if (!v) return "";
  return v.startsWith("/") ? v : `/${v}`;
}

async function loadSlidesFromDb(db: Firestore): Promise<Slide[] | null> {
  const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as any;
  if (!Array.isArray(data?.slides)) return null;

  const cleaned: Slide[] = data.slides
    .map((s: any) => ({
      id: cleanStr(s?.id),
      title: cleanStr(s?.title),
      subtitle: cleanStr(s?.subtitle),
      src: cleanStr(s?.src),

      linkType: normalizeLinkType(s?.linkType),

      // mapping stays the same in DB:
      series: cleanStr(s?.series), // Category
      category: cleanStr(s?.category), // Subcategory

      productSlug: cleanStr(s?.productSlug),
      pagePath: cleanStr(s?.pagePath),
      url: cleanStr(s?.url),
    }))
    .filter((s: Slide) => s.id && s.title);

  return cleaned.length ? cleaned : null;
}

async function saveSlidesToDb(db: Firestore, slides: Slide[]) {
  const ref = doc(db, DOC_PATH.col, DOC_PATH.id);

  await setDoc(
    ref,
    {
      updatedAt: new Date(),
      slides: slides.map((s) => ({
        id: s.id,
        title: s.title.trim(),
        subtitle: (s.subtitle ?? "").trim(),
        src: (s.src ?? "").trim(),

        linkType: s.linkType,

        // Keep existing schema:
        // series = Category
        // category = Subcategory
        series: (s.series ?? "").trim(),
        category: (s.category ?? "").trim(),

        // optional targets
        productSlug: (s.productSlug ?? "").trim(),
        pagePath: (s.pagePath ?? "").trim(),
        url: (s.url ?? "").trim(),
      })),
    },
    { merge: true }
  );
}

function buildDefaultSlide(): Slide {
  return {
    id: uid(),
    title: "",
    subtitle: "",
    src: "",
    linkType: "filter",
    series: "",
    category: "",
    productSlug: "",
    pagePath: "",
    url: "",
  };
}

export default function CarouselBuilderPage() {
  const [slides, setSlides] = useState<Slide[]>([
    {
      id: uid(),
      title: "Standard Collection",
      subtitle: "Tap to filter the catalog",
      src: "",
      linkType: "filter",
      series: "Standard", // Category
      category: "", // Subcategory
    },
    {
      id: uid(),
      title: "Premium Collection",
      subtitle: "Explore premium options",
      src: "",
      linkType: "filter",
      series: "Premium", // Category
      category: "", // Subcategory
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        setLoading(true);
        setMsg("");

        const db = getDb();
        const saved = await loadSlidesFromDb(db);

        if (!alive) return;
        if (saved) setSlides(saved);
      } catch (e: any) {
        if (!alive) return;
        setMsg(e?.message ?? "Failed to load carousel configuration.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    init();
    return () => {
      alive = false;
    };
  }, []);

  function update(id: string, patch: Partial<Slide>) {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function addSlide() {
    setSlides((prev) => [...prev, buildDefaultSlide()]);
  }

  function removeSlide(id: string) {
    setSlides((prev) => prev.filter((s) => s.id !== id));
  }

  const validatedSlides = useMemo(() => {
    const out: Slide[] = [];

    for (const raw of slides) {
      const s: Slide = {
        ...raw,
        title: cleanStr(raw.title),
        subtitle: cleanStr(raw.subtitle),
        src: cleanStr(raw.src),
        linkType: normalizeLinkType(raw.linkType),

        series: cleanStr(raw.series), // Category
        category: cleanStr(raw.category), // Subcategory

        productSlug: cleanStr(raw.productSlug),
        pagePath: cleanStr(raw.pagePath),
        url: cleanStr(raw.url),
      };

      if (!s.id || !s.title) continue;

      if (s.linkType === "filter") {
        // Category is required
        if (!s.series) continue;
      } else if (s.linkType === "product") {
        if (!s.productSlug) continue;
      } else if (s.linkType === "page") {
        const p = normalizeInternalPath(s.pagePath ?? "");
        if (!p) continue;
        s.pagePath = p;
      } else if (s.linkType === "url") {
        if (!s.url || !isValidHttpUrl(s.url)) continue;
      }

      out.push(s);
    }

    return out;
  }, [slides]);

  const canSave = validatedSlides.length > 0 && !saving && !loading;

  async function onSave() {
    try {
      setMsg("");
      setSaving(true);

      const db = getDb();
      await saveSlidesToDb(db, validatedSlides);

      setMsg("✅ Saved! The homepage carousel can now read this configuration.");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cb-page">
      <style jsx global>{`
        .cb-page {
          min-height: 100vh;
          background: #fff;
          color: #111;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            Arial, "Noto Sans";
        }
        .cb-wrap {
          max-width: 980px;
          margin: 0 auto;
          padding: 22px 14px 60px;
        }
        .cb-top {
          border: 1px solid #e4e4e7;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          padding: 16px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .cb-title {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
        }
        .cb-sub {
          margin: 6px 0 0;
          font-size: 13px;
          color: #52525b;
          line-height: 1.35;
          max-width: 720px;
        }
        .cb-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .cb-btn {
          border: 1px solid #e4e4e7;
          background: #fff;
          color: #18181b;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 12px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .cb-btn:hover {
          background: #fafafa;
        }
        .cb-btn-primary {
          background: #18181b;
          color: #fff;
          border-color: #18181b;
          font-weight: 800;
        }
        .cb-btn-primary:hover {
          background: #27272a;
        }
        .cb-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .cb-msg {
          margin-top: 10px;
          font-size: 12px;
          color: #3f3f46;
        }
        .cb-list {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .cb-slide {
          border: 1px solid #e4e4e7;
          border-radius: 16px;
          padding: 14px;
        }
        .cb-slide-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .cb-chip {
          font-size: 11px;
          color: #3f3f46;
          background: #f4f4f5;
          border: 1px solid #e4e4e7;
          border-radius: 999px;
          padding: 6px 10px;
          font-weight: 800;
        }
        .cb-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 700px) {
          .cb-form {
            grid-template-columns: 1fr;
          }
        }
        .cb-field label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: #27272a;
          margin-bottom: 6px;
        }
        .cb-field input,
        .cb-field select {
          width: 100%;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 13px;
          outline: none;
          background: #fff;
        }
        .cb-field input:focus,
        .cb-field select:focus {
          border-color: #a1a1aa;
        }
        .cb-help {
          margin-top: 6px;
          font-size: 11px;
          color: #71717a;
          line-height: 1.35;
        }
        .cb-preview {
          margin-top: 12px;
          border: 1px solid #e4e4e7;
          border-radius: 16px;
          overflow: hidden;
          height: 130px;
          position: relative;
          background: linear-gradient(135deg, #18181b, #52525b, #e4e4e7);
        }
        .cb-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .cb-ov {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
        }
        .cb-pc {
          position: absolute;
          inset: 0;
          padding: 14px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 6px;
          color: #fff;
        }
        .cb-badge {
          display: inline-flex;
          width: fit-content;
          gap: 6px;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.18);
          font-size: 11px;
          backdrop-filter: blur(6px);
        }
        .cb-h2 {
          font-size: 15px;
          font-weight: 900;
          margin: 0;
          line-height: 1.2;
        }
        .cb-p {
          margin: 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
        }
        .cb-divider {
          grid-column: 1 / -1;
          height: 1px;
          background: #f1f1f4;
          margin: 4px 0;
        }
      `}</style>

      <div className="cb-wrap">
        <div className="cb-top">
          <div>
            <h1 className="cb-title">Carousel Builder</h1>
            <p className="cb-sub">
              Fill the fields and click <b>Save</b>. This stores the carousel
              configuration in Firestore at{" "}
              <b>
                {DOC_PATH.col}/{DOC_PATH.id}
              </b>
              .
              <br />
              <span style={{ color: "#71717a" }}>
                Mapping note: <b>Category</b> is saved as <code>series</code>,
                and <b>Subcategory</b> is saved as <code>category</code>.
              </span>
            </p>
            {msg ? <div className="cb-msg">{msg}</div> : null}
          </div>

          <div className="cb-actions">
            <a className="cb-btn" href="/catalog">
              ← Back to catalog
            </a>
            <button
              className="cb-btn"
              type="button"
              onClick={addSlide}
              disabled={loading || saving}
            >
              + Add slide
            </button>
            <button
              className="cb-btn cb-btn-primary"
              type="button"
              onClick={onSave}
              disabled={!canSave}
              title={
                !canSave
                  ? "Make sure you have at least 1 valid slide (based on Link Type validation)."
                  : "Save"
              }
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="cb-msg" style={{ marginTop: 14 }}>
            Loading...
          </div>
        ) : (
          <div className="cb-list">
            {slides.map((s, idx) => (
              <div key={s.id} className="cb-slide">
                <div className="cb-slide-head">
                  <span className="cb-chip">Slide {idx + 1}</span>
                  <button
                    className="cb-btn"
                    type="button"
                    onClick={() => removeSlide(s.id)}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>

                <div className="cb-form">
                  <div className="cb-field">
                    <label>Title (required)</label>
                    <input
                      value={s.title}
                      onChange={(e) => update(s.id, { title: e.target.value })}
                      placeholder='e.g. "Premium Collection"'
                    />
                  </div>

                  <div className="cb-field">
                    <label>Subtitle (optional)</label>
                    <input
                      value={s.subtitle ?? ""}
                      onChange={(e) =>
                        update(s.id, { subtitle: e.target.value })
                      }
                      placeholder='e.g. "Shop the best options"'
                    />
                  </div>

                  <div className="cb-field">
                    <label>Link Type (required)</label>
                    <select
                      value={s.linkType}
                      onChange={(e) =>
                        update(s.id, { linkType: e.target.value as LinkType })
                      }
                    >
                      <option value="filter">
                        Filter (Category/Subcategory)
                      </option>
                      <option value="product">Product (by slug)</option>
                      <option value="page">Internal page (path)</option>
                      <option value="url">External URL</option>
                    </select>
                    <div className="cb-help">
                      Choose where this slide should redirect when clicked.
                    </div>
                  </div>

                  <div className="cb-field">
                    <label>Image src (optional)</label>
                    <input
                      value={s.src ?? ""}
                      placeholder='e.g. "/carousel/slide1.jpg"'
                      onChange={(e) => update(s.id, { src: e.target.value })}
                    />
                    <div className="cb-help">
                      Put images in <b>public/carousel/</b> and reference them
                      with a path starting with <b>/carousel/</b>.
                    </div>
                  </div>

                  <div className="cb-divider" />

                  {s.linkType === "filter" ? (
                    <>
                      <div className="cb-field">
                        <label>Category (required)</label>
                        <input
                          value={s.series ?? ""}
                          placeholder='e.g. "Standard"'
                          onChange={(e) =>
                            update(s.id, { series: e.target.value })
                          }
                        />
                        <div className="cb-help">
                          Saved in Firestore as <code>series</code>.
                        </div>
                      </div>

                      <div className="cb-field">
                        <label>Subcategory (optional)</label>
                        <input
                          value={s.category ?? ""}
                          placeholder='e.g. "Short Panel"'
                          onChange={(e) =>
                            update(s.id, { category: e.target.value })
                          }
                        />
                        <div className="cb-help">
                          Saved in Firestore as <code>category</code>.
                        </div>
                      </div>
                    </>
                  ) : null}

                  {s.linkType === "product" ? (
                    <div className="cb-field" style={{ gridColumn: "1 / -1" }}>
                      <label>Product slug (required)</label>
                      <input
                        value={s.productSlug ?? ""}
                        placeholder='e.g. "standard-short-panel-t800"'
                        onChange={(e) =>
                          update(s.id, { productSlug: e.target.value })
                        }
                      />
                    </div>
                  ) : null}

                  {s.linkType === "page" ? (
                    <div className="cb-field" style={{ gridColumn: "1 / -1" }}>
                      <label>Internal page path (required)</label>
                      <input
                        value={s.pagePath ?? ""}
                        placeholder='e.g. "/contact"'
                        onChange={(e) =>
                          update(s.id, { pagePath: e.target.value })
                        }
                      />
                    </div>
                  ) : null}

                  {s.linkType === "url" ? (
                    <div className="cb-field" style={{ gridColumn: "1 / -1" }}>
                      <label>External URL (required)</label>
                      <input
                        value={s.url ?? ""}
                        placeholder='e.g. "https://www.starprodoors.ca/"'
                        onChange={(e) => update(s.id, { url: e.target.value })}
                      />
                      <div className="cb-help">
                        Must be a valid http(s) URL.
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="cb-preview">
                  {s.src?.trim() ? (
                    <img src={s.src.trim()} alt={s.title} />
                  ) : null}
                  <div className="cb-ov" />
                  <div className="cb-pc">
                    <div className="cb-badge">
                      <span style={{ opacity: 0.95 }}>
                        {s.linkType === "filter"
                          ? "Filter"
                          : s.linkType === "product"
                          ? "Product"
                          : s.linkType === "page"
                          ? "Page"
                          : "URL"}
                      </span>
                      <span style={{ opacity: 0.7 }}>•</span>
                      <span style={{ opacity: 0.9 }}>
                        {s.linkType === "filter"
                          ? `${(s.series ?? "").trim() || "Category"}${
                              (s.category ?? "").trim()
                                ? ` / ${(s.category ?? "").trim()}`
                                : ""
                            }`
                          : s.linkType === "product"
                          ? (s.productSlug ?? "").trim() || "product-slug"
                          : s.linkType === "page"
                          ? normalizeInternalPath(s.pagePath ?? "") || "/path"
                          : (s.url ?? "").trim() || "https://..."}
                      </span>
                    </div>

                    <p className="cb-h2">{s.title || "Title"}</p>
                    {(s.subtitle ?? "").trim() ? (
                      <p className="cb-p">{(s.subtitle ?? "").trim()}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
