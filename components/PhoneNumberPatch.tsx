"use client";

import { useEffect } from "react";

const OLD_PHONE_TEXT = "+1 (780) 907-7827";
const NEW_PHONE_TEXT = "+1 (226) 788-1924";
const OLD_TEL = "tel:+17809077827";
const NEW_TEL = "tel:+12267881924";

export default function PhoneNumberPatch() {
  useEffect(() => {
    const replacePhone = () => {
      document.querySelectorAll("a[href]").forEach((link) => {
        const href = link.getAttribute("href");
        if (href === OLD_TEL) {
          link.setAttribute("href", NEW_TEL);
        }

        if ((link.textContent || "").includes(OLD_PHONE_TEXT)) {
          link.textContent = (link.textContent || "").replace(
            OLD_PHONE_TEXT,
            NEW_PHONE_TEXT
          );
        }
      });
    };

    replacePhone();
  }, []);

  return null;
}
