"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { app, auth } from "../../../../lib/firebaseClient";
import { isAdminUser } from "../../../../lib/admin";
import UsageInsights from "../UsageInsights";

type PeriodValue = "30" | "90" | "365" | "all";

type UsageOrder = {
  id: string;
  uid?: string;
  userEmail?: string;
  createdAt?: any;
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

const MAX_ORDERS_READ = 500;

function toDate(value: any): Date | null {
  if (value?.toDate instanceof Function) {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function SiteUsageStatisticsPage() {
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<UsageOrder[]>([]);
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
            ...(document.data() as Omit<UsageOrder, "id">),
          })),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load site usage statistics.",
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

  if (!authReady || loading) {
    return <main className="page"><div className="wrap">Loading site usage…</div></main>;
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
            <h1>Site Usage</h1>
            <p>Shows how customers browse before submitting an order.</p>
          </div>

          <div className="actions">
            <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodValue)}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
              <option value="all">All loaded orders</option>
            </select>
            <Link href="/admin/statistics">Business Statistics</Link>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <UsageInsights orders={periodOrders} />
      </div>

      <style jsx>{`
        .page { min-height: 72vh; background: #f4f6f8; padding: 26px 0 60px; }
        .wrap { max-width: 1280px; margin: 0 auto; padding: 0 18px; }
        .header { display: flex; justify-content: space-between; gap: 22px; align-items: flex-start; flex-wrap: wrap; }
        .eyebrow { color: #b91c1c; text-transform: uppercase; letter-spacing: .09em; font-size: 12px; font-weight: 900; }
        h1 { margin: 6px 0 8px; color: #0f172a; font-size: 32px; line-height: 1.1; }
        p { margin: 0; max-width: 760px; color: #64748b; line-height: 1.55; }
        .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .actions select, .actions a { height: 42px; box-sizing: border-box; border-radius: 10px; border: 1px solid #dbe1e8; background: #fff; padding: 0 13px; color: #0f172a; font: inherit; font-weight: 800; }
        .actions a { display: inline-flex; align-items: center; text-decoration: none; color: #b91c1c; }
        .error { margin-top: 18px; padding: 13px; border: 1px solid rgba(185,28,28,.25); border-left: 5px solid #b91c1c; border-radius: 10px; background: #fff; color: #7f1d1d; font-weight: 800; }
        @media (max-width: 620px) { h1 { font-size: 27px; } }
      `}</style>
    </main>
  );
}
