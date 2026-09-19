import React from "react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { ValueProps } from "@/components/landing/ValueProps";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { UseCases } from "@/components/landing/UseCases";
import { QualitySection } from "@/components/landing/QualitySection";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

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
