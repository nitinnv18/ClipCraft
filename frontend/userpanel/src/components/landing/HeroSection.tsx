"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DemoInput } from "@/components/landing/DemoInput";
import { ArrowRight, ChevronDown, BrainCircuit, Smartphone, Scissors, Zap } from "lucide-react";

export const HeroSection: React.FC = () => {
  return (
    <section className="relative w-full pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-[#1f2229] bg-[#0a0b0d]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center">
        {/* Micro Category Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#121316] border border-[#262931] text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-6">
          <Zap className="w-3.5 h-3.5" />
          <span>AI-Powered Video Repurposing</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight uppercase text-white leading-none max-w-4xl mb-6">
          Turn Long Videos <br className="hidden sm:inline" />
          Into <span className="text-amber-500">Short Clips</span>.
        </h1>

        {/* Supporting Copy */}
        <p className="text-sm sm:text-base lg:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-8">
          Upload your raw video. Our AI finds the moments worth watching and turns them into ready-to-share short clips.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-12 w-full sm:w-auto justify-center">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="lg"
              className="w-full sm:w-auto text-xs font-black tracking-wider py-4 px-8 flex items-center justify-center gap-2"
            >
              <span>Start Creating</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>

          <a href="#how-it-works" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto text-xs font-bold tracking-wider py-4 px-6 text-gray-300 hover:text-white border-[#2b2e36]"
            >
              <span>See How It Works</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </a>
        </div>

        {/* Hero Interactive Demo Box */}
        <div className="w-full">
          <DemoInput />
        </div>

        {/* Micro Trust Indicators */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[11px] font-mono text-gray-400 uppercase">
          <div className="flex items-center gap-1.5">
            <BrainCircuit className="w-3.5 h-3.5 text-amber-500" />
            <span>Transcript NLP Hook Detection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-amber-500" />
            <span>9:16 Vertical Video Reframing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-amber-500" />
            <span>Sentence Boundary Snapping</span>
          </div>
        </div>
      </div>
    </section>
  );
};
