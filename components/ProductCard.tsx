"use client";

import Link from "next/link";
import { Product } from "../data/products";
import styles from "../styles/product-card.module.css";
import { useCustomerType } from "../lib/session";

export default function ProductCard({ product }: { product: Product }) {
  const customerType = useCustomerType();

  return (
    <Link href={`/product/${product.slug}`} className={styles.card}>
      <div className={styles.top}>
        <div className={styles.title}>{product.name}</div>
        <div className={styles.meta}>{product.model}</div>
      </div>

      <div className={styles.bottom}>
        {customerType === "regular" ? (
          <div className={styles.priceBlock}>
            <span className={styles.price}>
              {Math.round(product.price * (1 - product.regularDiscount)).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </span>
            <span className={styles.hint}>Regular customer</span>
          </div>
        ) : (
          <div className={styles.priceBlock}>
            <span className={styles.price}>
              {product.price.toLocaleString("en-US", { style: "currency", currency: "USD" })}
            </span>
            <span className={styles.hint}>Login to see discount</span>
          </div>
        )}
      </div>
    </Link>
  );
}
