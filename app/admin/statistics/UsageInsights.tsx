"use client";

import { useMemo, type ReactNode } from "react";

type UsageOrder = {
  id?: string;
  uid?: string;
  userEmail?: string;
  customer?: { name?: string; email?: string };
  items?: { slug?: string; productId?: string; name?: string }[];
  analyticsSummary?: {
    durationSeconds?: number;
    productViews?: { productId?: string; views?: number }[];
    searches?: { term?: string; count?: number }[];
    cartAdditions?: number;
    cartRemovals?: number;
  };
};

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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

export default function UsageInsights({ orders }: { orders: UsageOrder[] }) {
  const usage = useMemo(() => {
    const productNames = new Map<string, string>();
    const viewedNotOrdered = new Map<
      string,
      { productId: string; name: string; views: number; orders: number }
    >();
    const customers = new Map<
      string,
      {
        key: string;
        name: string;
        email: string;
        orders: number;
        productViews: number;
        uniqueProducts: Set<string>;
        searches: number;
        cartChanges: number;
        durationSeconds: number;
      }
    >();

    let trackedOrders = 0;
    let totalViews = 0;
    let totalSearches = 0;
    let totalUniqueProducts = 0;
    let totalCartChanges = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const order of orders || []) {
      for (const item of Array.isArray(order.items) ? order.items : []) {
        const productId = String(item.productId || item.slug || "").trim();
        const name = String(item.name || productId).trim();
        if (productId && name) productNames.set(productId, name);
      }
    }

    for (const order of orders || []) {
      const summary = order.analyticsSummary;
      if (!summary) continue;

      trackedOrders += 1;

      const purchasedIds = new Set(
        (Array.isArray(order.items) ? order.items : [])
          .map((item) => String(item.productId || item.slug || "").trim())
          .filter(Boolean),
      );

      const customerEmail = String(order.customer?.email || order.userEmail || "")
        .trim()
        .toLowerCase();
      const customerName = String(order.customer?.name || "").trim();
      const customerKey = customerEmail || String(order.uid || "").trim() || String(order.id || "unknown");
      const customer = customers.get(customerKey) || {
        key: customerKey,
        name: customerName,
        email: customerEmail,
        orders: 0,
        productViews: 0,
        uniqueProducts: new Set<string>(),
        searches: 0,
        cartChanges: 0,
        durationSeconds: 0,
      };

      customer.orders += 1;
      if (customerName) customer.name = customerName;
      if (customerEmail) customer.email = customerEmail;

      const viewedIds = new Set<string>();
      for (const view of Array.isArray(summary.productViews) ? summary.productViews : []) {
        const productId = String(view?.productId || "").trim();
        const views = Math.max(0, Math.floor(safeNumber(view?.views)));
        if (!productId || views <= 0) continue;

        viewedIds.add(productId);
        customer.uniqueProducts.add(productId);
        customer.productViews += views;
        totalViews += views;

        if (!purchasedIds.has(productId)) {
          const current = viewedNotOrdered.get(productId) || {
            productId,
            name: productNames.get(productId) || productId,
            views: 0,
            orders: 0,
          };
          current.views += views;
          current.orders += 1;
          viewedNotOrdered.set(productId, current);
        }
      }

      totalUniqueProducts += viewedIds.size;

      const searches = (Array.isArray(summary.searches) ? summary.searches : []).reduce(
        (sum, search) => sum + Math.max(0, Math.floor(safeNumber(search?.count))),
        0,
      );
      const cartChanges =
        Math.max(0, Math.floor(safeNumber(summary.cartAdditions))) +
        Math.max(0, Math.floor(safeNumber(summary.cartRemovals)));
      const duration = Math.max(0, Math.floor(safeNumber(summary.durationSeconds)));

      customer.searches += searches;
      customer.cartChanges += cartChanges;
      customer.durationSeconds += duration;
      totalSearches += searches;
      totalCartChanges += cartChanges;

      if (duration > 0) {
        totalDuration += duration;
        durationCount += 1;
      }

      customers.set(customerKey, customer);
    }

    const activeCustomers = Array.from(customers.values())
      .map((customer) => ({
        ...customer,
        uniqueProductCount: customer.uniqueProducts.size,
        activityScore: customer.productViews + customer.searches + customer.cartChanges,
      }))
      .sort((a, b) => b.activityScore - a.activityScore || b.orders - a.orders)
      .slice(0, 10);

    const notOrderedProducts = Array.from(viewedNotOrdered.values())
      .sort((a, b) => b.views - a.views || b.orders - a.orders)
      .slice(0, 10);

    return {
      trackedOrders,
      averageViews: trackedOrders ? totalViews / trackedOrders : 0,
      averageUniqueProducts: trackedOrders ? totalUniqueProducts / trackedOrders : 0,
      averageSearches: trackedOrders ? totalSearches / trackedOrders : 0,
      averageCartChanges: trackedOrders ? totalCartChanges / trackedOrders : 0,
      averageDuration: durationCount ? totalDuration / durationCount : 0,
      activeCustomers,
      notOrderedProducts,
    };
  }, [orders]);

  return (
    <section className="usageSection">
      <div className="usageHeader">
        <div>
          <div className="usageEyebrow">Site usage</div>
          <h2>How customers browse before ordering</h2>
        </div>
        <span>{usage.trackedOrders} tracked order{usage.trackedOrders === 1 ? "" : "s"}</span>
      </div>

      <div className="usageMetrics">
        <UsageMetric label="Avg. product views" value={usage.averageViews.toFixed(1)} />
        <UsageMetric label="Avg. different products" value={usage.averageUniqueProducts.toFixed(1)} />
        <UsageMetric label="Avg. searches" value={usage.averageSearches.toFixed(1)} />
        <UsageMetric label="Avg. cart changes" value={usage.averageCartChanges.toFixed(1)} />
        <UsageMetric label="Avg. time before order" value={usage.averageDuration ? formatDuration(usage.averageDuration) : "—"} />
      </div>

      <div className="usageGrid">
        <UsageTable
          title="Most active customers before ordering"
          headers={["Customer", "Orders", "Products", "Views", "Searches", "Cart changes"]}
          empty="Customer activity will appear after new tracked orders."
          rows={usage.activeCustomers.map((customer) => [
            <div key={customer.key} className="usageCustomer">
              <strong>{customer.name || customer.email || customer.key}</strong>
              {customer.name && customer.email ? <span>{customer.email}</span> : null}
            </div>,
            customer.orders,
            customer.uniqueProductCount,
            customer.productViews,
            customer.searches,
            customer.cartChanges,
          ])}
        />

        <UsageTable
          title="Viewed products not included in the order"
          headers={["Product", "Views", "Tracked orders"]}
          empty="No viewed-but-not-ordered products yet."
          rows={usage.notOrderedProducts.map((product) => [
            <div key={product.productId} className="usageProduct">
              <strong>{product.name}</strong>
              <span>{product.productId}</span>
            </div>,
            product.views,
            product.orders,
          ])}
        />
      </div>

      <style jsx>{`
        .usageSection { margin-top: 18px; }
        .usageHeader { display: flex; justify-content: space-between; gap: 16px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 12px; }
        .usageEyebrow { color: #b91c1c; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
        h2 { margin: 4px 0 0; color: #0f172a; font-size: 22px; }
        .usageHeader > span { color: #64748b; font-size: 12px; font-weight: 800; }
        .usageMetrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
        .usageGrid { margin-top: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
        :global(.usageMetric) { min-width: 0; padding: 13px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
        :global(.usageMetricLabel) { color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; }
        :global(.usageMetricValue) { margin-top: 5px; color: #0f172a; font-size: 19px; font-weight: 950; overflow-wrap: anywhere; }
        :global(.usageTable) { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; }
        :global(.usageTableTitle) { padding: 12px 14px; background: #111; color: #fff; border-bottom: 3px solid #b91c1c; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
        :global(.usageTableWrap) { overflow-x: auto; }
        :global(.usageTable table) { width: 100%; min-width: 560px; border-collapse: collapse; }
        :global(.usageTable th), :global(.usageTable td) { padding: 10px 12px; border-bottom: 1px solid #eef2f7; text-align: left; vertical-align: top; color: #0f172a; font-size: 12px; }
        :global(.usageTable th) { background: #fbfcfd; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
        :global(.usageTable tr:last-child td) { border-bottom: none; }
        :global(.usageEmpty) { padding: 20px !important; color: #64748b !important; text-align: center !important; }
        .usageCustomer, .usageProduct { display: grid; gap: 2px; min-width: 170px; }
        .usageCustomer strong, .usageProduct strong { font-size: 12px; }
        .usageCustomer span, .usageProduct span { color: #64748b; font-size: 10px; overflow-wrap: anywhere; }
        @media (max-width: 1050px) { .usageMetrics { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 900px) { .usageGrid { grid-template-columns: 1fr; } }
        @media (max-width: 620px) { .usageMetrics { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function UsageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="usageMetric">
      <div className="usageMetricLabel">{label}</div>
      <div className="usageMetricValue">{value}</div>
    </div>
  );
}

function UsageTable({
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
    <section className="usageTable">
      <div className="usageTableTitle">{title}</div>
      <div className="usageTableWrap">
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
              <tr><td className="usageEmpty" colSpan={headers.length}>{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
