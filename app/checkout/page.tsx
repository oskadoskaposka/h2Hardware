// app/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../../styles/checkout.module.css";

import {
  clearCart,
  getCartLines,
  onCartChanged,
  type CartLine,
} from "../../lib/cart";

import GenerateQuotePdfButton from "../../components/GenerateQuotePdfButton";

import { auth, app } from "../../lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
} from "firebase/firestore";
import { orderAction } from "../../lib/orderActions";

import { resolveUnitPrice } from "../../lib/pricing";
import {
  formatUnitWeightPair,
  formatWeightPair,
  getWeightPair,
  type WeightUnit,
} from "../../lib/weight";
import {
  clearOrderActivitySummary,
  getOrderActivitySummary,
} from "../../lib/orderActivity";

type OrderItem = {
  slug: string;
  productId: string;
  name?: string;
  model?: string;
  qty: number;
  unitPriceApplied: number;
  tierApplied: string | null;
  unitWeight?: number;
  weightUnit?: WeightUnit;
  unitWeightLb?: number;
  unitWeightKg?: number;
  totalWeightLb?: number;
  totalWeightKg?: number;
};

type CustomerProfile = {
  name?: string;
  phone?: string;
  email?: string;
};

function safeNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : 0;
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(safeNumber(v));
}

function getCheckoutPricing(product: any, qty: number) {
  const publicPrice = Number(product?.publicPrice ?? product?.price ?? 0);
  const currency = String(product?.currency ?? "CAD");

  const pricing = {
    publicPrice,
    currency,
    tiers: Array.isArray(product?.tiers)
      ? product.tiers
      : Array.isArray(product?.discountTiers)
        ? product.discountTiers
        : [],
  };

  const r = resolveUnitPrice(pricing as any, qty);

  return {
    currency,
    unitPriceApplied: safeNumber(r.unitPriceApplied),
    tierApplied: r.tierApplied ?? null,
  };
}

export default function CheckoutPage() {
  const [authReady, setAuthReady] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const cartLinesSafe = useMemo(() => (Array.isArray(cartLines) ? cartLines : []), [cartLines]);

  const [finalizing, setFinalizing] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [orderComplete, setOrderComplete] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const logged = !!u;
      setIsLogged(logged);
      setAuthReady(true);

      const em = u?.email ?? "";
      setUserEmail(em);

      if (u) {
        (async () => {
          setLoadingProfile(true);
          try {
            const db = getFirestore(app);
            const ref = doc(db, "customers", u.uid);
            const snap = await getDoc(ref);

            if (snap.exists()) {
              const data = snap.data() as CustomerProfile;
              setCustomerName(String(data.name || ""));
              setCustomerPhone(String(data.phone || ""));
              setCustomerEmail(String(data.email || u.email || ""));
            } else {
              setCustomerEmail(String(u.email || ""));
            }
          } catch {
            setCustomerEmail(String(u.email || ""));
          } finally {
            setLoadingProfile(false);
          }
        })();
      } else {
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      const db = getFirestore(app);
      const snap = await getDocs(collection(db, "products"));
      const list = snap.docs.map((d) => ({
        slug: d.id,
        ...(d.data() as any),
      }));
      setProducts(list);
      setLoadingProducts(false);
    })();
  }, []);

  useEffect(() => {
    if (loadingProducts) return;

    function refresh() {
      const lines = getCartLines(products as any);
      setCartLines(lines);
    }

    refresh();
    const unsub = onCartChanged(refresh);
    return () => unsub();
  }, [loadingProducts, products]);

  const total = useMemo(() => {
    return cartLinesSafe.reduce((sum, l) => {
      const p: any = l.product || {};
      const pricing = getCheckoutPricing(p, l.qty);
      return sum + pricing.unitPriceApplied * safeNumber(l.qty);
    }, 0);
  }, [cartLinesSafe]);

  const totalWeight = useMemo(() => {
    return cartLinesSafe.reduce(
      (sum, l) => {
        const p: any = l.product || {};
        const weight = getWeightPair(p?.unitWeight, p?.weightUnit, l.qty);
        return {
          lb: sum.lb + weight.totalWeightLb,
          kg: sum.kg + weight.totalWeightKg,
        };
      },
      { lb: 0, kg: 0 },
    );
  }, [cartLinesSafe]);

  const isEmpty = cartLinesSafe.length === 0;

  const customer = useMemo(
    () => ({
      name: customerName.trim(),
      email: (customerEmail || userEmail || "").trim(),
      phone: customerPhone.trim(),
    }),
    [customerName, customerEmail, userEmail, customerPhone],
  );

  const customerType = useMemo(() => "tiered" as any, []);

  const items = useMemo(() => {
    return cartLinesSafe.map((l) => {
      const p: any = l.product || {};
      const pricing = getCheckoutPricing(p, l.qty);
      const unit = safeNumber(pricing.unitPriceApplied);
      const subtotal = unit * safeNumber(l.qty);
      const weight = getWeightPair(p?.unitWeight, p?.weightUnit, l.qty);

      return {
        slug: l.slug,
        productId: l.slug,
        name: p?.name ?? l.slug,
        model: p?.model ?? "",
        qty: l.qty,
        unit,
        unitPrice: unit,
        subtotal,
        price: unit,
        tierApplied: pricing.tierApplied ?? null,
        unitWeight: safeNumber(p?.unitWeight),
        weightUnit: weight.sourceUnit,
        unitWeightLb: weight.unitWeightLb,
        unitWeightKg: weight.unitWeightKg,
        totalWeightLb: weight.totalWeightLb,
        totalWeightKg: weight.totalWeightKg,
      } as any;
    });
  }, [cartLinesSafe]);

  async function handleFinalizeOrder() {
    setUiError(null);

    const user = auth.currentUser;

    if (!user) {
      setUiError("Please login to check out your order.");
      return;
    }
    if (isEmpty) {
      setUiError("Your cart is empty.");
      return;
    }
    if (!shippingAddress.trim()) {
      setUiError("Please add the delivery address before checking out.");
      return;
    }

    setFinalizing(true);
    try {
      const orderItems: OrderItem[] = cartLinesSafe.map((l) => {
        const p: any = l.product || {};
        const pricing = getCheckoutPricing(p, l.qty);
        const weight = getWeightPair(p?.unitWeight, p?.weightUnit, l.qty);

        return {
          slug: l.slug,
          productId: l.slug,
          name: p?.name ?? l.slug,
          model: p?.model ?? "",
          qty: l.qty,
          unitPriceApplied: safeNumber(pricing.unitPriceApplied),
          tierApplied: pricing.tierApplied ?? null,
          unitWeight: safeNumber(p?.unitWeight),
          weightUnit: weight.sourceUnit,
          unitWeightLb: weight.unitWeightLb,
          unitWeightKg: weight.unitWeightKg,
          totalWeightLb: weight.totalWeightLb,
          totalWeightKg: weight.totalWeightKg,
        };
      });

      const activitySummary = getOrderActivitySummary();

      await orderAction(user, {
        action: "save",
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          email: (customerEmail || user.email || "").trim(),
        },
        shippingAddress: shippingAddress.trim(),
        items: orderItems.map(({ slug, qty }) => ({ slug, qty })),
        ...(activitySummary ? { analyticsSummary: activitySummary } : {}),
      });

      clearCart(false);
      clearOrderActivitySummary();
      setCartLines([]);
      setOrderComplete(true);
    } catch (e: any) {
      setUiError(e?.message ?? "Failed to check out order.");
    } finally {
      setFinalizing(false);
    }
  }

  const canFinalize = isLogged && !isEmpty && !finalizing;

  if (!authReady) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.title} style={{ margin: 0 }}>Loading checkout…</h1>
        </section>
      </main>
    );
  }

  if (!isLogged) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <img src="/h2-logo.svg" alt="H2 Hardware" style={{ height: 48 }} />
            <h1 className={styles.title} style={{ margin: 0 }}>Login required</h1>
          </div>

          <p className={styles.subtitle} style={{ marginTop: 18, fontSize: 16 }}>
            Please log in to view pricing, generate a quote PDF, and check out your order.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <a href="/login" className={styles.secondaryCta} style={{ background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }}>
              Login
            </a>
            <a href="/cart" className={styles.secondaryCta}>
              Back to cart
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (orderComplete) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/h2-logo.svg" alt="H2 Hardware" style={{ height: 48 }} />
            <h1 className={styles.title} style={{ margin: 0 }}>Order received</h1>
          </div>

          <p className={styles.subtitle} style={{ marginTop: 18, fontSize: 16 }}>
            Thank you for your order. Our team will contact you shortly to review and finalize your order.
          </p>

          <a href="/orders" className={styles.secondaryCta}>View my orders</a>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Checkout</h1>
      <p className={styles.subtitle}>Review your quote and place your order. Our team will follow up to complete your request.</p>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Customer details</h2>

          <label className={styles.label}>Name</label>
          <input className={styles.input} value={customerName} disabled style={{ opacity: 0.7, cursor: "not-allowed" }} placeholder="Your full name" onChange={() => {}} />

          <label className={styles.label}>Phone</label>
          <input className={styles.input} value={customerPhone} disabled style={{ opacity: 0.7, cursor: "not-allowed" }} placeholder="(XXX) XXX-XXXX" onChange={() => {}} />

          <label className={styles.label}>Email</label>
          <input className={styles.input} value={customerEmail} disabled style={{ opacity: 0.7, cursor: "not-allowed" }} placeholder="you@email.com" onChange={() => {}} />

          <label className={styles.label}>Delivery address</label>
          <textarea className={styles.input} value={shippingAddress} placeholder="Street, city, province, postal code" rows={4} onChange={(e) => setShippingAddress(e.target.value)} style={{ resize: "vertical", minHeight: 90 }} />

          {loadingProfile ? (
            <div className={styles.badge}>Loading your details…</div>
          ) : (
            <a href="/login" className={styles.badge} style={{ display: "inline-flex", gap: 8, alignItems: "center", textDecoration: "none", cursor: "pointer" }} aria-label="Edit details in login">
              Edit details in Login
            </a>
          )}

          <div className={styles.steps}>
            <h3>How it works</h3>
            <p>
              1) Review your quote and download the PDF if needed.
              <br />
              2) Check out your order and our team will take care of the next steps.
            </p>

            {uiError ? <p style={{ color: "#b10000", fontWeight: 800 }}>{uiError}</p> : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <GenerateQuotePdfButton items={items} customer={customer} customerType={customerType} shippingAddress={shippingAddress} />
            </div>
          </div>
        </section>

        <aside className={styles.preview}>
          <div className={styles.previewHeader}>
            <img src="/h2-logo.svg" alt="H2 Hardware" style={{ height: 42 }} />
            <div className={styles.small}>Quote preview</div>
          </div>

          <div className={styles.previewBody}>
            <div className={styles.previewInfo}>
              <div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Customer:</span> {customerName || "—"}</div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Phone:</span> {customerPhone || "—"}</div>
              </div>
              <div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Email:</span> {customerEmail || userEmail || "—"}</div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Delivery:</span> {shippingAddress || "—"}</div>
              </div>
            </div>

            <div className={styles.previewTableHeader}>
              <div>Item</div>
              <div>Item code</div>
              <div className={styles.num}>QTY</div>
              <div className={styles.num}>UNIT</div>
              <div className={styles.num}>SUBTOTAL</div>
            </div>

            {isEmpty ? (
              <div className={styles.previewEmpty}>Your cart is empty.</div>
            ) : (
              <>
                {cartLinesSafe.map((l) => {
                  const p: any = l.product || {};
                  const pricing = getCheckoutPricing(p, l.qty);
                  const unit = safeNumber(pricing.unitPriceApplied);
                  const sub = unit * safeNumber(l.qty);
                  const unitWeightText = formatUnitWeightPair(p?.unitWeight, p?.weightUnit);
                  const totalWeightText = formatWeightPair(p?.unitWeight, p?.weightUnit, l.qty);

                  return (
                    <div key={l.slug} className={styles.previewRow}>
                      <div>
                        <div className={styles.prodName}>{p?.name ?? l.slug}</div>
                        <div className={styles.prodModel}>
                          {p?.model ?? ""}
                          {pricing.tierApplied ? <span style={{ marginLeft: 8, opacity: 0.7 }}>(tier: {pricing.tierApplied})</span> : null}
                          {unitWeightText ? <span style={{ display: "block", marginTop: 3 }}>Unit weight: {unitWeightText}</span> : null}
                          {totalWeightText ? <span style={{ display: "block", marginTop: 2 }}>Total weight: {totalWeightText}</span> : null}
                        </div>
                      </div>
                      <div className={styles.productCode}>{l.slug}</div>
                      <div className={styles.num}>{l.qty}</div>
                      <div className={styles.num}>{formatMoney(unit)}</div>
                      <div className={styles.num}>{formatMoney(sub)}</div>
                    </div>
                  );
                })}

                <div className={styles.previewTotal}>
                  <div />
                  <div />
                  <div />
                  <div className={styles.totalLabel}>Total</div>
                  <div className={styles.numStrong}>{formatMoney(total)}</div>
                </div>

                {totalWeight.lb > 0 || totalWeight.kg > 0 ? (
                  <div className={styles.previewNote} style={{ marginTop: 8, fontSize: 12, lineHeight: 1.35, textAlign: "right" }}>
                    Total weight: {formatWeightPair(totalWeight.lb, "lb", 1)}
                  </div>
                ) : null}

                <div className={styles.previewNote} style={{ marginTop: 6, fontSize: 12, lineHeight: 1.35 }}>
                  Taxes not included. Applicable GST/HST/PST may apply. Shipping fees may apply.
                </div>

                <div className={styles.previewNote}>Secure login required. Our team will follow up to complete your request.</div>
              </>
            )}

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className={styles.secondaryCta} onClick={handleFinalizeOrder} disabled={!canFinalize} style={{ background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }}>
                {finalizing ? "Checking out..." : "Check out order"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
