"use client";

import styles from "../styles/product.module.css";
import { resolveUnitPrice } from "../lib/pricing";

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
  isLogged = false,
}: {
  product: ProductLike;
  qty?: number;
  isLogged?: boolean;
}) {
  const currency = product.currency || "CAD";

  if (!isLogged) {
    return (
      <div className={styles.priceBox}>
        <div>
          <div className={styles.label}>Pricing</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700, color: "#111827", lineHeight: 1.25 }}>
            Available after sign in
          </div>
          <div style={{ marginTop: 6, color: "#64748b", fontSize: 13, fontWeight: 500, lineHeight: 1.45 }}>
            Customer pricing is shown after account access.
          </div>
        </div>
      </div>
    );
  }

  const result = resolveUnitPrice(
    {
      publicPrice: product.publicPrice,
      currency,
      tiers: product.tiers || [],
    },
    qty,
  );

  return (
    <div className={styles.priceBox}>
      <div>
        <div className={styles.label}>Price {qty > 1 ? `(qty ${qty})` : ""}</div>
        <div className={styles.price}>
          {result.unitPriceApplied.toLocaleString("en-CA", {
            style: "currency",
            currency,
          })}
        </div>
      </div>
    </div>
  );
}
