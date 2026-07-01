"use client";

import { useEffect, useState } from "react";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { app } from "../lib/firebaseClient";

const CONFIG_COLLECTION = "site_config";
const CONFIG_DOC = "catalog_menu";

function normalizeCategory(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function readHighlightedCategories(data: unknown) {
  const raw = (data as { highlightedCategories?: unknown } | null)?.highlightedCategories;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function ensureCatalogMenuStyle() {
  const styleId = "h2-catalog-menu-adjustments-style";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .catalogCategoryHighlighted {
      background: linear-gradient(180deg, #991b1b, #7f1d1d) !important;
      border-color: rgba(127, 29, 29, 0.95) !important;
      color: #fde047 !important;
      box-shadow: 0 6px 16px rgba(185, 28, 28, 0.18), 0 0 0 3px rgba(250, 204, 21, 0.12) !important;
    }

    .catalogCategoryHighlighted:hover {
      border-color: #b91c1c !important;
      filter: brightness(1.03);
    }

    .catalogCategoryHighlighted .pillLeft,
    .catalogCategoryHighlighted .pillLeft span,
    .catalogCategoryHighlighted .chev,
    .catalogCategoryHighlighted .count {
      color: #fde047 !important;
    }
  `;

  document.head.appendChild(style);
}

function getPillLabel(button: HTMLButtonElement) {
  const pillLeft = button.querySelector<HTMLElement>(".pillLeft");
  if (!pillLeft) return "";

  const clone = pillLeft.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".chev").forEach((node) => node.remove());

  return String(clone.textContent || "").trim();
}

function applyCatalogMenuAdjustments(highlightedCategories: string[]) {
  const highlighted = new Set(highlightedCategories.map(normalizeCategory));

  document.querySelectorAll<HTMLButtonElement>("button.subpill").forEach((button) => {
    const label = String(button.querySelector("span")?.textContent || "").trim();

    if (/^All in\s+/i.test(label)) {
      button.setAttribute("data-hidden-catalog-all", "true");
      button.style.display = "none";
    }
  });

  document.querySelectorAll<HTMLButtonElement>("button.pill").forEach((button) => {
    const label = getPillLabel(button);
    const shouldHighlight = !!label && highlighted.has(normalizeCategory(label));

    button.classList.toggle("catalogCategoryHighlighted", shouldHighlight);
    button.setAttribute("data-catalog-highlighted", shouldHighlight ? "true" : "false");
  });
}

export default function CatalogMenuAdjustments() {
  const [highlightedCategories, setHighlightedCategories] = useState<string[]>([]);

  useEffect(() => {
    const db = getFirestore(app);
    const configRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC);

    return onSnapshot(
      configRef,
      (snap) => {
        setHighlightedCategories(snap.exists() ? readHighlightedCategories(snap.data()) : []);
      },
      (error) => {
        console.error("Unable to load catalog category highlights.", error);
        setHighlightedCategories([]);
      },
    );
  }, []);

  useEffect(() => {
    ensureCatalogMenuStyle();

    let animationFrame = 0;
    const apply = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        applyCatalogMenuAdjustments(highlightedCategories);
      });
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const retryTimer = window.setInterval(apply, 300);
    const stopRetryTimer = window.setTimeout(() => window.clearInterval(retryTimer), 10000);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.clearInterval(retryTimer);
      window.clearTimeout(stopRetryTimer);
    };
  }, [highlightedCategories]);

  return null;
}
