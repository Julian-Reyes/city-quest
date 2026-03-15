/**
 * useIsDesktop.js — Responsive breakpoint hook
 *
 * Returns true when viewport is ≥768px. Used throughout App.jsx to switch
 * between mobile layout (bottom sheet + overlay venue card) and desktop
 * layout (side-by-side map + sidebar).
 *
 * Listens for resize via matchMedia so it updates live without a full reload.
 */

import { useState, useEffect } from "react";

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}
