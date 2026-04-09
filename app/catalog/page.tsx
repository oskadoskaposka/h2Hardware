// app/catalog/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  getDoc,
  doc,
} from "firebase/firestore";
import { app } from "../../lib/firebaseClient";

type Product = {
  slug: string;
  name: string;

  // series = Category (principal)
  series: string;

  // category = Subcategory (opcional)
  category?: string;

  description?: string;

  // compat: publicPrice (novo) ou price (legado)
  price: number;
  currency: string;

  active: boolean;
  sortOrder?: number;

  images: string[];
  features: string[];
};

type CarouselLinkType = "filter" | "product" | "page" | "url";

type CarouselSlide = {
  src?: string;
  alt: string;

  title: string;
  subtitle?: string;

  linkType?: CarouselLinkType;

  // filter
  series?: string;
  category?: string;

  // product
  productSlug?: string;

  // internal page
  pagePath?: string;

  // external url
  url?: string;
};

function normalizeLinkType(v: any): CarouselLinkType {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "product" || s === "page" || s === "url") return s;
  return "filter";
}

function normalizeInternalPath(p: string) {
  const v = String(p ?? "").trim();
  if (!v) return "";
  return v.startsWith("/") ? v : `/${v}`;
}

export default function CatalogPage() {
  const router = useRouter();

  const [qText, setQText] = useState("");

  // ✅ Series (Category principal)
  const [activeSeries, setActiveSeries] = useState<string>("all");

  // ✅ Accordion aberto/fechado
  const [openSeries, setOpenSeries] = useState<string | null>(null);

  // ✅ Category do produto = Subcategory (filtro secundário)
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ Carrossel: fallback estático
  const fallbackSlides: CarouselSlide[] = [
    {
      alt: "Featured products",
      title: "Featured Products",
      subtitle: "Click to filter by category",
      linkType: "filter",
      series: "Standard",
    },
    {
      alt: "Premium collection",
      title: "Premium Collection",
      subtitle: "Click to filter by category",
      linkType: "filter",
      series: "Carriage",
    },
    {
      alt: "Aluminum series",
      title: "Aluminum Series",
      subtitle: "Click to filter by category",
      linkType: "filter",
      series: "Aluminum",
    },
  ];

  const [slides, setSlides] = useState<CarouselSlide[]>(fallbackSlides);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const db = getFirestore(app);
        const col = collection(db, "products");

        const qy = query(
          col,
          where("active", "==", true),
          orderBy("sortOrder", "asc")
        );
        const snap = await getDocs(qy);

        const list: Product[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const price = Number(data.publicPrice ?? data.price ?? 0);

          return {
            slug: String(data.slug ?? d.id),
            name: String(data.name ?? d.id),

            series: String(data.series ?? "Other").trim() || "Other",
            category: String(data.category ?? "").trim() || undefined,

            description: String(data.description ?? "").trim() || undefined,

            price,
            currency: String(data.currency ?? "CAD").trim() || "CAD",

            active: Boolean(data.active ?? true),
            sortOrder: Number(data.sortOrder ?? 9999),

            images: Array.isArray(data.images) ? data.images : [],
            features: Array.isArray(data.features) ? data.features : [],
          };
        });

        list.sort(
          (a, b) =>
            (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) ||
            a.name.localeCompare(b.name)
        );

        setProducts(list);
      } catch (e: any) {
        setErrorMsg(e?.message ?? "Failed to load products.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Carrega slides do Firestore com suporte ao schema novo
  useEffect(() => {
    (async () => {
      try {
        const db = getFirestore(app);
        const ref = doc(db, "site_config", "catalog_carousel");
        const snap = await getDoc(ref);

        if (!snap.exists()) return;

        const data = snap.data() as any;
        const raw = data?.slides;

        if (!Array.isArray(raw) || raw.length === 0) return;

        const cleaned: CarouselSlide[] = raw
          .map((s: any) => ({
            src: s?.src ? String(s.src).trim() : undefined,
            alt: String(s?.alt ?? s?.title ?? "Carousel slide"),
            title: String(s?.title ?? "").trim(),
            subtitle: s?.subtitle ? String(s.subtitle).trim() : undefined,
            linkType: normalizeLinkType(s?.linkType),

            series: s?.series ? String(s.series).trim() : undefined,
            category: s?.category ? String(s.category).trim() : undefined,

            productSlug: s?.productSlug
              ? String(s.productSlug).trim()
              : undefined,

            pagePath: s?.pagePath
              ? normalizeInternalPath(String(s.pagePath))
              : undefined,

            url: s?.url ? String(s.url).trim() : undefined,
          }))
          .filter((s) => s.title && s.alt);

        if (cleaned.length > 0) {
          setSlides(cleaned);
          setCarouselIndex(0);
        }
      } catch {
        // silencioso: mantém fallback
      }
    })();
  }, []);

  const seriesStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const s = (p.series || "Other").trim() || "Other";
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([series, count]) => ({ series, count }))
      .sort((a, b) => a.series.localeCompare(b.series));
  }, [products]);

  const categoryStatsBySeries = useMemo(() => {
    const bySeries = new Map<string, { category: string; count: number }[]>();
    const tmp = new Map<string, Map<string, number>>();

    for (const p of products) {
      const s = (p.series || "Other").trim() || "Other";
      const c = (p.category || "Other").trim() || "Other";

      if (!tmp.has(s)) tmp.set(s, new Map());
      const cmap = tmp.get(s)!;
      cmap.set(c, (cmap.get(c) ?? 0) + 1);
    }

    for (const [s, cmap] of tmp.entries()) {
      const arr = Array.from(cmap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => a.category.localeCompare(b.category));
      bySeries.set(s, arr);
    }

    return bySeries;
  }, [products]);

  const filtered = useMemo(() => {
    const q = qText.trim().toLowerCase();

    return products.filter((p) => {
      if (activeSeries !== "all" && p.series !== activeSeries) return false;

      if (activeSeries !== "all" && activeCategory !== "all") {
        const c = (p.category || "Other").trim() || "Other";
        if (c !== activeCategory) return false;
      }

      if (!q) return true;

      const hay =
        `${p.name} ${p.series} ${p.category ?? ""} ${p.description ?? ""} ${p.slug}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, qText, activeSeries, activeCategory]);

  function handleSelectAll() {
    setActiveSeries("all");
    setOpenSeries(null);
    setActiveCategory("all");
  }

  function handleClickSeries(series: string) {
    if (activeSeries === series) {
      setOpenSeries((prev) => (prev === series ? null : series));
      setActiveCategory("all");
      return;
    }

    setActiveSeries(series);
    setOpenSeries(series);
    setActiveCategory("all");
  }

  function applySlideFilter(slide: CarouselSlide) {
    if (!slide.series) return;

    setActiveSeries(slide.series);
    setOpenSeries(slide.series);

    if (slide.category) setActiveCategory(slide.category);
    else setActiveCategory("all");

    setQText("");
  }

  function handleSlideClick(slide: CarouselSlide) {
    const linkType = normalizeLinkType(slide.linkType);

    if (linkType === "filter") {
      applySlideFilter(slide);
      return;
    }

    if (linkType === "page") {
      const pagePath = normalizeInternalPath(slide.pagePath ?? "");
      if (pagePath) router.push(pagePath);
      return;
    }

    if (linkType === "product") {
      const slug = String(slide.productSlug ?? "").trim();
      if (slug) {
        router.push(`/product?slug=${encodeURIComponent(slug)}`);
      }
      return;
    }

    if (linkType === "url") {
      const url = String(slide.url ?? "").trim();
      if (url) {
        window.location.href = url;
      }
    }
  }

  function getSlideHint(slide: CarouselSlide) {
    const linkType = normalizeLinkType(slide.linkType);

    if (linkType === "filter") {
      return (
        <>
          Click to filter: <strong>{slide.series ?? "All"}</strong>
          {slide.category ? ` / ${slide.category}` : ""}
        </>
      );
    }

    if (linkType === "page") {
      return (
        <>
          Open page: <strong>{normalizeInternalPath(slide.pagePath ?? "") || "/"}</strong>
        </>
      );
    }

    if (linkType === "product") {
      return (
        <>
          View product: <strong>{slide.productSlug ?? "product"}</strong>
        </>
      );
    }

    return (
      <>
        Open link
      </>
    );
  }

  function formatMoney(currency: string, value: number) {
    return `${currency} ${value.toLocaleString("en-CA", {
      minimumFractionDigits: 2,
    })}`;
  }

  return (
    <main className="page">
      <div className="wrap">
        <aside className="sidebar">
          <div className="card">
            <label className="label">Part # / Keyword</label>
            <input
              className="input"
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Search…"
            />

            <hr className="divider" />

            <div className="sectionTitle">CATEGORIES</div>

            <button
              className={`pill ${activeSeries === "all" ? "pillActive" : ""}`}
              onClick={handleSelectAll}
              type="button"
            >
              <span>All products</span>
              <span className="count">{products.length}</span>
            </button>

            {seriesStats.map((it) => {
              const isActive = activeSeries === it.series;
              const isOpen = openSeries === it.series;
              const catList = categoryStatsBySeries.get(it.series) ?? [];
              const totalInSeries = products.filter((p) => p.series === it.series).length;

              return (
                <div key={it.series} className="seriesBlock">
                  <button
                    className={`pill ${isActive ? "pillActive" : ""}`}
                    onClick={() => handleClickSeries(it.series)}
                    type="button"
                  >
                    <span className="pillLeft">
                      <span className="chev">{isOpen ? "▾" : "▸"}</span>
                      <span>{it.series}</span>
                    </span>
                    <span className="count">{it.count}</span>
                  </button>

                  {isActive && isOpen ? (
                    <div className="accordion">
                      <button
                        className={`subpill ${activeCategory === "all" ? "subpillActive" : ""}`}
                        onClick={() => setActiveCategory("all")}
                        type="button"
                      >
                        <span>All in {it.series}</span>
                        <span className="subcount">{totalInSeries}</span>
                      </button>

                      {catList.map((c) => (
                        <button
                          key={`${it.series}::${c.category}`}
                          className={`subpill ${activeCategory === c.category ? "subpillActive" : ""}`}
                          onClick={() => setActiveCategory(c.category)}
                          type="button"
                        >
                          <span>{c.category}</span>
                          <span className="subcount">{c.count}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="content">
          <div className="carousel">
            <button
              className="nav prev"
              type="button"
              aria-label="Previous"
              onClick={() =>
                setCarouselIndex((i) => (i === 0 ? slides.length - 1 : i - 1))
              }
            >
              ‹
            </button>

            <div className="carouselViewport">
              <div
                className="carouselTrack"
                style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
              >
                {slides.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="slide"
                    onClick={() => handleSlideClick(s)}
                  >
                    {s.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.src} alt={s.alt} />
                    ) : (
                      <div className="slidePlaceholder">
                        <div className="phTitle">{s.title}</div>
                        {s.subtitle ? <div className="phSub">{s.subtitle}</div> : null}
                        <div className="phHint">{getSlideHint(s)}</div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="nav next"
              type="button"
              aria-label="Next"
              onClick={() =>
                setCarouselIndex((i) => (i === slides.length - 1 ? 0 : i + 1))
              }
            >
              ›
            </button>
          </div>

          <div className="subtitle">
            {loading
              ? "Loading…"
              : `${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
          </div>

          {errorMsg ? (
            <div className="error">
              <strong>Firestore error:</strong> {errorMsg}
            </div>
          ) : loading ? (
            <div className="grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton" />
              ))}
            </div>
          ) : (
            <div className="grid">
              {filtered.map((p) => {
                const img = p.images?.[0] || "";
                return (
                  <Link
                    key={p.slug}
                    href={`/product?slug=${encodeURIComponent(p.slug)}`}
                    className="productCard"
                  >
                    <div className="imgWrap">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name} className="img" />
                      ) : (
                        <div className="imgFallback">No image</div>
                      )}
                    </div>

                    <div className="productName">{p.name}</div>

                    <div className="metaRow">
                      <span className="badge">{p.series}</span>
                      {p.category ? <span className="badge2">{p.category}</span> : null}
                    </div>

                    <div className="muted">
                      {p.description ? p.description : "No description."}
                    </div>

                    <div className="productBottom">
                      <div className="price">
                        {p.price > 0 ? (
                          formatMoney(p.currency, p.price)
                        ) : (
                          <span className="muted">Price on request</span>
                        )}
                      </div>
                      <div className="cta">View</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .page {
          padding: 24px 0 60px;
          background: #f4f6f8;
          min-height: 70vh;
        }
        .wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 18px;
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 22px;
        }
        @media (max-width: 980px) {
          .wrap {
            grid-template-columns: 1fr;
          }
        }

        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
        }
        .label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
          margin-bottom: 6px;
          color: #111827;
        }
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
        }
        .divider {
          border: none;
          border-top: 1px solid #eef0f3;
          margin: 14px 0;
        }
        .sectionTitle {
          font-size: 12px;
          font-weight: 900;
          color: #111827;
          margin-bottom: 10px;
          letter-spacing: 0.04em;
        }

        .seriesBlock {
          margin-bottom: 10px;
        }
        .pill {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #fff;
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 10px;
        }
        .pill:hover {
          border-color: #c7cbd1;
        }
        .pillActive {
          border-color: #b91c1c;
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.12);
        }
        .pillLeft {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chev {
          width: 16px;
          display: inline-block;
          color: #6b7280;
          font-weight: 900;
        }
        .count {
          color: #6b7280;
          font-weight: 700;
        }

        .accordion {
          margin-top: 8px;
          margin-left: 18px;
          padding-left: 10px;
          border-left: 2px solid #eef0f3;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .subpill {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid #eef0f3;
          background: #fafafa;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
        }
        .subpillActive {
          border-color: rgba(185, 28, 28, 0.35);
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.08);
          background: rgba(185, 28, 28, 0.03);
        }
        .subcount {
          color: #6b7280;
          font-weight: 700;
          font-size: 12px;
        }

        .content {
          min-width: 0;
        }

        .carousel {
          position: relative;
          width: 100%;
          height: 260px;
          border-radius: 14px;
          overflow: hidden;
          background: #0b0f1a;
          margin-bottom: 10px;
        }
        .carouselViewport {
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .carouselTrack {
          display: flex;
          height: 100%;
          transition: transform 0.35s ease;
        }
        .slide {
          min-width: 100%;
          height: 100%;
          border: none;
          padding: 0;
          background: transparent;
          cursor: pointer;
          position: relative;
        }

        .slide img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .slidePlaceholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 18px;
          color: #fff;
          background: radial-gradient(
              800px 300px at 20% 20%,
              rgba(185, 28, 28, 0.35),
              transparent 55%
            ),
            linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 50%),
            linear-gradient(180deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.65));
        }
        .phTitle {
          font-size: 26px;
          font-weight: 900;
          line-height: 1.1;
        }
        .phSub {
          margin-top: 6px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 700;
        }
        .phHint {
          margin-top: 10px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 8px 10px;
          border-radius: 10px;
          width: fit-content;
        }

        .nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2;
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: none;
          background: rgba(0, 0, 0, 0.55);
          color: #fff;
          font-size: 26px;
          font-weight: 900;
          cursor: pointer;
        }
        .nav:hover {
          background: rgba(0, 0, 0, 0.75);
        }
        .nav.prev {
          left: 14px;
        }
        .nav.next {
          right: 14px;
        }

        .subtitle {
          margin: 8px 0 14px;
          color: #6b7280;
          font-size: 14px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        @media (max-width: 1100px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .grid {
            grid-template-columns: 1fr;
          }
          .carousel {
            height: 200px;
          }
        }

        .productCard {
          text-decoration: none;
          color: inherit;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .productCard:hover {
          border-color: #c7cbd1;
        }

        .imgWrap {
          width: 100%;
          height: 160px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #f3f4f6;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .imgFallback {
          font-weight: 800;
          color: #6b7280;
          font-size: 12px;
        }

        .productName {
          font-weight: 900;
          font-size: 16px;
          color: #111827;
        }
        .metaRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .badge {
          background: rgba(185, 28, 28, 0.08);
          color: #b91c1c;
          border: 1px solid rgba(185, 28, 28, 0.25);
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
        }
        .badge2 {
          background: rgba(17, 24, 39, 0.06);
          color: #111827;
          border: 1px solid rgba(17, 24, 39, 0.18);
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
        }
        .muted {
          color: #6b7280;
          font-size: 13px;
          font-weight: 600;
        }
        .productBottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #eef0f3;
          padding-top: 10px;
        }
        .price {
          font-weight: 900;
          color: #111827;
        }
        .cta {
          font-weight: 900;
          color: #b91c1c;
        }

        .skeleton {
          height: 130px;
          border-radius: 12px;
          background: linear-gradient(
            90deg,
            #eef0f3 25%,
            #f7f7f7 37%,
            #eef0f3 63%
          );
          background-size: 400% 100%;
          animation: shimmer 1.2s ease-in-out infinite;
          border: 1px solid #e5e7eb;
        }
        @keyframes shimmer {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: 0 0;
          }
        }

        .error {
          background: #fff;
          border: 1px solid rgba(185, 28, 28, 0.25);
          border-left: 6px solid #b91c1c;
          border-radius: 12px;
          padding: 14px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
        }
      `}</style>
    </main>
  );
}