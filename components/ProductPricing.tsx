"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import styles from "../styles/product.module.css";
import { resolveUnitPrice } from "../lib/pricing";
import { auth } from "../lib/firebaseClient";

type Tier = {
  id?: string;
  minQty: number;
  maxQty?: number | null;
  price: number;
};

type ProductLike = {
  publicPrice: number;
  tiers?: Tier[];
  currency?: string;
};

export default function ProductPricing({
  product,
  qty = 1,
}: {
  product: ProductLike;
  qty?: number;
}) {
  const [isLogged, setIsLogged] = useState(false);
  const currency = product.currency || "CAD";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setIsLogged(!!user));
    return () => unsub();
  }, []);

  if (!isLogged) {
    return (
      <div className={styles.priceBox}>
        <div>
          <div className={styles.label}>Pricing</div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 1000, color: "#111", fontSize: 18 }}>
              Log in to view pricing
            </div>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
              Approved customers can view pricing and submit orders after login.
            </div>
            <Link
              href="/login"
              prefetch={false}
              style={{
                width: "fit-content",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 36,
                padding: "0 12px",
                borderRadius: 10,
                background: "#b91c1c",
                color: "#fff",
                fontSize: 13,
                fontWeight: 900,
                textDecoration: "none",
              }}
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { unitPriceApplied } = resolveUnitPrice(
    {
      publicPrice: product.publicPrice,
      currency,
      tiers: product.tiers || [],
    },
    qty
  );

  return (
    <div className={styles.priceBox}>
      <div>
        <div className={styles.label}>
          Price {qty > 1 ? `(qty ${qty})` : ""}
        </div>

        <div className={styles.price}>
          {unitPriceApplied.toLocaleString("en-CA", {
            style: "currency",
            currency,
          })}
        </div>
      </div>
    </div>
  );
}
