// app/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { resolveUnitPrice } from "../../lib/pricing";

type OrderItem = {
  slug: string;
  name?: string;
  model?: string;
  qty: number;

  unitPriceApplied: number;
  tierApplied: string | null;
};

type CustomerProfile = {
  name?: string;
  phone?: string;
  email?: string;
};

function safeNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(safeNumber(v));
}

export default function CheckoutPage() {
  const router = useRouter();

  const [isLogged, setIsLogged] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const cartLinesSafe = useMemo(
    () => (Array.isArray(cartLines) ? cartLines : []),
    [cartLines]
  );

  const [finalizing, setFinalizing] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  // Customer info (now read-only)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(false);

  /* ================= AUTH + PROFILE ================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const logged = !!u;
      setIsLogged(logged);

      const em = u?.email ?? "";
      setUserEmail(em);

      // Load profile if logged
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
              // fallback to auth email
              setCustomerEmail(String(u.email || ""));
            }
          } catch {
            // keep silent, checkout still works
            setCustomerEmail(String(u.email || ""));
          } finally {
            setLoadingProfile(false);
          }
        })();
      } else {
        // logged out: allow empty preview
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
      }
    });

    return () => unsub();
  }, []);

  /* ================= PRODUCTS (Firestore) ================= */
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

  /* ================= CART ================= */
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

      const pricing = {
        publicPrice: Number(p.publicPrice ?? p.price ?? 0),
        currency: String(p.currency ?? "CAD"),
        tiers: Array.isArray(p.tiers)
          ? p.tiers
          : Array.isArray(p.discountTiers)
            ? p.discountTiers
            : [],
      };

      const r = resolveUnitPrice(pricing as any, l.qty);
      return sum + safeNumber(r.unitPriceApplied) * safeNumber(l.qty);
    }, 0);
  }, [cartLinesSafe]);

  const isEmpty = cartLinesSafe.length === 0;

  const customer = useMemo(
    () => ({
      name: customerName.trim(),
      email: (customerEmail || userEmail || "").trim(),
      phone: customerPhone.trim(),
    }),
    [customerName, customerEmail, userEmail, customerPhone]
  );

  const customerType = useMemo(() => "tiered" as any, []);

  const items = useMemo(() => {
    return cartLinesSafe.map((l) => {
      const p: any = l.product || {};

      const pricing = {
        publicPrice: Number(p.publicPrice ?? p.price ?? 0),
        currency: String(p.currency ?? "CAD"),
        tiers: Array.isArray(p.tiers)
          ? p.tiers
          : Array.isArray(p.discountTiers)
            ? p.discountTiers
            : [],
      };

      const r = resolveUnitPrice(pricing as any, l.qty);
      const unit = safeNumber(r.unitPriceApplied);
      const subtotal = unit * safeNumber(l.qty);

      return {
        slug: l.slug,
        name: p?.name ?? l.slug,
        model: p?.model ?? "",
        qty: l.qty,
        unit,
        subtotal,
        tierApplied: r.tierApplied ?? null,
      } as any;
    });
  }, [cartLinesSafe]);

  // ✅ Stock decrement (requires Firestore rules to allow signed-in update of stock)
  async function decrementStockForOrder(
    orderItems: { slug: string; qty: number }[]
  ) {
    const db = getFirestore(app);

    for (const it of orderItems) {
      const qty = Math.max(0, Math.floor(safeNumber(it.qty)));
      if (!qty) continue;

      const ref = doc(db, "products", it.slug);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;

        const data: any = snap.data() || {};
        const current = Number(data.stock ?? 0);

        if (!Number.isFinite(current)) return;

        const next = Math.max(0, Math.floor(current) - qty);
        tx.update(ref, { stock: next });
      });
    }
  }

  async function handleFinalizeOrder() {
    setUiError(null);

    const user = auth.currentUser;

    if (!user) {
      setUiError("Please login to finalize your order.");
      return;
    }
    if (isEmpty) {
      setUiError("Your cart is empty.");
      return;
    }

    setFinalizing(true);
    try {
      const db = getFirestore(app);

      const orderItems: OrderItem[] = cartLinesSafe.map((l) => {
        const p: any = l.product || {};

        const pricing = {
          publicPrice: Number(p.publicPrice ?? p.price ?? 0),
          currency: String(p.currency ?? "CAD"),
          tiers: Array.isArray(p.tiers)
            ? p.tiers
            : Array.isArray(p.discountTiers)
              ? p.discountTiers
              : [],
        };

        const r = resolveUnitPrice(pricing as any, l.qty);

        return {
          slug: l.slug,
          name: p?.name ?? l.slug,
          model: p?.model ?? "",
          qty: l.qty,
          unitPriceApplied: safeNumber(r.unitPriceApplied),
          tierApplied: r.tierApplied ?? null,
        };
      });

      // 1) create order
      await addDoc(collection(db, "orders"), {
        uid: user.uid,
        userEmail: user.email ?? "",
        createdAt: serverTimestamp(),
        currency: "CAD",
        total: safeNumber(total),
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          email: (customerEmail || user.email || "").trim(),
        },
        items: orderItems,
      });

      // 2) decrement stock (signed-in users, per rules)
      await decrementStockForOrder(
        orderItems.map((x) => ({ slug: x.slug, qty: x.qty }))
      );

      clearCart();
      router.push("/orders");
    } catch (e: any) {
      setUiError(e?.message ?? "Failed to finalize order.");
    } finally {
      setFinalizing(false);
    }
  }

  const canFinalize = isLogged && !isEmpty && !finalizing;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Checkout</h1>
      <p className={styles.subtitle}>
        Review your quote and place your order. Our team will follow up to
        complete your request.
      </p>

      <div className={styles.grid}>
        {/* LEFT */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Customer details</h2>

          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            value={customerName}
            disabled
            style={{ opacity: 0.7, cursor: "not-allowed" }}
            placeholder="Your full name"
            onChange={() => {}}
          />

          <label className={styles.label}>Phone</label>
          <input
            className={styles.input}
            value={customerPhone}
            disabled
            style={{ opacity: 0.7, cursor: "not-allowed" }}
            placeholder="(XXX) XXX-XXXX"
            onChange={() => {}}
          />

          <label className={styles.label}>Email</label>
          <input
            className={styles.input}
            value={customerEmail}
            disabled
            style={{ opacity: 0.7, cursor: "not-allowed" }}
            placeholder="you@email.com"
            onChange={() => {}}
          />

          {!isLogged ? (
            <div className={styles.badge}>
              Login required to finalize.{" "}
              <a href="/login" style={{ color: "inherit", fontWeight: 800 }}>
                Go to Login
              </a>
            </div>
          ) : loadingProfile ? (
            <div className={styles.badge}>Loading your details…</div>
          ) : (
            <a
              href="/login"
              className={styles.badge}
              style={{
                display: "inline-flex",
                gap: 8,
                alignItems: "center",
                textDecoration: "none",
                cursor: "pointer",
              }}
              aria-label="Edit details in login"
            >
              Edit details in Login
            </a>
          )}

          <div className={styles.steps}>
            <h3>How it works</h3>
            <p>
              1) Review your quote and download the PDF if needed.
              <br />
              2) Place your order and our team will take care of the next steps.
            </p>

            {uiError ? (
              <p style={{ color: "#b10000", fontWeight: 800 }}>{uiError}</p>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div>
                <GenerateQuotePdfButton
                  items={items}
                  customer={customer}
                  customerType={customerType}
                />
              </div>
            </div>

            {!isLogged ? (
              <p style={{ marginTop: 10 }}>
                Want to finalize? Please{" "}
                <a
                  href="/login"
                  style={{ fontWeight: 800, color: "var(--brand)" }}
                >
                  login
                </a>
                .
              </p>
            ) : null}
          </div>
        </section>

        {/* RIGHT: PREVIEW */}
        <aside className={styles.preview}>
          <div className={styles.previewHeader}>
            <div className={styles.brand}>StarPro Doors</div>
            <div className={styles.small}>Quote preview</div>
          </div>

          <div className={styles.previewBody}>
            <div className={styles.previewInfo}>
              <div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Customer:</span>{" "}
                  {customerName || "—"}
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Phone:</span>{" "}
                  {customerPhone || "—"}
                </div>
              </div>

              <div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email:</span>{" "}
                  {customerEmail || userEmail || "—"}
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Type:</span> {"tiered"}
                </div>
              </div>
            </div>

            <div className={styles.previewTableHeader}>
              <div>Item</div>
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
                  const pricing = {
                    publicPrice: Number(p.publicPrice ?? p.price ?? 0),
                    currency: String(p.currency ?? "CAD"),
                    tiers: Array.isArray(p.tiers)
                      ? p.tiers
                      : Array.isArray(p.discountTiers)
                        ? p.discountTiers
                        : [],
                  };

                  const r = resolveUnitPrice(pricing as any, l.qty);
                  const unit = safeNumber(r.unitPriceApplied);
                  const sub = unit * safeNumber(l.qty);

                  return (
                    <div key={l.slug} className={styles.previewRow}>
                      <div>
                        <div className={styles.prodName}>
                          {p?.name ?? l.slug}
                        </div>
                        <div className={styles.prodModel}>
                          {p?.model ?? ""}
                          {r.tierApplied ? (
                            <span style={{ marginLeft: 8, opacity: 0.7 }}>
                              (tier: {r.tierApplied})
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className={styles.num}>{l.qty}</div>
                      <div className={styles.num}>{formatMoney(unit)}</div>
                      <div className={styles.num}>{formatMoney(sub)}</div>
                    </div>
                  );
                })}

                <div className={styles.previewTotal}>
                  <div />
                  <div />
                  <div className={styles.totalLabel}>Total</div>
                  <div className={styles.numStrong}>{formatMoney(total)}</div>
                </div>

                <div
                  className={styles.previewNote}
                  style={{ marginTop: 6, fontSize: 12, lineHeight: 1.35 }}
                >
                  Taxes not included. Applicable GST/HST/PST may apply. Shipping
                  fees may apply.
                </div>

                <div className={styles.previewNote}>
                  Secure login required. Our team will follow up to complete
                  your request.
                </div>
              </>
            )}

            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className={styles.secondaryCta}
                onClick={handleFinalizeOrder}
                disabled={!canFinalize}
                style={{
                  background: "var(--brand)",
                  borderColor: "var(--brand)",
                  color: "#fff",
                }}
              >
                {finalizing ? "Finalizing..." : "Finalize order"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
