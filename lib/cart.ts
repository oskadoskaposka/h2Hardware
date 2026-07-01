import { resolveUnitPrice } from "./pricing";

const KEY = "starpro_cart_v1";
const CART_CHANGED_EVENT = "starpro_cart_changed_v1";
const CART_MAX_AGE_MS = 48 * 60 * 60 * 1000;

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emitCartChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

export type CartItem = {
  slug: string;
  qty: number;
};

export type CartLine<TProduct = any> = {
  slug: string;
  qty: number;
  product: TProduct;
};

function normalizeItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((x: any) => ({
      slug: String(x?.slug || "").trim(),
      qty: Number(x?.qty || 0),
    }))
    .filter((x) => x.slug && Number.isFinite(x.qty) && x.qty > 0)
    .map((x) => ({ slug: x.slug, qty: Math.max(1, Math.floor(x.qty)) }));
}

function isExpired(updatedAt: unknown) {
  const value = Number(updatedAt || 0);
  return Number.isFinite(value) && value > 0 && Date.now() - value > CART_MAX_AGE_MS;
}

function readCart(): CartItem[] {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return normalizeItems(parsed);
    }

    if (isExpired(parsed?.updatedAt)) {
      localStorage.removeItem(KEY);
      emitCartChanged();
      return [];
    }

    return normalizeItems(parsed?.items);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (!isBrowser()) return;

  const cleanItems = normalizeItems(items);

  if (cleanItems.length === 0) {
    localStorage.removeItem(KEY);
  } else {
    localStorage.setItem(KEY, JSON.stringify({ items: cleanItems, updatedAt: Date.now() }));
  }

  emitCartChanged();
}

export function addToCart(slug: string, qty: number = 1) {
  const s = String(slug || "").trim();
  const q = Math.max(1, Math.floor(Number(qty || 1)));

  const items = readCart();
  const idx = items.findIndex((x) => x.slug === s);

  if (idx >= 0) items[idx].qty += q;
  else items.push({ slug: s, qty: q });

  writeCart(items);
}

export function updateQty(slug: string, qty: number) {
  const s = String(slug || "").trim();
  const q = Math.floor(Number(qty || 0));

  const items = readCart();
  const idx = items.findIndex((x) => x.slug === s);
  if (idx < 0) return;

  if (q <= 0) items.splice(idx, 1);
  else items[idx].qty = q;

  writeCart(items);
}

export function removeFromCart(slug: string) {
  const s = String(slug || "").trim();
  const items = readCart().filter((x) => x.slug !== s);
  writeCart(items);
}

export function clearCart() {
  writeCart([]);
}

export function getCartItems(): CartItem[] {
  return readCart();
}

export function getCartItemCount(): number {
  return readCart().reduce((sum, item) => {
    const qty = Math.max(0, Math.floor(Number(item.qty || 0)));
    return sum + qty;
  }, 0);
}

export function getCartLines<TProduct extends { slug?: string }>(
  products: TProduct[]
): CartLine<TProduct>[] {
  const items = readCart();
  if (!Array.isArray(products)) return [];

  const bySlug = new Map<string, TProduct>();
  for (const p of products) {
    const s = String((p as any)?.slug || "").trim();
    if (s) bySlug.set(s, p);
  }

  const lines: CartLine<TProduct>[] = [];
  for (const it of items) {
    const p = bySlug.get(it.slug);
    if (!p) continue;
    lines.push({ slug: it.slug, qty: it.qty, product: p });
  }

  return lines;
}

export function onCartChanged(handler: () => void) {
  if (!isBrowser()) return () => {};
  const fn = () => handler();
  window.addEventListener(CART_CHANGED_EVENT, fn);
  return () => window.removeEventListener(CART_CHANGED_EVENT, fn);
}

export type CustomerType = "public" | "regular";

export function unitPriceFor(
  product: {
    publicPrice?: number;
    tiers?: { id?: string; minQty: number; maxQty?: number | null; price: number }[];
    currency?: string;
    price?: number;
    discountTiers?: any[];
  },
  qtyOrCustomerType: number | CustomerType = 1
) {
  const qty =
    typeof qtyOrCustomerType === "number"
      ? Math.max(1, Math.floor(qtyOrCustomerType))
      : 1;

  const pricing = {
    publicPrice: Number((product as any)?.publicPrice ?? (product as any)?.price ?? 0),
    currency: String((product as any)?.currency ?? "CAD"),
    tiers: Array.isArray((product as any)?.tiers)
      ? (product as any).tiers
      : Array.isArray((product as any)?.discountTiers)
        ? (product as any).discountTiers
        : [],
  };

  const r = resolveUnitPrice(pricing as any, qty);
  return Number(r.unitPriceApplied ?? 0);
}

export function getCartTotal(
  lines: Array<{ qty: number; product: any }>,
  _customerType?: CustomerType
) {
  return (lines || []).reduce((sum, l) => {
    const qty = Math.max(1, Math.floor(Number(l?.qty || 1)));
    const unit = unitPriceFor(l.product, qty);
    return sum + unit * qty;
  }, 0);
}

export function getQtyInCart(slug: string) {
  const s = String(slug || "").trim();
  const items = getCartItems();
  const found = items.find((x) => x.slug === s);
  return found ? found.qty : 0;
}
