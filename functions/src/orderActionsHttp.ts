import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = "us-central1";
const DEFAULT_ADMIN_EMAILS = new Set([
  "maia@h2hardwareltd.com", "admin@starpro.com", "admin@h2hardware.com", "admin@h2hardwareltd.com",
]);
for (const email of `${process.env.ADMIN_EMAILS || ""},${process.env.NEXT_PUBLIC_ADMIN_EMAILS || ""}`.split(",")) {
  if (email.trim()) DEFAULT_ADMIN_EMAILS.add(email.trim().toLowerCase());
}

type Actor = { uid: string; email: string; admin: boolean };
type RequestedItem = { slug: string; qty: number };

function text(value: unknown) { return String(value ?? "").trim(); }
function number(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function status(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as any).code) : "";
  if (code.includes("unauthenticated")) return 401;
  if (code.includes("permission-denied")) return 403;
  if (code.includes("not-found")) return 404;
  if (code.includes("failed-precondition")) return 412;
  if (code.includes("invalid-argument")) return 400;
  return 500;
}

async function actorFrom(req: any): Promise<Actor> {
  const token = text(req.get("authorization")).match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpsError("unauthenticated", "Login is required.");
  const decoded = await getAuth().verifyIdToken(token);
  const email = text(decoded.email).toLowerCase();
  return { uid: decoded.uid, email, admin: decoded.admin === true || DEFAULT_ADMIN_EMAILS.has(email) };
}

function requestedItems(value: unknown): RequestedItem[] {
  if (!Array.isArray(value)) throw new HttpsError("invalid-argument", "Items are required.");
  const result = value.map((item: any) => ({ slug: text(item?.slug || item?.productId), qty: Math.floor(number(item?.qty)) }));
  if (!result.length || result.some((item) => !item.slug || item.qty < 1)) {
    throw new HttpsError("invalid-argument", "Every item must have a product and a positive whole quantity.");
  }
  if (new Set(result.map((item) => item.slug)).size !== result.length) {
    throw new HttpsError("invalid-argument", "Duplicate products are not allowed.");
  }
  return result;
}

function price(product: any, qty: number) {
  const tiers = [...(Array.isArray(product.tiers) ? product.tiers : Array.isArray(product.discountTiers) ? product.discountTiers : [])]
    .sort((a, b) => number(a.minQty) - number(b.minQty));
  const tier = tiers.find((entry) => qty >= number(entry.minQty) && qty <= (entry.maxQty == null ? Infinity : number(entry.maxQty)));
  return { unit: number(tier?.price ?? product.publicPrice ?? product.price), tier: tier?.id ?? null };
}

function weights(product: any, qty: number) {
  const raw = Math.max(0, number(product.unitWeight));
  const unit = text(product.weightUnit).toLowerCase() === "kg" ? "kg" : "lb";
  const lb = unit === "lb" ? raw : raw * 2.2046226218;
  const kg = unit === "kg" ? raw : raw * 0.45359237;
  return { unitWeight: raw, weightUnit: unit, unitWeightLb: lb, unitWeightKg: kg, totalWeightLb: lb * qty, totalWeightKg: kg * qty };
}

async function saveOrder(actor: Actor, body: any) {
  const items = requestedItems(body.items);
  const shippingAddress = text(body.shippingAddress);
  if (!shippingAddress) throw new HttpsError("invalid-argument", "Delivery address is required.");
  const orderId = text(body.orderId);
  const orderRef = orderId ? db.collection("orders").doc(orderId) : db.collection("orders").doc();

  await db.runTransaction(async (tx) => {
    const oldSnap = await tx.get(orderRef);
    const old = oldSnap.data() || {};
    if (oldSnap.exists && old.uid !== actor.uid) throw new HttpsError("permission-denied", "This order does not belong to you.");
    if (oldSnap.exists && old.canCustomerEdit !== true) throw new HttpsError("failed-precondition", "Editing for this order is locked.");

    const oldQty = new Map<string, number>((Array.isArray(old.items) ? old.items : []).map((item: any) => [text(item.slug || item.productId), Math.floor(number(item.qty))]));
    const allSlugs = [...new Set([...oldQty.keys(), ...items.map((item) => item.slug)])];
    const productRefs = allSlugs.map((slug) => db.collection("products").doc(slug));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));
    const products = new Map(productSnaps.map((snap) => [snap.id, snap]));

    for (const requested of items) {
      if (!products.get(requested.slug)?.exists) throw new HttpsError("not-found", `Product ${requested.slug} was not found.`);
    }
    for (const slug of allSlugs) {
      const snap = products.get(slug)!;
      if (!snap.exists) continue;
      const nextQty = items.find((item) => item.slug === slug)?.qty ?? 0;
      const delta = nextQty - (oldQty.get(slug) ?? 0);
      const stock = Math.floor(number(snap.data()?.stock));
      if (delta > stock) throw new HttpsError("failed-precondition", `Not enough stock for ${slug}.`);
      if (delta !== 0) tx.update(snap.ref, { stock: stock - delta });
    }

    let total = 0, totalWeightLb = 0, totalWeightKg = 0;
    const snapshots = items.map((requested) => {
      const product = products.get(requested.slug)!.data() || {};
      const pricing = price(product, requested.qty);
      const weight = weights(product, requested.qty);
      total += pricing.unit * requested.qty;
      totalWeightLb += weight.totalWeightLb;
      totalWeightKg += weight.totalWeightKg;
      return { slug: requested.slug, productId: requested.slug, name: product.name ?? requested.slug, model: product.model ?? "", qty: requested.qty, unitPriceApplied: pricing.unit, tierApplied: pricing.tier, ...weight };
    });

    const customer = oldSnap.exists ? old.customer : {
      name: text(body.customer?.name), phone: text(body.customer?.phone), email: text(body.customer?.email || actor.email),
    };
    tx.set(orderRef, {
      ...(oldSnap.exists ? {} : { uid: actor.uid, userEmail: actor.email, createdAt: FieldValue.serverTimestamp(), currency: "CAD", canCustomerEdit: true, revision: 0, customer, ...(body.analyticsSummary ? { analyticsSummary: body.analyticsSummary } : {}) }),
      items: snapshots, shippingAddress, total, totalWeightLb, totalWeightKg,
      revision: Math.floor(number(old.revision)) + 1,
      lastEditedAt: FieldValue.serverTimestamp(), lastEditedByUid: actor.uid, lastEditedByEmail: actor.email,
    }, { merge: true });
  });
  return { ok: true, orderId: orderRef.id };
}

export const orderActionsHttp = onRequest({ region: REGION, cors: false }, async (req, res) => {
  try {
    if (req.method !== "POST") throw new HttpsError("invalid-argument", "Only POST is supported.");
    const actor = await actorFrom(req);
    const body = req.body?.data || req.body || {};
    if (body.action === "save") res.status(200).json(await saveOrder(actor, body));
    else if (body.action === "set-editing") {
      if (!actor.admin) throw new HttpsError("permission-denied", "Only admins can change editing access.");
      const orderId = text(body.orderId);
      if (!orderId) throw new HttpsError("invalid-argument", "orderId is required.");
      await db.collection("orders").doc(orderId).update({ canCustomerEdit: body.canCustomerEdit === true });
      res.status(200).json({ ok: true, canCustomerEdit: body.canCustomerEdit === true });
    } else throw new HttpsError("invalid-argument", "Unknown action.");
  } catch (error: any) {
    res.status(status(error)).json({ error: text(error?.message) || "Order action failed." });
  }
});
