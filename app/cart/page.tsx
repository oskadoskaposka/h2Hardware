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
import { onAuthStateChanged } from "firebase/auth";
import { auth, app } from "../../lib/firebaseClient";

import { resolveUnitPrice } from "../../lib/pricing";

type Product = {
  slug: string;
  name: string;
  series: string;
  model?: string;
  publicPrice: number;
  currency?: string;
  tiers?: { id?: string; minQty: number; maxQty?: number | null; price: number }[];
  active: boolean;
  sortOrder?: number;
  images?: string[];
  features?: string[];
  category?: string;
  price?: number;
  discountTiers?: any[];
};

function safeNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function getCartPricing(product: any, qty: number, signedIn: boolean) {
  const currency = String(product?.currency ?? "CAD");
  const publicPrice = Number(product?.publicPrice ?? product?.price ?? 0);

  if (!signedIn) {
    return {
      currency,
      unitPriceApplied: safeNumber(publicPrice),
      tierApplied: null as string | null,
    };
  }

  const result = resolveUnitPrice(
    {
      publicPrice,
      currency,
      tiers: Array.isArray(product?.tiers)
        ? product.tiers
        : Array.isArray(product?.discountTiers)
          ? product.discountTiers
          : [],
    } as any,
    qty
  );

  return {
    currency,
    unitPriceApplied: safeNumber(result.unitPriceApplied),
    tierApplied: result.tierApplied ?? null,
  };
}

export default function CartPage() {
  const [tick, setTick] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setSignedIn(!!user));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onCartChanged(() => setTick((x) => x + 1));
    return unsub;
  }, []);

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

  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const pricing = getCartPricing(line.product || {}, line.qty, signedIn);
      return sum + pricing.unitPriceApplied * safeNumber(line.qty);
    }, 0);
  }, [lines, signedIn]);

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
              const pricing = getCartPricing(p, line.qty, signedIn);
              const unit = pricing.unitPriceApplied;
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
                        currency: pricing.currency,
                      })}
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
                        currency: pricing.currency,
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
