"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function CarouselBuilderGuidelines() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/admin/carousel-builder") return;

    const addGuidance = () => {
      const top = document.querySelector(".cb-top");
      if (top && !document.querySelector(".cb-banner-guidance")) {
        const box = document.createElement("div");
        box.className = "cb-banner-guidance";
        box.innerHTML = `
          <strong>Banner image guidance</strong>
          <span>Recommended size: <b>1600 × 520 px</b>. Minimum: <b>1200 × 390 px</b>. Use wide horizontal images only. Avoid square or vertical images, because the carousel crops banners to fit the site.</span>
        `;
        top.insertAdjacentElement("afterend", box);
      }

      document.querySelectorAll(".cb-field").forEach((field) => {
        const label = field.querySelector("label");
        if (!label || label.textContent?.trim() !== "Image src (optional)") return;
        if (field.querySelector(".cb-image-size-note")) return;

        const note = document.createElement("div");
        note.className = "cb-image-size-note";
        note.textContent = "Recommended banner: 1600 × 520 px. Keep important content centered; edges may be cropped on smaller screens.";
        field.appendChild(note);
      });
    };

    addGuidance();

    const observer = new MutationObserver(addGuidance);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/admin/carousel-builder") return;

    const styleId = "carousel-builder-guidance-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      .cb-banner-guidance {
        margin: 14px 0 0;
        border: 1px solid rgba(185, 28, 28, 0.22);
        border-left: 5px solid #b91c1c;
        border-radius: 14px;
        background: rgba(185, 28, 28, 0.045);
        padding: 12px 14px;
        display: grid;
        gap: 4px;
        color: #18181b;
        font-size: 13px;
        line-height: 1.45;
      }

      .cb-banner-guidance strong {
        font-size: 13px;
        font-weight: 950;
      }

      .cb-image-size-note {
        margin-top: 8px;
        border-radius: 10px;
        background: #f4f4f5;
        border: 1px solid #e4e4e7;
        padding: 8px 10px;
        color: #3f3f46;
        font-size: 11px;
        font-weight: 750;
        line-height: 1.35;
      }

      .cb-preview {
        height: auto !important;
        aspect-ratio: 1600 / 520;
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, [pathname]);

  return null;
}
