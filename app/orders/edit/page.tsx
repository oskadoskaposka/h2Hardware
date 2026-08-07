"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, getFirestore } from "firebase/firestore";
import { app, auth } from "../../../lib/firebaseClient";
import { orderAction } from "../../../lib/orderActions";

type Line = { slug: string; name: string; qty: number };

function EditOrderForm() {
  const orderId = useSearchParams().get("id") || "";
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [products, setProducts] = useState<Line[]>([]);
  const [address, setAddress] = useState("");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user || !orderId) { setError("Order not found."); setLoading(false); return; }
    try {
      const db = getFirestore(app);
      const [order, productList] = await Promise.all([getDoc(doc(db, "orders", orderId)), getDocs(collection(db, "products"))]);
      const data: any = order.data();
      if (!order.exists() || data.uid !== user.uid || data.canCustomerEdit !== true) throw new Error("Editing for this order is locked.");
      setAddress(String(data.shippingAddress || ""));
      setLines((Array.isArray(data.items) ? data.items : []).map((item: any) => ({ slug: item.slug || item.productId, name: item.name || item.slug, qty: Number(item.qty) || 1 })));
      setProducts(productList.docs.map((item) => ({ slug: item.id, name: String(item.data().name || item.id), qty: 1 })));
    } catch (e: any) { setError(e.message || "Failed to load order."); }
    finally { setLoading(false); }
  }), [orderId]);

  const available = useMemo(() => products.filter((p) => !lines.some((line) => line.slug === p.slug)), [products, lines]);
  async function save() {
    const user = auth.currentUser;
    if (!user || !lines.length || !address.trim()) return;
    setSaving(true); setError("");
    try {
      await orderAction(user, { action: "save", orderId, shippingAddress: address, items: lines.map(({ slug, qty }) => ({ slug, qty })) });
      router.push("/orders");
    } catch (e: any) { setError(e.message || "Failed to save order."); setSaving(false); }
  }

  return <main style={{ padding: 24, background: "#f4f6f8", minHeight: "70vh" }}>
    <section style={{ maxWidth: 760, margin: "0 auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
      <h1 style={{ marginTop: 0 }}>Edit order</h1>
      {loading ? <p>Loading…</p> : error && !lines.length ? <p style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</p> : <>
        <div style={{ display: "grid", gap: 10 }}>
          {lines.map((line) => <div key={line.slug} style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px", gap: 10, alignItems: "center" }}>
            <div><strong>{line.name}</strong><div style={{ color: "#64748b", fontSize: 12 }}>{line.slug}</div></div>
            <input aria-label={`Quantity for ${line.name}`} type="number" min={1} step={1} value={line.qty} onChange={(e) => setLines((all) => all.map((item) => item.slug === line.slug ? { ...item, qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : item))} style={{ padding: 10 }} />
            <button type="button" onClick={() => setLines((all) => all.filter((item) => item.slug !== line.slug))}>Remove</button>
          </div>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ flex: 1, padding: 10 }}><option value="">Add a product…</option>{available.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
          <button type="button" disabled={!selected} onClick={() => { const product = products.find((p) => p.slug === selected); if (product) setLines((all) => [...all, product]); setSelected(""); }}>Add</button>
        </div>
        <label style={{ display: "grid", gap: 6, marginTop: 20, fontWeight: 800 }}>Delivery address<textarea rows={4} value={address} onChange={(e) => setAddress(e.target.value)} style={{ padding: 12, resize: "vertical" }} /></label>
        {error ? <p style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</p> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}><button type="button" onClick={save} disabled={saving || !lines.length || !address.trim()}>{saving ? "Saving…" : "Save changes"}</button><Link href="/orders">Cancel</Link></div>
      </>}
    </section>
  </main>;
}

export default function EditOrderPage() {
  return <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}><EditOrderForm /></Suspense>;
}
