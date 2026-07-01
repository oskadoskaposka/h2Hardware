"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { app } from "../lib/firebaseClient";
import DownloadCatalogPdfButton from "./DownloadCatalogPdfButton";

type CatalogProduct = {
  slug: string;
  name: string;
  series?: string;
  category?: string;
  description?: string;
  images?: string[];
  features?: string[];
  sortOrder?: number;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export default function CatalogPdfDownloadCard() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const db = getFirestore(app);
        const productsQuery = query(
          collection(db, "products"),
          where("active", "==", true),
          orderBy("sortOrder", "asc"),
        );

        const snap = await getDocs(productsQuery);
        const list: CatalogProduct[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            slug: clean(data.slug || docSnap.id),
            name: clean(data.name || docSnap.id),
            series: clean(data.series || "Other") || "Other",
            category: clean(data.category || ""),
            description: clean(data.description || ""),
            images: Array.isArray(data.images) ? data.images.map((item: unknown) => clean(item)).filter(Boolean) : [],
            features: Array.isArray(data.features) ? data.features.map((item: unknown) => clean(item)).filter(Boolean) : [],
            sortOrder: Number(data.sortOrder ?? 9999),
          };
        });

        list.sort(
          (a, b) =>
            Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999) ||
            clean(a.name).localeCompare(clean(b.name)),
        );

        if (mounted) setProducts(list);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Unable to prepare catalog PDF.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="catalogPdfCard" aria-label="Download catalog PDF">
      <div className="catalogPdfText">
        <div className="catalogPdfEyebrow">Product catalog</div>
        <div className="catalogPdfTitle">Download a clean PDF catalog</div>
        <div className="catalogPdfDescription">
          Includes active products, categories, item codes and product images. Pricing remains available after sign in.
        </div>
        {error ? <div className="catalogPdfError">{error}</div> : null}
      </div>

      <div className="catalogPdfAction">
        <DownloadCatalogPdfButton products={products} />
        <div className="catalogPdfMeta">
          {loading ? "Preparing product list..." : `${products.length} products included`}
        </div>
      </div>

      <style jsx>{`
        .catalogPdfCard {
          width: min(1200px, calc(100% - 36px));
          margin: 18px auto 0;
          padding: 16px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background:
            radial-gradient(500px 120px at 0% 0%, rgba(185, 28, 28, 0.08), transparent 65%),
            #ffffff;
          box-shadow: 0 8px 20px rgba(17, 24, 39, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .catalogPdfText {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .catalogPdfEyebrow {
          color: #b91c1c;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .catalogPdfTitle {
          color: #0f172a;
          font-size: 17px;
          font-weight: 900;
          line-height: 1.25;
        }

        .catalogPdfDescription {
          color: #64748b;
          font-size: 13px;
          line-height: 1.4;
          max-width: 680px;
        }

        .catalogPdfAction {
          display: grid;
          justify-items: end;
          gap: 6px;
          flex: 0 0 auto;
        }

        .catalogPdfMeta {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
        }

        .catalogPdfError {
          color: #7f1d1d;
          font-size: 12px;
          font-weight: 800;
        }

        :global(.catalogPdfButton) {
          min-height: 40px;
          padding: 0 15px;
          border-radius: 12px;
          border: 1px solid #b91c1c;
          background: #b91c1c;
          color: #ffffff;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 900;
          box-shadow: 0 8px 18px rgba(185, 28, 28, 0.16);
          white-space: nowrap;
        }

        :global(.catalogPdfButton:hover:not(:disabled)) {
          background: #991b1b;
          border-color: #991b1b;
        }

        :global(.catalogPdfButton:disabled) {
          opacity: 0.65;
          cursor: not-allowed;
          box-shadow: none;
        }

        @media (max-width: 760px) {
          .catalogPdfCard {
            align-items: stretch;
            flex-direction: column;
          }

          .catalogPdfAction {
            justify-items: stretch;
          }

          :global(.catalogPdfButton) {
            width: 100%;
          }

          .catalogPdfMeta {
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}
