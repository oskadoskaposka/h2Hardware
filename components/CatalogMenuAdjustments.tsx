"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { app } from "../lib/firebaseClient";

const CONFIG_COLLECTION = "site_config";
const CONFIG_DOC = "catalog_menu";

function normalizeCategory(value: string) {
  return String(value || "").trim().toLowerCase();
}

function readHighlightedCategories(data: any) {
  const raw = data?.highlightedCategories;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => String(item || "").trim())
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

function applyCatalogMenuAdjustments(highlightedCategories: string[]) {
  const highlighted = new Set(highlightedCategories.map(normalizeCategory));

  document.querySelectorAll<HTMLButtonElement>("button.subpill").forEach((button) => {
    const firstSpan = button.querySelector("span");
    const label = String(firstSpan?.textContent || button.textContent || "").trim();

    if (/^All in\s+/i.test(label)) {
      button.setAttribute("data-hidden-catalog-all", "true");
      button.style.display = "none";
    }
  });

  document.querySelectorAll<HTMLButtonElement>("button.pill").forEach((button) => {
    const labelNode = button.querySelector(".pillLeft span:not(.chev)");
    const label = String(labelNode?.textContent || "").trim();
    const shouldHighlight = !!label && highlighted.has(normalizeCategory(label));

    button.classList.toggle("catalogCategoryHighlighted", shouldHighlight);
    button.setAttribute("data-catalog-highlighted", shouldHighlight ? "true" : "false");
  });
}

export default function CatalogMenuAdjustments() {
  const [highlightedCategories, setHighlightedCategories] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const db = getFirestore(app);
        const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC));
        if (!mounted || !snap.exists()) return;

        setHighlightedCategories(readHighlightedCategories(snap.data()));
      } catch {
        if (mounted) setHighlightedCategories([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    ensureCatalogMenuStyle();
    applyCatalogMenuAdjustments(highlightedCategories);

    const observer = new MutationObserver(() => {
      applyCatalogMenuAdjustments(highlightedCategories);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [highlightedCategories]);

  return null;
}
