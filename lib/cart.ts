import { resolveUnitPrice } from "./pricing";

/**
 * Carrinho no localStorage. Ele guarda SOMENTE:
 * - slug
 * - qty
 *
 * O preço SEMPRE é calculado “ao vivo” usando o produto do Firestore (publicPrice + tiers).
 */

const KEY = "starpro_cart_v1";
const CART_CHANGED_EVENT = "starpro_cart_changed_v1";

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

function readCart(): CartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({
        slug: String(x?.slug || "").trim(),
        qty: Number(x?.qty || 0),
      }))
      .filter((x) => x.slug && Number.isFinite(x.qty) && x.qty > 0);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (!isBrowser()) return;
  localStorage.setItem(KEY, JSON.stringify(items));
  emitCartChanged();
}

/**
 * Adiciona um item no carrinho (se já existir, soma qty).
 */
export function addToCart(slug: string, qty: number = 1) {
  const s = String(slug || "").trim();
  const q = Math.max(1, Math.floor(Number(qty || 1)));

  const items = readCart();
  const idx = items.findIndex((x) => x.slug === s);

  if (idx >= 0) items[idx].qty += q;
  else items.push({ slug: s, qty: q });

  writeCart(items);
}

/**
 * Atualiza a quantidade de um item no carrinho.
 * Se qty <= 0, remove.
 */
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

/**
 * Remove um item do carrinho.
 */
export function removeFromCart(slug: string) {
  const s = String(slug || "").trim();
  const items = readCart().filter((x) => x.slug !== s);
  writeCart(items);
}

/**
 * Limpa o carrinho.
 */
export function clearCart() {
  writeCart([]);
}

/**
 * Retorna os itens brutos (slug/qty).
 */
export function getCartItems(): CartItem[] {
  return readCart();
}

/**
 * Converte itens brutos em linhas “ricas”, associando o produto pelo slug.
 * Você passa a lista de produtos já carregada (ex: do Firestore).
 *
 * Importante: se um slug não existir nos produtos, ele é ignorado.
 */
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

/**
 * Permite páginas (Carrinho/Checkout) “escutarem” mudanças do carrinho.
 */
export function onCartChanged(handler: () => void) {
  if (!isBrowser()) return () => {};
  const fn = () => handler();
  window.addEventListener(CART_CHANGED_EVENT, fn);
  return () => window.removeEventListener(CART_CHANGED_EVENT, fn);
}

/* =========================================================================================
   COMPAT: funções antigas de preço (agora adaptadas pro modelo A)
   - Ideal: páginas novas NÃO devem depender disso.
   - Mas mantém o build intacto se algum lugar ainda importar.
========================================================================================= */

/**
 * Tipos antigos (mantidos por compatibilidade)
 */
export type CustomerType = "public" | "regular";

/**
 * Calcula preço unitário pelo NOVO modelo.
 * - publicPrice sempre existe (ou fallback 0)
 * - tiers depende da qty
 *
 * OBS: assinatura antiga era (product, customerType). Agora aceitamos:
 * - unitPriceFor(product, qty)
 * - unitPriceFor(product, customerType)  -> assume qty=1 (compat)
 */
export function unitPriceFor(
  product: {
    publicPrice?: number;
    tiers?: { id?: string; minQty: number; maxQty?: number | null; price: number }[];
    currency?: string;

    // fallback legacy
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

/**
 * Total do carrinho: soma(unitPriceApplied * qty)
 * Assinatura antiga era (lines, customerType). Agora ignoramos customerType e usamos qty.
 */
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
