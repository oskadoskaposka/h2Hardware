// app/product/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getFirestore, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app } from "../../lib/firebaseClient";

import styles from "../../styles/product.module.css";
import AddToCartButton from "../../components/AddToCartButton";
import ProductPricing from "../../components/ProductPricing";
import { getQtyInCart, onCartChanged } from "../../lib/cart";
import { formatUnitWeightPair, type WeightUnit } from "../../lib/weight";

type Tier = {
  id?: string;
  minQty: number;
  maxQty?: number | null;
  price: number;
};

type Product = {
  slug: string;
  name: string;
  series?: string;
  category?: string;
  model?: string;
  description?: string;
  images?: string[];
  features?: string[];
  publicPrice?: number;
  tiers?: Tier[];
  stock?: number;
  unitWeight?: number;
  weightUnit?: WeightUnit;
  price?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeImages(images: any): string[] {
  const arr = Array.isArray(images) ? images : [];
  return arr.map((x) => String(x)).filter(Boolean);
}

function normalizeFeatures(features: any): string[] {
  const arr = Array.isArray(features) ? features : [];
  return arr.map((x) => String(x)).filter(Boolean);
}

function getPublicUnitPrice(p: Product): number | null {
  const pub = Number(p.publicPrice ?? NaN);
  if (Number.isFinite(pub) && pub > 0) return pub;

  const legacy = Number(p.price ?? NaN);
  if (Number.isFinite(legacy) && legacy > 0) return legacy;

  return null;
}

function formatMoney(v: number | null): string {
  if (v == null) return "Price on request";
  return v.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function ProductPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = (searchParams.get("slug") || "").trim();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [cartTick, setCartTick] = useState(0);
  const [isLogged, setIsLogged] = useState(false);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setIsLogged(!!u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setProduct(null);
      return;
    }

    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const db = getFirestore(app);
        const ref = doc(db, "products", slug);
        const snap = await getDoc(ref);

        if (!mounted) return;

        if (!snap.exists()) {
          setProduct(null);
          return;
        }

        const data = snap.data() as any;
        setProduct({ slug, ...(data as any) });
        setActiveImgIdx(0);
      } catch (e) {
        console.error("Failed to load product", e);
        if (mounted) setProduct(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    const unsub = onCartChanged(() => setCartTick((x) => x + 1));
    return () => unsub();
  }, []);

  const stock = Number(product?.stock ?? 0);
  const inStock = stock > 0;
  const maxQty = 999999;

  useEffect(() => {
    if (loading || !product) return;
    setQty((q) => clamp(q, 1, maxQty));
  }, [loading, product, maxQty]);

  const safeQty = clamp(qty, 1, maxQty);

  useEffect(() => {
    setAvailabilityNotice(null);
  }, [slug, safeQty]);

  const inCartQty = useMemo(() => {
    void cartTick;
    return product ? getQtyInCart(product.slug) : 0;
  }, [product, cartTick]);

  const pricingQty = safeQty + inCartQty;

  const tiersSorted = useMemo(() => {
    const tiers = Array.isArray(product?.tiers) ? [...(product!.tiers as Tier[])] : [];
    tiers.sort((a, b) => (a.minQty ?? 0) - (b.minQty ?? 0));
    return tiers;
  }, [product?.tiers]);

  const images = useMemo(() => normalizeImages(product?.images), [product?.images]);
  const features = useMemo(() => normalizeFeatures(product?.features), [product?.features]);

  const series = String(product?.series || "").trim();
  const subcategory = String(product?.category || "").trim();
  const model = String(product?.model || "").trim();
  const publicUnit = product ? getPublicUnitPrice(product) : null;
  const unitWeightText = product ? formatUnitWeightPair(product.unitWeight, product.weightUnit) : "";

  const pricingProduct = useMemo(() => {
    if (!product) return null;
    if (isLogged) return product;
    return { ...product, tiers: [] as Tier[] };
  }, [product, isLogged]);

  const THRESHOLD_RATIO = 0.8;

  const thresholdQty = useMemo(() => {
    if (!inStock) return 0;
    return Math.floor(stock * THRESHOLD_RATIO);
  }, [inStock, stock]);

  const exceedsThreshold = useMemo(() => {
    if (!inStock) return true;
    if (thresholdQty <= 0) return pricingQty > 0;
    return pricingQty > thresholdQty;
  }, [inStock, thresholdQty, pricingQty]);

  const actionsRow: React.CSSProperties = {
    display: "flex",
    gap: 12,
    marginTop: 14,
    alignItems: "center",
    flexWrap: "wrap",
  };

  const secondaryLink: React.CSSProperties = {
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #e6e6e6",
    background: "#fff",
    fontWeight: 800,
    textDecoration: "none",
    color: "#111",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 16,
    lineHeight: 1,
  };

  function handleCheckStock() {
    if (!inStock) {
      alert("Out of stock. Please contact our team to confirm availability.");
      return;
    }

    if (!exceedsThreshold) {
      alert("In stock ✅");
      return;
    }

    alert("Please contact our team to confirm availability for this quantity.");
  }

  function handleAddedToCart() {
    setCartTick((x) => x + 1);

    if (exceedsThreshold) {
      setAvailabilityNotice("Added to cart. Our team will confirm availability for this quantity.");
      return;
    }

    setAvailabilityNotice(null);
  }

  function handleBackToCatalog() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/catalog");
  }

  if (!slug) {
    return (
      <div className="container">
        <h1>Product</h1>
        <p style={{ opacity: 0.75 }}>
          Missing slug. Open a product using <code>/product?slug=YOUR_SLUG</code>.
        </p>
        <button onClick={() => router.push("/catalog")}>Go to catalog</button>
      </div>
    );
  }

  if (loading) return <div className="container">Loading product…</div>;

  if (!product) {
    return (
      <div className="container">
        <h1>Product not found</h1>
        <p style={{ opacity: 0.75 }}>We couldn’t find this product: {slug}</p>
        <button onClick={() => router.push("/catalog")}>Go to catalog</button>
      </div>
    );
  }

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 14px 34px rgba(0,0,0,0.08)",
  };

  const cardHeader: React.CSSProperties = {
    background: "linear-gradient(180deg, #121212, #000)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 13,
    padding: "12px 14px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    borderBottom: "3px solid #b91c1c",
  };

  const mediaWrap: React.CSSProperties = {
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
    background: "#fff",
    boxShadow: "0 14px 34px rgba(0,0,0,0.06)",
  };

  const heroBox: React.CSSProperties = {
    width: "100%",
    aspectRatio: "4 / 3",
    background: "radial-gradient(1200px 420px at 20% 10%, rgba(185,28,28,0.18), transparent 55%), linear-gradient(180deg, #141414, #0a0a0a)",
    position: "relative",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
  };

  const heroImg: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  const heroOverlay: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: 14,
    color: "#fff",
    pointerEvents: "none",
    textShadow: "0 2px 10px rgba(0,0,0,0.55)",
  };

  const chip: React.CSSProperties = {
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
    backdropFilter: "blur(6px)",
  };

  const specRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: 10,
    padding: "10px 0",
    borderBottom: "1px solid #eee",
  };

  const specKey: React.CSSProperties = {
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    color: "#111",
    opacity: 0.9,
  };

  const specVal: React.CSSProperties = {
    fontWeight: 750,
    color: "#111",
    fontSize: 14,
    wordBreak: "break-word",
  };

  const activeSrc = images[clamp(activeImgIdx, 0, Math.max(0, images.length - 1))] || "";

  return (
    <div className="container" style={{ paddingBottom: 34 }}>
      <div className="pdpGrid">
        <div style={{ minWidth: 0 }}>
          <div style={mediaWrap}>
            <div style={heroBox}>
              {activeSrc ? <img src={activeSrc} alt={product.name} style={heroImg} /> : null}

              <div style={heroOverlay}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {series ? <span style={chip}>{series}</span> : null}
                  {subcategory ? <span style={chip}>{subcategory}</span> : null}
                </div>
              </div>
            </div>

            {images.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: 12, borderTop: "1px solid #eee" }}>
                {images.slice(0, 8).map((src, i) => {
                  const isActive = i === activeImgIdx;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImgIdx(i)}
                      style={{
                        border: isActive ? "2px solid #b91c1c" : "1px solid #eee",
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "#fafafa",
                        aspectRatio: "1 / 1",
                        padding: 0,
                        cursor: "pointer",
                      }}
                      title={src}
                    >
                      <img src={src} alt={`${product.name} ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 12, borderTop: "1px solid #eee", color: "#666", fontWeight: 700 }}>No images yet.</div>
            )}
          </div>

          {features.length > 0 ? (
            <div style={{ marginTop: 16, ...card }}>
              <div style={cardHeader}>Features</div>
              <div style={{ padding: 14 }}>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  {features.map((f, i) => (
                    <li key={i} style={{ fontWeight: 750, color: "#111" }}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={card}>
            <div style={cardHeader}>Product Details</div>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 850 }}>{product.name}</h1>
                {series ? (
                  <span style={{ background: "rgba(185,28,28,0.10)", border: "1px solid rgba(185,28,28,0.25)", color: "#b91c1c", fontWeight: 800, padding: "6px 10px", borderRadius: 999, fontSize: 12, whiteSpace: "nowrap" }}>
                    {series}
                  </span>
                ) : null}
              </div>

              <div style={{ marginTop: 8, color: "#444", fontWeight: 650 }}>
                {model ? (
                  <>
                    <span style={{ fontWeight: 800 }}>{model}</span>
                    <span style={{ margin: "0 8px", opacity: 0.6 }}>•</span>
                  </>
                ) : null}
                <span style={{ opacity: 0.85 }}>ID: {product.slug}</span>
              </div>

              {product.description ? <p style={{ marginTop: 12, marginBottom: 0, color: "#222", lineHeight: 1.6, fontWeight: 500 }}>{product.description}</p> : null}

              <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 14, padding: "0 14px" }}>
                {series ? <div style={specRow}><div style={specKey}>Category</div><div style={specVal}>{series}</div></div> : null}
                {subcategory ? <div style={specRow}><div style={specKey}>Subcategory</div><div style={specVal}>{subcategory}</div></div> : null}
                {unitWeightText ? <div style={specRow}><div style={specKey}>Unit weight</div><div style={specVal}>{unitWeightText}</div></div> : null}
                {model ? (
                  <div style={{ ...specRow, borderBottom: "none" }}><div style={specKey}>Model</div><div style={specVal}>{model}</div></div>
                ) : (
                  <div style={{ ...specRow, borderBottom: "none" }}><div style={specKey}>ID</div><div style={specVal}>{product.slug}</div></div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                {pricingProduct ? <ProductPricing product={pricingProduct as any} qty={isLogged ? pricingQty : 1} isLogged={isLogged} /> : null}

                {isLogged ? (
                  <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13, fontWeight: 700 }}>
                    Taxes not included. Applicable GST/HST/PST may apply. Shipping fees may apply.
                  </div>
                ) : null}

                {isLogged ? (
                  <div style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 14, overflow: "hidden", background: "#fff", boxShadow: "0 10px 26px rgba(0,0,0,0.06)" }}>
                    <div style={{ background: "linear-gradient(180deg, #f7f7f7, #ffffff)", borderBottom: "1px solid #eee", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 850, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: "#111" }}>Pricing</div>
                    </div>
                    <div style={{ padding: 12, display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
                        <div style={{ display: "grid", gap: 2 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.75, textTransform: "uppercase" }}>Public price</div>
                          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>Unit</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 850, color: "#111" }}>{formatMoney(publicUnit)}</div>
                      </div>

                      {tiersSorted.length > 0 ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.75, textTransform: "uppercase" }}>Tier prices (unit)</div>
                          <div style={{ display: "grid", gap: 6 }}>
                            {tiersSorted.map((t, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 12px", border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
                                <div style={{ fontSize: 12, fontWeight: 750, color: "#111" }}>{t.maxQty ? `${t.minQty}–${t.maxQty}` : `${t.minQty} or more`}</div>
                                <div style={{ fontSize: 13, fontWeight: 850, color: "#111" }}>{formatMoney(Number(t.price))}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, color: "#111" }}>Qty</span>
                <button type="button" onClick={() => setQty((q) => clamp(q - 1, 1, maxQty))}>–</button>
                <input type="number" min={1} max={maxQty} value={safeQty} onChange={(e) => setQty(clamp(Number(e.target.value || 1), 1, maxQty))} style={{ width: 100, height: 40, borderRadius: 12, border: "1px solid #e5e5e5", padding: "0 10px" }} />
                <button type="button" onClick={() => setQty((q) => clamp(q + 1, 1, maxQty))}>+</button>
              </div>

              <div style={actionsRow}>
                <AddToCartButton slug={product.slug} qty={safeQty} className={styles.primary} onAdded={handleAddedToCart} />
                <button type="button" onClick={handleCheckStock} style={secondaryLink}>Check stock</button>
                <a href="/cart" style={secondaryLink}>View cart</a>
              </div>

              {availabilityNotice ? <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, opacity: 0.75 }}>{availabilityNotice}</div> : null}

              <div style={{ marginTop: 18 }}>
                <button type="button" onClick={handleBackToCatalog} style={{ ...secondaryLink, width: "100%" }}>Back to catalog</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .pdpGrid {
          display: grid;
          grid-template-columns: minmax(320px, 520px) minmax(320px, 1fr);
          gap: 28px;
          align-items: start;
        }
        @media (max-width: 980px) {
          .pdpGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<div className="container">Loading…</div>}>
      <ProductPageInner />
    </Suspense>
  );
}
