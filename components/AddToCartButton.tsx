"use client";

import { useState } from "react";
import { addToCart } from "../lib/cart";

export default function AddToCartButton({
  slug,
  qty,
  className,
  disabled,
  onAdded,
}: {
  slug: string;
  qty: number;
  className?: string;
  disabled?: boolean;
  onAdded?: () => void;
}) {
  const [justAdded, setJustAdded] = useState(false);

  function handleClick() {
    if (disabled) return;

    addToCart(slug, qty);

    setJustAdded(true);
    onAdded?.();

    window.setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <button type="button" className={className} disabled={disabled} onClick={handleClick}>
      {disabled ? "Out of stock" : justAdded ? "Added!" : "Add to cart"}
    </button>
  );
}
