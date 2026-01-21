"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../../styles/cart.module.css";
import {
  clearCart,
  getCartLines,
  onCartChanged,
  removeFromCart,
  updateQty,
  type CartLine,
} from "../../lib/cart";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { app } from "../../lib/firebaseClient";

import { resolveUnitPrice } from "../../lib/pricing";

type Product = {
  slug: string;
  name: string;
  series: string;
  model?: string;

  // ✅ NEW pricing model (Form A)
  publicPrice: number;
  currency?: string;
  tiers?: { id?: string; minQty: number; maxQty?: number | null; price: number }[];

  active: boolean;
  sortOrder?: number;

  images?: string[];
  features?: string[];
  category?: string;

  // compatibility (old)
  price?: number;
  discountTiers?: any[];
};

function safeNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default function CartPage() {
  const [tick, setTick] = useState(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Re-render when cart changes (add/remove/update/clear)
  useEffect(() => {
    const unsub = onCartChanged(() => setTick((x) => x + 1));
    return unsub;
  }, []);

  // Load products from Firestore
  useEffect(() => {
    (async () => {
      try {
        setLoadingProducts(true);
        setProductsError(null);

        const db = getFirestore(app);
        const col = collection(db, "products");
        const q = query(col, where("active", "==", true), orderBy("sortOrder", "asc"));

        const snap = await getDocs(q);
        const list: Product[] = snap.docs.map((d) => {
          const data = d.data() as any;

          // ✅ new fields with compatibility fallback
          const publicPrice = Number(data.publicPrice ?? data.price ?? 0);
          const tiers = Array.isArray(data.tiers)
            ? data.tiers
            : (Array.isArray(data.discountTiers) ? data.discountTiers : []);

          return {
            slug: data.slug ?? d.id,
            name: data.name ?? d.id,
            series: data.series ?? "Other",
            model: data.model ?? "",

            publicPrice,
            currency: data.currency ?? "CAD",
            tiers,

            active: Boolean(data.active ?? true),
            sortOrder: Number(data.sortOrder ?? 9999),
            images: Array.isArray(data.images) ? data.images : [],
            features: Array.isArray(data.features) ? data.features : [],
            category: data.category ?? data.series ?? "General",

            // compat
            price: Number(data.price ?? 0),
            discountTiers: Array.isArray(data.discountTiers) ? data.discountTiers : [],
          };
        });

        list.sort(
          (a, b) =>
            (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) ||
            (a.name ?? "").localeCompare(b.name ?? "")
        );

        setProducts(list);
      } catch (e: any) {
        setProductsError(e?.message ?? "Failed to load products.");
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  const lines: CartLine[] = useMemo(() => {
    void tick;
    return getCartLines(products as any);
  }, [tick, products]);

  // ✅ NEW total: sum(unitPriceApplied * qty)
  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const p: any = line.product || {};

      const pricing = {
        publicPrice: Number(p.publicPrice ?? p.price ?? 0),
        currency: String(p.currency ?? "CAD"),
        tiers: Array.isArray(p.tiers)
          ? p.tiers
          : (Array.isArray(p.discountTiers) ? p.discountTiers : []),
      };

      const r = resolveUnitPrice(pricing as any, line.qty);
      return sum + safeNumber(r.unitPriceApplied) * safeNumber(line.qty);
    }, 0);
  }, [lines]);

  return (
    <div className="container">
      <h1 className={styles.h1}>Cart</h1>
      <p className={styles.p}>
        No payment on the site — here you organize your order and send it to our team.
      </p>

      <div className={styles.toolbar}>
        <button className={styles.ghost} onClick={() => clearCart()}>
          Clear cart
        </button>
      </div>

      {productsError ? (
        <div className={styles.empty}>
          <strong>Couldn’t load products.</strong>
          <span>{productsError}</span>
        </div>
      ) : loadingProducts ? (
        <div className={styles.empty}>
          <strong>Loading…</strong>
          <span>Fetching products to render your cart.</span>
        </div>
      ) : lines.length === 0 ? (
        <div className={styles.empty}>
          <strong>Your cart is empty.</strong>
          <span>Go back to the catalog and add a model.</span>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {lines.map((line) => {
              const p: any = line.product || {};
              const currency = (p.currency ?? "CAD") as string;

              const pricing = {
                publicPrice: Number(p.publicPrice ?? p.price ?? 0),
                currency,
                tiers: Array.isArray(p.tiers)
                  ? p.tiers
                  : (Array.isArray(p.discountTiers) ? p.discountTiers : []),
              };

              const r = resolveUnitPrice(pricing as any, line.qty);
              const unit = safeNumber(r.unitPriceApplied);
              const sub = unit * safeNumber(line.qty);

              return (
                <div key={line.slug} className={styles.row}>
                  <div className={styles.left}>
                    <strong>{p.name}</strong>
                    <span className={styles.muted}>{p.model}</span>

                    <span className={styles.muted}>
                      Unit:{" "}
                      {unit.toLocaleString("en-CA", {
                        style: "currency",
                        currency,
                      })}
                      {r.tierApplied ? (
                        <span style={{ marginLeft: 8, opacity: 0.7 }}>
                          (tier: {r.tierApplied})
                        </span>
                      ) : null}
                    </span>
                  </div>

                  <div className={styles.right}>
                    <input
                      className={styles.qty}
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) => updateQty(line.slug, Number(e.target.value || 1))}
                    />

                    <div className={styles.sub}>
                      {sub.toLocaleString("en-CA", {
                        style: "currency",
                        currency,
                      })}
                    </div>

                    <button
                      className={styles.remove}
                      onClick={() => removeFromCart(line.slug)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.summary}>
            <div>
              <div className={styles.muted}>Total</div>
              <div className={styles.total}>
                {total.toLocaleString("en-CA", {
                  style: "currency",
                  currency: "CAD",
                })}
              </div>

              {/* ✅ NEW: Taxes / shipping note (below price) */}
              <div
                className={styles.muted}
                style={{ marginTop: 6, fontSize: 12, lineHeight: 1.35 }}
              >
                Taxes not included. Applicable GST/HST/PST may apply. Shipping fees may apply.
              </div>
            </div>

            <a className={styles.primary} href="/checkout">
              Checkout
            </a>
          </div>
        </>
      )}
    </div>
  );
}
