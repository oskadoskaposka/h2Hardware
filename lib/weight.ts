export type WeightUnit = "lb" | "kg";

const LB_TO_KG = 0.45359237;
const KG_TO_LB = 2.2046226218;

export function safeWeightNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeWeightUnit(value: unknown): WeightUnit {
  const clean = String(value ?? "").trim().toLowerCase();
  return clean === "kg" ? "kg" : "lb";
}

export function getWeightPair(unitWeight: unknown, weightUnit: unknown = "lb", qty: unknown = 1) {
  const rawUnitWeight = Math.max(0, safeWeightNumber(unitWeight));
  const safeQty = Math.max(1, Math.floor(safeWeightNumber(qty) || 1));
  const unit = normalizeWeightUnit(weightUnit);

  if (rawUnitWeight <= 0) {
    return {
      hasWeight: false,
      sourceUnit: unit,
      sourceUnitWeight: 0,
      unitWeightLb: 0,
      unitWeightKg: 0,
      totalWeightLb: 0,
      totalWeightKg: 0,
    };
  }

  const unitWeightLb = unit === "lb" ? rawUnitWeight : rawUnitWeight * KG_TO_LB;
  const unitWeightKg = unit === "kg" ? rawUnitWeight : rawUnitWeight * LB_TO_KG;

  return {
    hasWeight: true,
    sourceUnit: unit,
    sourceUnitWeight: rawUnitWeight,
    unitWeightLb,
    unitWeightKg,
    totalWeightLb: unitWeightLb * safeQty,
    totalWeightKg: unitWeightKg * safeQty,
  };
}

function trimFixed(value: number, decimals: number) {
  return value
    .toFixed(decimals)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

export function formatWeight(value: unknown, unit: WeightUnit) {
  const n = safeWeightNumber(value);
  const decimals = Math.abs(n) >= 100 ? 1 : 2;
  return `${trimFixed(n, decimals)} ${unit}`;
}

export function formatWeightPair(unitWeight: unknown, weightUnit: unknown = "lb", qty: unknown = 1) {
  const pair = getWeightPair(unitWeight, weightUnit, qty);
  if (!pair.hasWeight) return "";
  return `${formatWeight(pair.totalWeightLb, "lb")} / ${formatWeight(pair.totalWeightKg, "kg")}`;
}

export function formatUnitWeightPair(unitWeight: unknown, weightUnit: unknown = "lb") {
  return formatWeightPair(unitWeight, weightUnit, 1);
}
