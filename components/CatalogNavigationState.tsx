"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "h2CatalogState";
const PAGE_SIZE = 18;

type CatalogState = {
  path: string;
  page: number;
  scrollY: number;
};

function normalizePath(value?: string | null) {
  const path = String(value || "").trim();

  if (!path) return "";
  if (!path.startsWith("/")) return "";
  if (path.startsWith("//")) return "";

  return path;
}

function getLinkPath(link: HTMLAnchorElement) {
  const rawHref = link.getAttribute("href") || "";

  try {
    const url = new URL(rawHref, window.location.origin);
    if (url.origin !== window.location.origin) return rawHref;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawHref;
  }
}

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
    const path = normalizePath(parsed.path);

    if (!path) return null;

    return {
      path,
      page: Math.max(1, Number(parsed.page || 1) || 1),
      scrollY: Math.max(0, Number(parsed.scrollY || 0) || 0),
    };
  } catch {
    return null;
  }
}

function saveState() {
  if (typeof window === "undefined") return null;

  const path = `${window.location.pathname}${window.location.search}`;
  if (window.location.pathname !== "/" && window.location.pathname !== "/catalog") {
    return null;
  }

  const state: CatalogState = {
    path: normalizedPath,
    page,
    scrollY,
  };

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function addReturnParamToProductLink(link: HTMLAnchorElement, state: CatalogState | null) {
  if (!state) return;

  try {
    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    if (url.pathname !== "/product") return;

    url.searchParams.set("from", state.path);
    link.href = `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // keep original href
  }
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

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE);

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

    if (currentPage >= targetPage || attempts > 40) {
      window.clearInterval(timer);
      writeState(currentPage, targetScrollY);

      window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, behavior: "auto" });
      });
    }
  }, 120);
}

function getLinkPath(link: HTMLAnchorElement) {
  const rawHref = link.getAttribute("href") || "";

  try {
    const url = new URL(rawHref, window.location.origin);
    if (url.origin !== window.location.origin) return rawHref;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawHref;
  }
}

export default function CatalogNavigationState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    function handlePossibleProductNavigation(event: Event) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("button") as HTMLButtonElement | null;
      const link = target?.closest?.("a") as HTMLAnchorElement | null;

      const href = getLinkPath(link);
      if ((pathname === "/" || pathname === "/catalog") && href.startsWith("/product")) {
        const state = saveState();
        addReturnParamToProductLink(link, state);
      }
    }

    function handleDocumentClick(event: MouseEvent) {
      handlePossibleProductNavigation(event);

      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!link) return;

      const href = getLinkPath(link);

      if (pathname === "/product" && (href === "/catalog" || href === "/")) {
        const fromParam = normalizePath(searchParams.get("from"));
        const state = readState();
        const targetPath = fromParam || state?.path || "/catalog";

        event.preventDefault();
        router.push(targetPath);
      }
    }

    document.addEventListener("pointerdown", handlePossibleProductNavigation, true);
    document.addEventListener("mousedown", handlePossibleProductNavigation, true);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("pointerdown", handlePossibleProductNavigation, true);
      document.removeEventListener("mousedown", handlePossibleProductNavigation, true);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!isCatalogPath(pathname)) return;

    clarifySubtitle();

    const targetPage = readPageFromUrl();
    const saved = readState();
    const targetScrollY = saved?.path === getCurrentUrlPath() ? saved.scrollY : window.scrollY || 0;

    const state = readState();
    const currentPath = `${window.location.pathname}${window.location.search}`;

    if (state && state.path === currentPath) {
      restorePageAndScroll(state.page, state.scrollY);
    }

    const observer = new MutationObserver(() => {
      clarifySubtitle();
      window.setTimeout(() => {
        if (isCatalogPath()) writeState(readCurrentPage(), window.scrollY || 0);
      }, 0);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [pathname, searchParams]);

  return null;
}
