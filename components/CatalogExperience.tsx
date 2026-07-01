"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { app, auth } from "../lib/firebaseClient";
import { resolveUnitPrice, type PriceTier } from "../lib/pricing";

type Product = {
  slug: string;
  name: string;
  series: string;
  category?: string;
  description?: string;
  publicPrice: number;
  price?: number;
  currency: string;
  tiers?: PriceTier[];
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
  series?: string;
  category?: string;
  productSlug?: string;
  pagePath?: string;
  url?: string;
};

const PAGE_SIZE = 18;

function normalizeLinkType(v: unknown): CarouselLinkType {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "product" || s === "page" || s === "url") return s;
  return "filter";
}

function normalizeInternalPath(p: string) {
  const v = String(p ?? "").trim();
  if (!v) return "";
  return v.startsWith("/") ? v : `/${v}`;
}

function formatMoney(currency: string, value: number) {
  return value.toLocaleString("en-CA", { style: "currency", currency });
}

function normalizeTiers(tiers: unknown): PriceTier[] {
  if (!Array.isArray(tiers)) return [];

  return tiers
    .map((tier): PriceTier | null => {
      if (!tier || typeof tier !== "object") return null;
      const row = tier as Record<string, unknown>;
      const minQty = Number(row.minQty ?? 0);
      const price = Number(row.price ?? 0);
      if (!Number.isFinite(minQty) || !Number.isFinite(price)) return null;
      const maxQtyRaw = row.maxQty;
      const maxQtyValue = maxQtyRaw === null || maxQtyRaw === undefined ? null : Number(maxQtyRaw);
      return {
        id: row.id ? String(row.id) : undefined,
        minQty,
        maxQty: typeof maxQtyValue === "number" && Number.isFinite(maxQtyValue) ? maxQtyValue : null,
        price,
      };
    })
    .filter((tier): tier is PriceTier => tier !== null);
}

function getCardUnitPrice(product: Product) {
  const publicPrice = Number(product.publicPrice ?? product.price ?? 0);
  const { unitPriceApplied } = resolveUnitPrice(
    {
      publicPrice,
      currency: product.currency || "CAD",
      tiers: product.tiers || [],
    },
    1,
  );

  return Number.isFinite(unitPriceApplied) ? unitPriceApplied : publicPrice;
}

export default function CatalogExperience() {
  const router = useRouter();
  const [qText, setQText] = useState("");
  const [activeSeries, setActiveSeries] = useState("all");
  const [openSeries, setOpenSeries] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLogged, setIsLogged] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const fallbackSlides: CarouselSlide[] = [
    { alt: "Featured products", title: "Featured Products", subtitle: "Click to filter by category", linkType: "filter", series: "Standard" },
    { alt: "Premium collection", title: "Premium Collection", subtitle: "Click to filter by category", linkType: "filter", series: "Carriage" },
    { alt: "Aluminum series", title: "Aluminum Series", subtitle: "Click to filter by category", linkType: "filter", series: "Aluminum" },
  ];

  const [slides, setSlides] = useState<CarouselSlide[]>(fallbackSlides);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setIsLogged(!!user));
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const db = getFirestore(app);
        const col = collection(db, "products");
        const qy = query(col, where("active", "==", true), orderBy("sortOrder", "asc"));
        const snap = await getDocs(qy);

        const list: Product[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const publicPrice = Number(data.publicPrice ?? data.price ?? 0);

          return {
            slug: String(data.slug ?? d.id),
            name: String(data.name ?? d.id),
            series: String(data.series ?? "Other").trim() || "Other",
            category: String(data.category ?? "").trim() || undefined,
            description: String(data.description ?? "").trim() || undefined,
            publicPrice,
            price: Number(data.price ?? publicPrice),
            currency: String(data.currency ?? "CAD").trim() || "CAD",
            tiers: normalizeTiers(data.tiers),
            active: Boolean(data.active ?? true),
            sortOrder: Number(data.sortOrder ?? 9999),
            images: Array.isArray(data.images) ? data.images : [],
            features: Array.isArray(data.features) ? data.features : [],
          };
        });

        list.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.name.localeCompare(b.name));
        setProducts(list);
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : "Failed to load products.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const db = getFirestore(app);
        const ref = doc(db, "site_config", "catalog_carousel");
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const raw = (snap.data() as { slides?: unknown })?.slides;
        if (!Array.isArray(raw) || raw.length === 0) return;

        const cleaned = raw
          .filter((slide) => !!slide && typeof slide === "object")
          .map((slide: any) => ({
            src: slide.src ? String(slide.src).trim() : undefined,
            alt: String(slide.alt ?? slide.title ?? "Carousel slide"),
            title: String(slide.title ?? "").trim(),
            subtitle: slide.subtitle ? String(slide.subtitle).trim() : undefined,
            linkType: normalizeLinkType(slide.linkType),
            series: slide.series ? String(slide.series).trim() : undefined,
            category: slide.category ? String(slide.category).trim() : undefined,
            productSlug: slide.productSlug ? String(slide.productSlug).trim() : undefined,
            pagePath: slide.pagePath ? normalizeInternalPath(String(slide.pagePath)) : undefined,
            url: slide.url ? String(slide.url).trim() : undefined,
          }))
          .filter((slide) => slide.title && slide.alt);

        if (cleaned.length > 0) {
          setSlides(cleaned);
          setCarouselIndex(0);
        }
      } catch {
        // keep fallback slides
      }
    })();
  }, []);

  const seriesStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const series = (p.series || "Other").trim() || "Other";
      map.set(series, (map.get(series) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([series, count]) => ({ series, count })).sort((a, b) => a.series.localeCompare(b.series));
  }, [products]);

  const categoryStatsBySeries = useMemo(() => {
    const tmp = new Map<string, Map<string, number>>();
    for (const p of products) {
      const series = (p.series || "Other").trim() || "Other";
      const category = (p.category || "Other").trim() || "Other";
      if (!tmp.has(series)) tmp.set(series, new Map());
      const bucket = tmp.get(series)!;
      bucket.set(category, (bucket.get(category) ?? 0) + 1);
    }

    const result = new Map<string, { category: string; count: number }[]>();
    for (const [series, bucket] of tmp.entries()) {
      result.set(
        series,
        Array.from(bucket.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => a.category.localeCompare(b.category)),
      );
    }
    return result;
  }, [products]);

  const filtered = useMemo(() => {
    const q = qText.trim().toLowerCase();
    return products.filter((p) => {
      if (activeSeries !== "all" && p.series !== activeSeries) return false;
      if (activeSeries !== "all" && activeCategory !== "all") {
        const category = (p.category || "Other").trim() || "Other";
        if (category !== activeCategory) return false;
      }
      if (!q) return true;
      return `${p.name} ${p.series} ${p.category ?? ""} ${p.description ?? ""} ${p.slug}`.toLowerCase().includes(q);
    });
  }, [products, qText, activeSeries, activeCategory]);

  useEffect(() => setCurrentPage(1), [qText, activeSeries, activeCategory]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

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

  function handleSlideClick(slide: CarouselSlide) {
    const linkType = normalizeLinkType(slide.linkType);
    if (linkType === "filter") {
      if (!slide.series) return;
      setActiveSeries(slide.series);
      setOpenSeries(slide.series);
      setActiveCategory(slide.category || "all");
      setQText("");
      return;
    }
    if (linkType === "page") {
      const pagePath = normalizeInternalPath(slide.pagePath ?? "");
      if (pagePath) router.push(pagePath);
      return;
    }
    if (linkType === "product") {
      const slug = String(slide.productSlug ?? "").trim();
      if (slug) router.push(`/product?slug=${encodeURIComponent(slug)}`);
      return;
    }
  }

  function getSlideHint(slide: CarouselSlide) {
    const linkType = normalizeLinkType(slide.linkType);
    if (linkType === "filter") return `Click to filter: ${slide.series ?? "All"}${slide.category ? ` / ${slide.category}` : ""}`;
    if (linkType === "page") return `Open page: ${normalizeInternalPath(slide.pagePath ?? "") || "/"}`;
    if (linkType === "product") return `View product: ${slide.productSlug ?? "product"}`;
    return "Open link";
  }

  return (
    <main className="page">
      <div className="wrap">
        <aside className="sidebar">
          <div className="card">
            <label className="label">Part # / Keyword</label>
            <input className="input" value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Search..." />
            <hr className="divider" />
            <div className="sectionTitle">CATEGORIES</div>

            <button className={`pill ${activeSeries === "all" ? "pillActive" : ""}`} onClick={handleSelectAll} type="button">
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
                  <button className={`pill ${isActive ? "pillActive" : ""}`} onClick={() => handleClickSeries(it.series)} type="button">
                    <span className="pillLeft"><span className="chev">{isOpen ? "v" : ">"}</span>{it.series}</span>
                    <span className="count">{it.count}</span>
                  </button>

                  {isActive && isOpen ? (
                    <div className="accordion">
                      <button className={`subpill ${activeCategory === "all" ? "subpillActive" : ""}`} onClick={() => setActiveCategory("all")} type="button">
                        <span>All in {it.series}</span>
                        <span className="subcount">{totalInSeries}</span>
                      </button>
                      {catList.map((c) => (
                        <button key={`${it.series}::${c.category}`} className={`subpill ${activeCategory === c.category ? "subpillActive" : ""}`} onClick={() => setActiveCategory(c.category)} type="button">
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
            <button className="nav prev" type="button" aria-label="Previous" onClick={() => setCarouselIndex((i) => (i === 0 ? slides.length - 1 : i - 1))}>
              &lsaquo;
            </button>
            <div className="carouselViewport">
              <div className="carouselTrack" style={{ transform: `translateX(-${carouselIndex * 100}%)` }}>
                {slides.map((slide, idx) => (
                  <button key={idx} type="button" className="slide" onClick={() => handleSlideClick(slide)}>
                    {slide.src ? <img src={slide.src} alt={slide.alt} /> : (
                      <div className="slidePlaceholder">
                        <div className="phTitle">{slide.title}</div>
                        {slide.subtitle ? <div className="phSub">{slide.subtitle}</div> : null}
                        <div className="phHint">{getSlideHint(slide)}</div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <button className="nav next" type="button" aria-label="Next" onClick={() => setCarouselIndex((i) => (i === slides.length - 1 ? 0 : i + 1))}>
              &rsaquo;
            </button>
          </div>

          <div className="subtitle">
            {loading ? "Loading..." : `${filtered.length} product${filtered.length === 1 ? "" : "s"}${filtered.length > PAGE_SIZE ? ` - page ${currentPage} of ${totalPages}` : ""}`}
          </div>

          {errorMsg ? (
            <div className="error"><strong>Firestore error:</strong> {errorMsg}</div>
          ) : loading ? (
            <div className="grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}</div>
          ) : (
            <>
              <div className="grid">
                {paginatedProducts.map((p) => {
                  const img = p.images?.[0] || "";
                  const unitPrice = getCardUnitPrice(p);

                  return (
                    <Link key={p.slug} href={`/product?slug=${encodeURIComponent(p.slug)}`} className="productCard">
                      <div className="imgWrap">
                        {img ? <img src={img} alt={p.name} className="img" /> : <div className="imgFallback">No image</div>}
                      </div>

                      <div className="productInfo">
                        <div className="productName">{p.name}</div>
                        <div className="metaRow">
                          <span className="badge">{p.series}</span>
                          {p.category ? <span className="badge2">{p.category}</span> : null}
                        </div>
                        <div className="muted">{p.description ? p.description : "No description."}</div>
                      </div>

                      <div className="productBottom">
                        <div className="priceBlock">
                          {isLogged ? (
                            <>
                              <div className="priceLabel">Unit price</div>
                              <div className="price">{unitPrice > 0 ? formatMoney(p.currency, unitPrice) : "Price on request"}</div>
                            </>
                          ) : (
                            <div className="priceLocked">Pricing available after sign in</div>
                          )}
                        </div>
                        <div className="cta">View</div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {totalPages > 1 ? (
                <div className="pagination">
                  <button className="pageButton" type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
                  <div className="paginationInfo">Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></div>
                  <button className="pageButton" type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <style jsx>{`
        .page { padding: 24px 0 60px; background: #f4f6f8; min-height: 70vh; }
        .wrap { max-width: 1200px; margin: 0 auto; padding: 0 18px; display: grid; grid-template-columns: 320px 1fr; gap: 22px; }
        @media (max-width: 980px) { .wrap { grid-template-columns: 1fr; } }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; box-shadow: 0 6px 18px rgba(0,0,0,.06); }
        .label { display:block; font-size:12px; font-weight:700; letter-spacing:.02em; margin-bottom:6px; color:#111827; }
        .input { width:100%; border:1px solid #d1d5db; border-radius:10px; padding:10px 12px; font-size:14px; outline:none; }
        .divider { border:none; border-top:1px solid #eef0f3; margin:14px 0; }
        .sectionTitle { font-size:12px; font-weight:900; color:#111827; margin-bottom:10px; letter-spacing:.04em; }
        .seriesBlock { margin-bottom:10px; }
        .pill, .subpill { width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; border-radius:10px; cursor:pointer; text-align:left; }
        .pill { padding:10px 12px; border:1px solid #e5e7eb; background:#fff; font-size:14px; margin-bottom:10px; }
        .pillActive { border-color:#b91c1c; box-shadow:0 0 0 3px rgba(185,28,28,.12); }
        .pillLeft { display:flex; align-items:center; gap:8px; }
        .chev { width:16px; color:#6b7280; font-weight:900; }
        .count, .subcount { color:#6b7280; font-weight:700; }
        .accordion { margin-top:8px; margin-left:18px; padding-left:10px; border-left:2px solid #eef0f3; display:grid; gap:8px; }
        .subpill { padding:8px 10px; border:1px solid #eef0f3; background:#fafafa; font-size:13px; }
        .subpillActive { border-color:rgba(185,28,28,.35); box-shadow:0 0 0 3px rgba(185,28,28,.08); background:rgba(185,28,28,.03); }
        .content { min-width:0; }
        .carousel { position:relative; width:100%; height:260px; border-radius:14px; overflow:hidden; background:#0b0f1a; margin-bottom:10px; }
        @media (max-width:640px) { .carousel { height:200px; } }
        .carouselViewport { width:100%; height:100%; overflow:hidden; }
        .carouselTrack { display:flex; height:100%; transition:transform .35s ease; }
        .slide { min-width:100%; height:100%; border:none; padding:0; background:transparent; cursor:pointer; position:relative; }
        .slide img { width:100%; height:100%; object-fit:cover; display:block; }
        .slidePlaceholder { width:100%; height:100%; display:flex; flex-direction:column; justify-content:flex-end; padding:18px; color:#fff; background:radial-gradient(800px 300px at 20% 20%, rgba(185,28,28,.35), transparent 55%), linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.65)); }
        .phTitle { font-size:26px; font-weight:900; line-height:1.1; }
        .phSub { margin-top:6px; font-size:14px; color:rgba(255,255,255,.85); font-weight:700; }
        .phHint { margin-top:10px; font-size:13px; font-weight:700; color:rgba(255,255,255,.9); background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.15); padding:8px 10px; border-radius:10px; width:fit-content; }
        .nav { position:absolute; top:50%; transform:translateY(-50%); z-index:2; width:42px; height:42px; border-radius:999px; border:none; background:rgba(0,0,0,.55); color:#fff; font-size:26px; font-weight:900; cursor:pointer; }
        .nav.prev { left:14px; } .nav.next { right:14px; }
        .subtitle { margin:8px 0 14px; color:#6b7280; font-size:14px; }
        .grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:18px; }
        @media (max-width:1100px) { .grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
        @media (max-width:640px) { .grid { grid-template-columns:1fr; } }
        .productCard { text-decoration:none; color:inherit; background:#fff; border:1px solid #e1e5ea; border-radius:12px; padding:14px; box-shadow:0 4px 14px rgba(17,24,39,.05); display:flex; flex-direction:column; gap:13px; min-height:100%; transition:border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
        .productCard:hover { border-color:#c9ced6; box-shadow:0 10px 24px rgba(17,24,39,.08); transform:translateY(-1px); }
        .imgWrap { width:100%; height:164px; border-radius:10px; border:1px solid #edf0f3; background:#f7f8fa; overflow:hidden; display:flex; align-items:center; justify-content:center; }
        .img { width:100%; height:100%; object-fit:cover; display:block; }
        .imgFallback { font-weight:800; color:#6b7280; font-size:12px; }
        .productInfo { display:grid; gap:9px; }
        .productName { font-weight:900; font-size:16px; line-height:1.3; color:#111827; }
        .metaRow { display:flex; gap:7px; flex-wrap:wrap; }
        .badge, .badge2 { padding:3px 8px; border-radius:999px; font-size:12px; font-weight:800; }
        .badge { background:rgba(185,28,28,.08); color:#b91c1c; border:1px solid rgba(185,28,28,.22); }
        .badge2 { background:rgba(17,24,39,.05); color:#111827; border:1px solid rgba(17,24,39,.14); }
        .muted { color:#6b7280; font-size:13px; line-height:1.45; font-weight:600; }
        .productBottom { display:flex; justify-content:space-between; align-items:center; gap:12px; border-top:1px solid #eef0f3; background:#fafbfc; margin:auto -14px -14px; padding:12px 14px; border-radius:0 0 12px 12px; }
        .priceBlock { display:grid; gap:2px; min-width:0; }
        .priceLabel { color:#6b7280; font-size:11px; font-weight:900; letter-spacing:.04em; text-transform:uppercase; }
        .price { font-weight:900; color:#111827; }
        .priceLocked { color:#64748b; font-size:13px; font-weight:700; line-height:1.3; }
        .cta { flex:0 0 auto; font-weight:900; color:#b91c1c; }
        .pagination { display:flex; align-items:center; justify-content:center; gap:12px; margin-top:22px; flex-wrap:wrap; }
        .pageButton { border:1px solid #d1d5db; background:#fff; color:#111827; border-radius:10px; padding:10px 14px; font-size:14px; font-weight:900; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,.04); }
        .pageButton:disabled { opacity:.45; cursor:not-allowed; }
        .paginationInfo { color:#6b7280; font-size:14px; font-weight:700; }
        .skeleton { height:130px; border-radius:12px; background:linear-gradient(90deg,#eef0f3 25%,#f7f7f7 37%,#eef0f3 63%); background-size:400% 100%; animation:shimmer 1.2s ease-in-out infinite; border:1px solid #e5e7eb; }
        @keyframes shimmer { 0% { background-position:100% 0; } 100% { background-position:0 0; } }
        .error { background:#fff; border:1px solid rgba(185,28,28,.25); border-left:6px solid #b91c1c; border-radius:12px; padding:14px; box-shadow:0 6px 18px rgba(0,0,0,.06); }
      `}</style>
    </main>
  );
}
