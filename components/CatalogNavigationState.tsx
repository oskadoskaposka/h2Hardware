"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const STORAGE_KEY = "h2CatalogState";

type CatalogState = {
  path: string;
  page: number;
  scrollY: number;
};

function readCurrentPage() {
  const info = document.querySelector(".paginationInfo")?.textContent || "";
  const match = info.match(/Page\s+(\d+)\s+of/i);
  return Math.max(1, Number(match?.[1] || "1") || 1);
}

function readState(): CatalogState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogState>;
    return {
      path: parsed.path || "/",
      page: Math.max(1, Number(parsed.page || 1) || 1),
      scrollY: Math.max(0, Number(parsed.scrollY || 0) || 0),
    };
  } catch {
    return null;
  }
}

function saveState() {
  if (typeof window === "undefined") return;

  const path = `${window.location.pathname}${window.location.search}`;
  if (window.location.pathname !== "/" && window.location.pathname !== "/catalog") return;

  const state: CatalogState = {
    path,
    page: readCurrentPage(),
    scrollY: window.scrollY || 0,
  };

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clarifySubtitle() {
  const subtitle = document.querySelector(".subtitle");
  if (!subtitle) return;

  const text = subtitle.textContent || "";
  if (text.includes("Showing ") || !text.includes(" • page ")) return;

  const productMatch = text.match(/^(\d+)\s+products?\s+•\s+page\s+(\d+)\s+of\s+(\d+)/i);
  if (!productMatch) return;

  const total = Number(productMatch[1]);
  const page = Number(productMatch[2]);
  const pages = Number(productMatch[3]);

  if (!Number.isFinite(total) || !Number.isFinite(page) || !Number.isFinite(pages)) return;

  const start = total === 0 ? 0 : (page - 1) * 18 + 1;
  const end = Math.min(total, page * 18);

  subtitle.textContent = `Showing ${start}-${end} of ${total} products • Page ${page} of ${pages}`;
}

function restorePageAndScroll(targetPage: number, targetScrollY: number) {
  let attempts = 0;

  const timer = window.setInterval(() => {
    attempts += 1;
    clarifySubtitle();

    const currentPage = readCurrentPage();
    const nextButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".pageButton"))
      .find((button) => (button.textContent || "").trim().toLowerCase() === "next");

    if (currentPage < targetPage && nextButton && !nextButton.disabled) {
      nextButton.click();
      return;
    }

    if (currentPage >= targetPage || attempts > 30) {
      window.clearInterval(timer);
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, behavior: "auto" });
      });
    }
  }, 120);
}

export default function CatalogNavigationState() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute("href") || "";

      if ((pathname === "/" || pathname === "/catalog") && href.startsWith("/product")) {
        saveState();
        return;
      }

      if (pathname === "/product" && href === "/catalog") {
        const state = readState();
        if (!state) return;

        event.preventDefault();
        router.push(state.path || "/");
      }
    }

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [pathname, router]);

  useEffect(() => {
    if (pathname !== "/" && pathname !== "/catalog") return;

    clarifySubtitle();

    const observer = new MutationObserver(() => clarifySubtitle());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const state = readState();
    if (state && state.path.startsWith(pathname)) {
      restorePageAndScroll(state.page, state.scrollY);
    }

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
