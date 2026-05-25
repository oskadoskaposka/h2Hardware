"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const STORAGE_KEY = "h2CatalogState";
const PAGE_SIZE = 18;

type CatalogState = {
  path: string;
  page: number;
  scrollY: number;
};

function getCurrentUrlPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function isCatalogPath(pathname = window.location.pathname) {
  return pathname === "/" || pathname === "/catalog" || pathname === "/catalog/";
}

function normalizeCatalogPath(path: string, page: number) {
  const base = window.location.pathname === "/" ? "/" : "/catalog/";
  return page > 1 ? `${base}?page=${page}` : base;
}

function readPageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Math.max(1, Number(params.get("page") || "1") || 1);
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
    const path = String(parsed.path || "").trim();

    if (!path.startsWith("/")) return null;

    return {
      path,
      page: Math.max(1, Number(parsed.page || 1) || 1),
      scrollY: Math.max(0, Number(parsed.scrollY || 0) || 0),
    };
  } catch {
    return null;
  }
}

function writeState(page = readCurrentPage(), scrollY = window.scrollY || 0) {
  if (typeof window === "undefined") return null;
  if (!isCatalogPath()) return null;

  const normalizedPath = normalizeCatalogPath(getCurrentUrlPath(), page);

  const state: CatalogState = {
    path: normalizedPath,
    page,
    scrollY,
  };

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (getCurrentUrlPath() !== normalizedPath) {
    window.history.replaceState(window.history.state, "", normalizedPath);
  }

  return state;
}

function updateStateAfterCatalogChange() {
  window.setTimeout(() => writeState(readCurrentPage(), window.scrollY || 0), 80);
  window.setTimeout(() => writeState(readCurrentPage(), window.scrollY || 0), 250);
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

    if (currentPage >= targetPage || attempts > 50) {
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

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("button") as HTMLButtonElement | null;
      const link = target?.closest?.("a") as HTMLAnchorElement | null;

      if (isCatalogPath(pathname)) {
        if (button?.classList.contains("pageButton")) {
          updateStateAfterCatalogChange();
          return;
        }

        if (link && getLinkPath(link).startsWith("/product")) {
          writeState(readCurrentPage(), window.scrollY || 0);
          return;
        }
      }

      if (pathname === "/product" && link) {
        const href = getLinkPath(link);
        if (href === "/catalog" || href === "/catalog/" || href === "/") {
          const state = readState();
          if (!state) return;

          event.preventDefault();
          router.push(state.path || "/catalog/");
        }
      }
    }

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [pathname, router]);

  useEffect(() => {
    if (!isCatalogPath(pathname)) return;

    clarifySubtitle();

    const targetPage = readPageFromUrl();
    const saved = readState();
    const targetScrollY = saved?.path === getCurrentUrlPath() ? saved.scrollY : window.scrollY || 0;

    if (targetPage > 1) {
      restorePageAndScroll(targetPage, targetScrollY);
    } else {
      writeState(1, window.scrollY || 0);
    }

    const observer = new MutationObserver(() => {
      clarifySubtitle();
      window.setTimeout(() => {
        if (isCatalogPath()) writeState(readCurrentPage(), window.scrollY || 0);
      }, 0);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
