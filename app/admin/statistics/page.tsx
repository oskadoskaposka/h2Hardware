"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { app, auth } from "../../../lib/firebaseClient";
import { isAdminUser } from "../../../lib/admin";
import { formatWeight } from "../../../lib/weight";

type ActivitySummary = {
  version?: number;
  startedAt?: string;
  durationSeconds?: number;
  productViews?: { productId?: string; views?: number }[];
  searches?: { term?: string; count?: number }[];
  cartAdditions?: number;
  cartRemovals?: number;
};

type OrderItem = {
  slug?: string;
  productId?: string;
  name?: string;
  qty?: number;
  unitPriceApplied?: number;
  unitPrice?: number;
  totalWeightLb?: number;
  totalWeightKg?: number;
};

type OrderDoc = {
  id: string;
  uid?: string;
  userEmail?: string;
  createdAt?: any;
  total?: number;
  currency?: string;
  totalWeightLb?: number;
  totalWeightKg?: number;
  customer?: { name?: string; email?: string; phone?: string };
  items?: OrderItem[];
  analyticsSummary?: ActivitySummary;
};

type PeriodValue = "30" | "90" | "365" | "all";

const MAX_ORDERS_READ = 500;

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toDate(value: any): Date | null {
  if (value?.toDate instanceof Function) {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMoney(value: unknown, currency = "CAD") {
  const amount = safeNumber(value);
  try {
    return amount.toLocaleString("en-CA", { style: "currency", currency });
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDuration(secondsValue: unknown) {
  const seconds = Math.max(0, Math.floor(safeNumber(secondsValue)));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatWeightPair(lbValue: unknown, kgValue: unknown) {
  const lb = safeNumber(lbValue);
  const kg = safeNumber(kgValue);
  if (lb <= 0 && kg <= 0) return "—";
  return `${formatWeight(lb, "lb")} / ${formatWeight(kg, "kg")}`;
}

function orderLabel(orderId: string) {
  return `ORDER-${String(orderId || "").slice(0, 8).toUpperCase()}`;
}

export default function BusinessStatisticsPage() {
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<PeriodValue>("90");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const allowed = await isAdminUser(user);
      setIsAdmin(allowed);
      setAuthReady(true);
      if (!allowed) setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !isAdmin) return;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const db = getFirestore(app);
        const snapshot = await getDocs(
          query(
            collection(db, "orders"),
            orderBy("createdAt", "desc"),
            limit(MAX_ORDERS_READ),
          ),
        );

        setOrders(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Omit<OrderDoc, "id">),
          })),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load business statistics.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [authReady, isAdmin]);

  const periodOrders = useMemo(() => {
    if (period === "all") return orders;

    const cutoff = Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    return orders.filter((order) => {
      const date = toDate(order.createdAt);
      return !!date && date.getTime() >= cutoff;
    });
  }, [orders, period]);

  const statistics = useMemo(() => {
    const products = new Map<
      string,
      {
        productId: string;
        name: string;
        units: number;
        revenue: number;
        orders: number;
        weightLb: number;
        weightKg: number;
      }
    >();
    const productNames = new Map<string, string>();
    const views = new Map<string, number>();
    const searches = new Map<string, { term: string; count: number }>();
    const customers = new Map<
      string,
      {
        key: string;
        name: string;
        email: string;
        orders: number;
        value: number;
        activity: number;
        weightLb: number;
        weightKg: number;
        lastOrderAt: Date | null;
      }
    >();
    const freightOrders: {
      id: string;
      customer: string;
      value: number;
      currency: string;
      weightLb: number;
      weightKg: number;
      createdAt: Date | null;
    }[] = [];

    let totalValue = 0;
    let totalWeightLb = 0;
    let totalWeightKg = 0;
    let behaviorOrders = 0;
    let totalViews = 0;
    let cartAdditions = 0;
    let cartRemovals = 0;
    let durationTotal = 0;
    let durationCount = 0;

    for (const order of periodOrders) {
      const currency = order.currency || "CAD";
      const orderValue = safeNumber(order.total);
      const orderWeightLb = safeNumber(order.totalWeightLb);
      const orderWeightKg = safeNumber(order.totalWeightKg);
      const orderDate = toDate(order.createdAt);
      const customerEmail = String(order.customer?.email || order.userEmail || "")
        .trim()
        .toLowerCase();
      const customerName = String(order.customer?.name || "").trim();
      const customerDisplay = customerName || customerEmail || String(order.uid || "").trim() || "Unknown customer";

      totalValue += orderValue;
      totalWeightLb += orderWeightLb;
      totalWeightKg += orderWeightKg;

      if (orderWeightLb > 0 || orderWeightKg > 0) {
        freightOrders.push({
          id: order.id,
          customer: customerDisplay,
          value: orderValue,
          currency,
          weightLb: orderWeightLb,
          weightKg: orderWeightKg,
          createdAt: orderDate,
        });
      }

      const seenProducts = new Set<string>();
      for (const item of Array.isArray(order.items) ? order.items : []) {
        const productId = String(item.productId || item.slug || "").trim();
        if (!productId) continue;

        const name = String(item.name || productId).trim() || productId;
        const qty = Math.max(0, Math.floor(safeNumber(item.qty)));
        const unitPrice =
          typeof item.unitPriceApplied === "number"
            ? safeNumber(item.unitPriceApplied)
            : safeNumber(item.unitPrice);

        productNames.set(productId, name);

        const current = products.get(productId) || {
          productId,
          name,
          units: 0,
          revenue: 0,
          orders: 0,
          weightLb: 0,
          weightKg: 0,
        };

        current.units += qty;
        current.revenue += qty * unitPrice;
        current.weightLb += safeNumber(item.totalWeightLb);
        current.weightKg += safeNumber(item.totalWeightKg);
        if (!seenProducts.has(productId)) current.orders += 1;
        products.set(productId, current);
        seenProducts.add(productId);
      }

      const customerKey = customerEmail || String(order.uid || "").trim() || order.id;
      const customer = customers.get(customerKey) || {
        key: customerKey,
        name: customerName,
        email: customerEmail,
        orders: 0,
        value: 0,
        activity: 0,
        weightLb: 0,
        weightKg: 0,
        lastOrderAt: null,
      };

      customer.orders += 1;
      customer.value += orderValue;
      customer.weightLb += orderWeightLb;
      customer.weightKg += orderWeightKg;
      if (customerName) customer.name = customerName;
      if (customerEmail) customer.email = customerEmail;
      if (orderDate && (!customer.lastOrderAt || orderDate > customer.lastOrderAt)) {
        customer.lastOrderAt = orderDate;
      }

      const activity = order.analyticsSummary;
      if (activity) {
        behaviorOrders += 1;
        const additions = Math.max(0, Math.floor(safeNumber(activity.cartAdditions)));
        const removals = Math.max(0, Math.floor(safeNumber(activity.cartRemovals)));
        cartAdditions += additions;
        cartRemovals += removals;
        customer.activity += additions + removals;

        const duration = Math.max(0, Math.floor(safeNumber(activity.durationSeconds)));
        if (duration > 0) {
          durationTotal += duration;
          durationCount += 1;
        }

        for (const view of Array.isArray(activity.productViews)
          ? activity.productViews
          : []) {
          const productId = String(view?.productId || "").trim();
          const count = Math.max(0, Math.floor(safeNumber(view?.views)));
          if (!productId || count <= 0) continue;
          views.set(productId, (views.get(productId) || 0) + count);
          totalViews += count;
          customer.activity += count;
        }

        for (const search of Array.isArray(activity.searches)
          ? activity.searches
          : []) {
          const term = String(search?.term || "").trim();
          const count = Math.max(0, Math.floor(safeNumber(search?.count)));
          if (!term || count <= 0) continue;
          const key = term.toLowerCase();
          const current = searches.get(key) || { term, count: 0 };
          current.count += count;
          searches.set(key, current);
        }
      }

      customers.set(customerKey, customer);
    }

    const topProducts = Array.from(products.values())
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 10);

    const topWeightProducts = Array.from(products.values())
      .filter((product) => product.weightLb > 0 || product.weightKg > 0)
      .sort((a, b) => b.weightLb - a.weightLb || b.weightKg - a.weightKg)
      .slice(0, 10);

    const topViewedProducts = Array.from(views.entries())
      .map(([productId, count]) => ({
        productId,
        name: productNames.get(productId) || productId,
        views: count,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const topCustomersByWeight = Array.from(customers.values())
      .filter((customer) => customer.weightLb > 0 || customer.weightKg > 0)
      .sort((a, b) => b.weightLb - a.weightLb || b.weightKg - a.weightKg)
      .slice(0, 10);

    const topSearches = Array.from(searches.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const heaviestOrders = freightOrders
      .sort((a, b) => b.weightLb - a.weightLb || b.weightKg - a.weightKg)
      .slice(0, 10);

    return {
      orderCount: periodOrders.length,
      totalValue,
      averageOrder: periodOrders.length ? totalValue / periodOrders.length : 0,
      totalWeightLb,
      totalWeightKg,
      averageWeightLb: periodOrders.length ? totalWeightLb / periodOrders.length : 0,
      averageWeightKg: periodOrders.length ? totalWeightKg / periodOrders.length : 0,
      customerCount: customers.size,
      behaviorOrders,
      totalViews,
      cartAdditions,
      cartRemovals,
      averageDuration: durationCount ? durationTotal / durationCount : 0,
      topProducts,
      topWeightProducts,
      topViewedProducts,
      topCustomersByWeight,
      topSearches,
      heaviestOrders,
    };
  }, [periodOrders]);

  if (!authReady || loading) {
    return <main className="page"><div className="wrap">Loading statistics…</div></main>;
  }

  if (!isAdmin) {
    return <main className="page"><div className="wrap"><h1>Access denied</h1></div></main>;
  }

  return (
    <main className="page">
      <div className="wrap">
        <div className="header">
          <div>
            <div className="eyebrow">H2 Hardware</div>
            <h1>Business Statistics</h1>
            <p>Sales, customer, freight and site usage insights based on completed orders.</p>
          </div>
          <div className="actions">
            <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodValue)}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
              <option value="all">All loaded orders</option>
            </select>
            <Link href="/admin/orders">View orders</Link>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <section className="cards">
          <MetricCard label="Orders" value={String(statistics.orderCount)} />
          <MetricCard label="Order value" value={formatMoney(statistics.totalValue)} />
          <MetricCard label="Average order" value={formatMoney(statistics.averageOrder)} />
          <MetricCard label="Customers" value={String(statistics.customerCount)} />
          <MetricCard
            label="Total weight"
            value={formatWeightPair(statistics.totalWeightLb, statistics.totalWeightKg)}
          />
          <MetricCard
            label="Average weight / order"
            value={formatWeightPair(statistics.averageWeightLb, statistics.averageWeightKg)}
          />
        </section>

        <section className="activityCard">
          <div>
            <span>Tracked orders</span>
            <strong>{statistics.behaviorOrders}</strong>
          </div>
          <div>
            <span>Product views</span>
            <strong>{statistics.totalViews}</strong>
          </div>
          <div>
            <span>Cart additions</span>
            <strong>{statistics.cartAdditions}</strong>
          </div>
          <div>
            <span>Cart removals</span>
            <strong>{statistics.cartRemovals}</strong>
          </div>
          <div>
            <span>Average time before order</span>
            <strong>{statistics.averageDuration ? formatDuration(statistics.averageDuration) : "—"}</strong>
          </div>
        </section>

        <div className="grid">
          <StatsTable
            title="Top products by units"
            empty="No orders in this period."
            headers={["Product", "Orders", "Units", "Weight", "Value"]}
            rows={statistics.topProducts.map((product) => [
              <ProductCell key={product.productId} name={product.name} id={product.productId} />,
              product.orders,
              product.units,
              formatWeightPair(product.weightLb, product.weightKg),
              formatMoney(product.revenue),
            ])}
          />

          <StatsTable
            title="Products generating the most freight weight"
            empty="Product weight data will appear on newer orders."
            headers={["Product", "Units", "Total weight", "Value"]}
            rows={statistics.topWeightProducts.map((product) => [
              <ProductCell key={product.productId} name={product.name} id={product.productId} />,
              product.units,
              formatWeightPair(product.weightLb, product.weightKg),
              formatMoney(product.revenue),
            ])}
          />

          <StatsTable
            title="Customers generating the most freight weight"
            empty="Customer weight data will appear on newer orders."
            headers={["Customer", "Orders", "Total weight", "Avg. weight", "Value"]}
            rows={statistics.topCustomersByWeight.map((customer) => [
              <CustomerCell key={customer.key} customer={customer} />,
              customer.orders,
              formatWeightPair(customer.weightLb, customer.weightKg),
              formatWeightPair(
                customer.orders ? customer.weightLb / customer.orders : 0,
                customer.orders ? customer.weightKg / customer.orders : 0,
              ),
              formatMoney(customer.value),
            ])}
          />

          <StatsTable
            title="Heaviest orders"
            empty="Order weight data will appear on newer orders."
            headers={["Order", "Customer", "Weight", "Value"]}
            rows={statistics.heaviestOrders.map((order) => [
              <div key={order.id} className="orderCell">
                <strong>{orderLabel(order.id)}</strong>
                {order.createdAt ? <span>{order.createdAt.toLocaleDateString("en-CA")}</span> : null}
              </div>,
              order.customer,
              formatWeightPair(order.weightLb, order.weightKg),
              formatMoney(order.value, order.currency),
            ])}
          />

          <StatsTable
            title="Most viewed products before orders"
            empty="Behavior data will appear after new orders are submitted."
            headers={["Product", "Views"]}
            rows={statistics.topViewedProducts.map((product) => [
              <ProductCell key={product.productId} name={product.name} id={product.productId} />,
              product.views,
            ])}
          />

          <StatsTable
            title="Searches that led to product views"
            empty="Search data will appear after new orders are submitted."
            headers={["Search", "Count"]}
            rows={statistics.topSearches.map((search) => [search.term, search.count])}
          />
        </div>

        <div className="note">
          Weight is useful for identifying freight-heavy customers, products and orders, but it is not a complete shipping quote.
          Carrier pricing may also depend on destination, dimensions, packaging and pallet requirements. Only completed orders are saved.
        </div>
      </div>

      <style jsx>{`
        .page { min-height: 72vh; background: #f4f6f8; padding: 26px 0 60px; }
        .wrap { max-width: 1280px; margin: 0 auto; padding: 0 18px; }
        .header { display: flex; justify-content: space-between; gap: 22px; align-items: flex-start; flex-wrap: wrap; }
        .eyebrow { color: #b91c1c; text-transform: uppercase; letter-spacing: .09em; font-size: 12px; font-weight: 900; }
        h1 { margin: 6px 0 8px; color: #0f172a; font-size: 32px; line-height: 1.1; }
        p { margin: 0; max-width: 800px; color: #64748b; line-height: 1.55; }
        .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .actions select, .actions a { height: 42px; box-sizing: border-box; border-radius: 10px; border: 1px solid #dbe1e8; background: #fff; padding: 0 13px; color: #0f172a; font: inherit; font-weight: 800; }
        .actions a { display: inline-flex; align-items: center; text-decoration: none; color: #b91c1c; }
        .error { margin-top: 18px; padding: 13px; border: 1px solid rgba(185,28,28,.25); border-left: 5px solid #b91c1c; border-radius: 10px; background: #fff; color: #7f1d1d; font-weight: 800; }
        .cards { margin-top: 22px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .activityCard { margin-top: 12px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 14px; background: #e2e8f0; }
        .activityCard > div { background: #fff; padding: 15px; display: grid; gap: 5px; }
        .activityCard span { color: #64748b; font-size: 12px; font-weight: 800; }
        .activityCard strong { color: #0f172a; font-size: 18px; }
        .grid { margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
        .note { margin-top: 18px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 13px 14px; background: #fff; color: #64748b; font-size: 13px; line-height: 1.5; }
        :global(.metricCard) { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 15px; min-width: 0; }
        :global(.metricLabel) { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
        :global(.metricValue) { margin-top: 7px; color: #0f172a; font-size: 22px; line-height: 1.2; font-weight: 950; overflow-wrap: anywhere; }
        :global(.statsTable) { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
        :global(.statsTableTitle) { padding: 13px 14px; background: #111; color: #fff; border-bottom: 3px solid #b91c1c; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
        :global(.tableWrap) { overflow-x: auto; }
        :global(.statsTable table) { width: 100%; border-collapse: collapse; min-width: 560px; }
        :global(.statsTable th), :global(.statsTable td) { padding: 11px 13px; border-bottom: 1px solid #eef2f7; text-align: left; color: #0f172a; font-size: 13px; vertical-align: top; }
        :global(.statsTable th) { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; background: #fbfcfd; }
        :global(.statsTable tr:last-child td) { border-bottom: none; }
        :global(.emptyRow) { color: #64748b !important; text-align: center !important; padding: 20px !important; }
        :global(.productCell), :global(.customerCell), .orderCell { display: grid; gap: 2px; min-width: 160px; }
        :global(.productCell strong), :global(.customerCell strong), .orderCell strong { font-size: 13px; }
        :global(.productCell span), :global(.customerCell span), .orderCell span { color: #64748b; font-size: 11px; overflow-wrap: anywhere; }
        @media (max-width: 1050px) { .activityCard { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 900px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid { grid-template-columns: 1fr; } }
        @media (max-width: 620px) { .cards, .activityCard { grid-template-columns: 1fr; } h1 { font-size: 27px; } }
      `}</style>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metricCard">
      <div className="metricLabel">{label}</div>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function ProductCell({ name, id }: { name: string; id: string }) {
  return (
    <div className="productCell">
      <strong>{name}</strong>
      <span>{id}</span>
    </div>
  );
}

function CustomerCell({
  customer,
}: {
  customer: {
    key: string;
    name: string;
    email: string;
    lastOrderAt: Date | null;
  };
}) {
  return (
    <div className="customerCell">
      <strong>{customer.name || customer.email || customer.key}</strong>
      {customer.name && customer.email ? <span>{customer.email}</span> : null}
      {customer.lastOrderAt ? (
        <span>Last order: {customer.lastOrderAt.toLocaleDateString("en-CA")}</span>
      ) : null}
    </div>
  );
}

function StatsTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return (
    <section className="statsTable">
      <div className="statsTableTitle">{title}</div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                </tr>
              ))
            ) : (
              <tr><td className="emptyRow" colSpan={headers.length}>{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
