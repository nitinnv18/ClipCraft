import React from "react";
import dynamic from "next/dynamic";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ValueProps } from "@/components/landing/ValueProps";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Footer } from "@/components/landing/Footer";

// Below-the-fold components dynamically loaded with SSR to optimize initial chunk size
const ProductPreview = dynamic(
  () => import("@/components/landing/ProductPreview").then((mod) => mod.ProductPreview),
  { ssr: true }
);
const FeatureGrid = dynamic(
  () => import("@/components/landing/FeatureGrid").then((mod) => mod.FeatureGrid),
  { ssr: true }
);
const BeforeAfter = dynamic(
  () => import("@/components/landing/BeforeAfter").then((mod) => mod.BeforeAfter),
  { ssr: true }
);
const UseCases = dynamic(
  () => import("@/components/landing/UseCases").then((mod) => mod.UseCases),
  { ssr: true }
);
const QualitySection = dynamic(
  () => import("@/components/landing/QualitySection").then((mod) => mod.QualitySection),
  { ssr: true }
);
const FAQ = dynamic(
  () => import("@/components/landing/FAQ").then((mod) => mod.FAQ),
  { ssr: true }
);
const FinalCTA = dynamic(
  () => import("@/components/landing/FinalCTA").then((mod) => mod.FinalCTA),
  { ssr: true }
);

export default function LandingPage() {
  return (
    <div className="w-full flex flex-col bg-[#0a0b0d] text-[#f3f4f6]">
      {/* SECTION 1 — NAVBAR */}
      <LandingNavbar />

      {/* SECTION 2 — HERO */}
      <HeroSection />

      {/* SECTION 3 — PRODUCT PREVIEW */}
      <ProductPreview />

      {/* SECTION 4 — VALUE PROPOSITION */}
      <ValueProps />

      {/* SECTION 5 — HOW IT WORKS */}
      <HowItWorks />

      {/* SECTION 6 — FEATURES */}
      <FeatureGrid />

      {/* SECTION 7 — BEFORE / AFTER */}
      <BeforeAfter />

      {/* SECTION 8 — USE CASES */}
      <UseCases />

      {/* SECTION 9 — QUALITY / TRUST */}
      <QualitySection />

      {/* SECTION 10 — FAQ */}
      <FAQ />

      {/* SECTION 11 — FINAL CTA */}
      <FinalCTA />

      {/* SECTION 12 — FOOTER */}
      <Footer />
    </div>
  );
}
