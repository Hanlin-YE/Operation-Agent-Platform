"use client";

import { useEffect } from "react";

/** Keep Next's development error toast out of the product preview chrome. */
export function HideNextDevOverlay() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const removeOverlay = () => {
      document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
    };

    removeOverlay();
    const observer = new MutationObserver(removeOverlay);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
