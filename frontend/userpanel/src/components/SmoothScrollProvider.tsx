"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";

export const SmoothScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  useEffect(() => {
    // Only activate Lenis momentum scroll on the Landing Page
    // Keep Dashboard and App pages fast, snappy, and zero-latency
    if (!isLandingPage) return;

    let isCancelled = false;
    let lenisInstance: Lenis | null = null;
    let rafId: number;
    let handleAnchorClick: ((e: MouseEvent) => void) | null = null;

    const initLenis = async () => {
      const { default: LenisConstructor } = await import("lenis");
      if (isCancelled) return;

      const lenis = new LenisConstructor({
        duration: 1.0,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 2,
      });
      lenisInstance = lenis;

      function raf(time: number) {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      }

      rafId = requestAnimationFrame(raf);

      // Smooth Anchor Navigation on click (Landing page sections)
      handleAnchorClick = (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest("a");
        if (!target) return;

        const href = target.getAttribute("href");
        if (href && href.startsWith("#") && href.length > 1) {
          const element = document.querySelector(href);
          if (element) {
            e.preventDefault();
            lenis.scrollTo(element as HTMLElement, { offset: -80, duration: 1.0 });
          }
        }
      };

      document.addEventListener("click", handleAnchorClick);
    };

    initLenis();

    return () => {
      isCancelled = true;
      if (handleAnchorClick) {
        document.removeEventListener("click", handleAnchorClick);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (lenisInstance) {
        lenisInstance.destroy();
      }
    };
  }, [isLandingPage]);

  return <>{children}</>;
};
