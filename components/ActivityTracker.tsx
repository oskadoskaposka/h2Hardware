"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackProductView, trackSearch } from "../lib/orderActivity";

export default function ActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const productSlug = String(searchParams.get("slug") || "").trim();

  useEffect(() => {
    if (pathname === "/product" && productSlug) {
      trackProductView(productSlug);
    }
  }, [pathname, productSlug]);

  useEffect(() => {
    function handleCatalogProductClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest('a[href*="/product?slug="]');
      if (!link) return;

      const searchInput = document.querySelector(
        'input[placeholder="Search..."]',
      );

      if (searchInput instanceof HTMLInputElement) {
        trackSearch(searchInput.value);
      }
    }

    document.addEventListener("click", handleCatalogProductClick, true);
    return () =>
      document.removeEventListener("click", handleCatalogProductClick, true);
  }, []);

  return null;
}
