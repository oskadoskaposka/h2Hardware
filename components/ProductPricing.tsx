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
}: {
  product: ProductLike;
  qty?: number;
}) {
  const currency = product.currency || "CAD";

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
