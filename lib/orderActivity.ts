export type OrderActivitySummary = {
  version: 1;
  startedAt: string;
  durationSeconds: number;
  productViews: { productId: string; views: number }[];
  searches: { term: string; count: number }[];
  cartAdditions: number;
  cartRemovals: number;
};

type StoredActivity = {
  version: 1;
  startedAt: number;
  updatedAt: number;
  productViews: Record<string, number>;
  searches: { term: string; count: number }[];
  cartAdditions: number;
  cartRemovals: number;
  lastProductId?: string;
  lastProductAt?: number;
};

const STORAGE_KEY = "h2_order_activity_v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PRODUCTS = 30;
const MAX_SEARCHES = 10;
const MAX_COUNTER = 9999;
const PRODUCT_VIEW_DEDUPE_MS = 30 * 1000;

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function clampCounter(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(MAX_COUNTER, Math.max(0, Math.floor(number)));
}

function newActivity(now = Date.now()): StoredActivity {
  return {
    version: 1,
    startedAt: now,
    updatedAt: now,
    productViews: {},
    searches: [],
    cartAdditions: 0,
    cartRemovals: 0,
  };
}

function normalizeActivity(value: unknown): StoredActivity {
  const now = Date.now();
  if (!value || typeof value !== "object") return newActivity(now);

  const source = value as Partial<StoredActivity>;
  const startedAt = Number(source.startedAt || now);
  const updatedAt = Number(source.updatedAt || startedAt);

  if (!Number.isFinite(startedAt) || now - startedAt > MAX_AGE_MS) {
    return newActivity(now);
  }

  const productViews: Record<string, number> = {};
  if (source.productViews && typeof source.productViews === "object") {
    for (const [rawId, rawViews] of Object.entries(source.productViews).slice(0, MAX_PRODUCTS)) {
      const productId = String(rawId || "").trim().slice(0, 120);
      const views = clampCounter(rawViews);
      if (productId && views > 0) productViews[productId] = views;
    }
  }

  const searches = Array.isArray(source.searches)
    ? source.searches
        .map((entry) => ({
          term: String(entry?.term || "").trim().replace(/\s+/g, " ").slice(0, 80),
          count: clampCounter(entry?.count),
        }))
        .filter((entry) => entry.term.length >= 2 && entry.count > 0)
        .slice(0, MAX_SEARCHES)
    : [];

  return {
    version: 1,
    startedAt,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : startedAt,
    productViews,
    searches,
    cartAdditions: clampCounter(source.cartAdditions),
    cartRemovals: clampCounter(source.cartRemovals),
    lastProductId: String(source.lastProductId || "").trim().slice(0, 120) || undefined,
    lastProductAt: Number.isFinite(Number(source.lastProductAt))
      ? Number(source.lastProductAt)
      : undefined,
  };
}

function readActivity(): StoredActivity {
  if (!isBrowser()) return newActivity();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return newActivity();
    return normalizeActivity(JSON.parse(raw));
  } catch {
    return newActivity();
  }
}

function writeActivity(activity: StoredActivity) {
  if (!isBrowser()) return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...activity, updatedAt: Date.now() }),
  );
}

export function trackProductView(productIdValue: unknown) {
  if (!isBrowser()) return;

  const productId = String(productIdValue || "").trim().slice(0, 120);
  if (!productId) return;

  const now = Date.now();
  const activity = readActivity();

  if (
    activity.lastProductId === productId &&
    activity.lastProductAt &&
    now - activity.lastProductAt < PRODUCT_VIEW_DEDUPE_MS
  ) {
    return;
  }

  const alreadyTracked = Object.prototype.hasOwnProperty.call(
    activity.productViews,
    productId,
  );

  if (alreadyTracked || Object.keys(activity.productViews).length < MAX_PRODUCTS) {
    activity.productViews[productId] = clampCounter(
      (activity.productViews[productId] || 0) + 1,
    );
  }

  activity.lastProductId = productId;
  activity.lastProductAt = now;
  writeActivity(activity);
}

export function trackSearch(searchValue: unknown) {
  if (!isBrowser()) return;

  const term = String(searchValue || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);

  if (term.length < 2) return;

  const activity = readActivity();
  const normalized = term.toLowerCase();
  const existing = activity.searches.find(
    (entry) => entry.term.toLowerCase() === normalized,
  );

  if (existing) {
    existing.count = clampCounter(existing.count + 1);
  } else if (activity.searches.length < MAX_SEARCHES) {
    activity.searches.push({ term, count: 1 });
  }

  writeActivity(activity);
}

export function trackCartAddition(quantity: unknown = 1) {
  if (!isBrowser()) return;
  const amount = clampCounter(quantity);
  if (amount <= 0) return;

  const activity = readActivity();
  activity.cartAdditions = clampCounter(activity.cartAdditions + amount);
  writeActivity(activity);
}

export function trackCartRemoval(quantity: unknown = 1) {
  if (!isBrowser()) return;
  const amount = clampCounter(quantity);
  if (amount <= 0) return;

  const activity = readActivity();
  activity.cartRemovals = clampCounter(activity.cartRemovals + amount);
  writeActivity(activity);
}

export function getOrderActivitySummary(): OrderActivitySummary | null {
  if (!isBrowser()) return null;

  const activity = readActivity();
  const productViews = Object.entries(activity.productViews)
    .map(([productId, views]) => ({ productId, views: clampCounter(views) }))
    .filter((entry) => entry.productId && entry.views > 0)
    .slice(0, MAX_PRODUCTS);

  const searches = activity.searches
    .map((entry) => ({ term: entry.term, count: clampCounter(entry.count) }))
    .filter((entry) => entry.term.length >= 2 && entry.count > 0)
    .slice(0, MAX_SEARCHES);

  const hasActivity =
    productViews.length > 0 ||
    searches.length > 0 ||
    activity.cartAdditions > 0 ||
    activity.cartRemovals > 0;

  if (!hasActivity) return null;

  return {
    version: 1,
    startedAt: new Date(activity.startedAt).toISOString(),
    durationSeconds: Math.min(
      Math.floor(MAX_AGE_MS / 1000),
      Math.max(0, Math.floor((Date.now() - activity.startedAt) / 1000)),
    ),
    productViews,
    searches,
    cartAdditions: clampCounter(activity.cartAdditions),
    cartRemovals: clampCounter(activity.cartRemovals),
  };
}

export function clearOrderActivitySummary() {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}
