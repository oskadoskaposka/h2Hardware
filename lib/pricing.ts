// ../lib/pricing.ts
export type PriceTier = {
  id?: string;
  minQty: number;          // inclusive
  maxQty?: number | null;  // inclusive; null = sem teto
  price: number;           // preço unitário na faixa
};

export type ProductPricingData = {
  publicPrice: number;
  currency: string;        // ex: "CAD"
  tiers?: PriceTier[];
};

export function resolveUnitPrice(pricing: ProductPricingData, qty: number) {
  const q = Math.max(1, Math.floor(Number(qty) || 1));

  const publicPrice = Number(pricing?.publicPrice ?? 0);
  const tiers = Array.isArray(pricing?.tiers) ? [...pricing.tiers] : [];

  tiers.sort((a, b) => Number(a.minQty ?? 0) - Number(b.minQty ?? 0));

  const match = tiers.find(t => {
    const min = Number(t.minQty ?? 0);
    const max =
      t.maxQty === null || t.maxQty === undefined ? Infinity : Number(t.maxQty);
    return q >= min && q <= max;
  });

  const unitPriceApplied = Number(match?.price ?? publicPrice);
  const tierApplied = match?.id ?? null;

  return { qty: q, unitPriceApplied, tierApplied, matchedTier: match ?? null };
}
