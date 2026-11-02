"use client";

import { useEffect } from "react";

export default function ScrollToHash({ prefix = "m" }: { prefix?: string }) {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith(`#${prefix}`)) return;
    const target = document.getElementById(hash.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [prefix]);

  return null;
}
