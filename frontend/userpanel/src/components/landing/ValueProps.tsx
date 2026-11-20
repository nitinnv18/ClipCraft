
import React from "react";
import { Search, Scissors, Share2, Check } from "lucide-react";

export const ValueProps: React.FC = () => {
  const benefits = [
    {
      number: "01",
      icon: Search,
      title: "Find the moments",
      description:
        "AI analyzes the transcript and identifies strong, standalone moments with natural hooks and complete thoughts.",
      meta: "Transcript semantic NLP & hook scoring",
    },
    {
      number: "02",
      icon: Scissors,
      title: "Clip automatically",
      description:
        "Selected moments are turned into properly trimmed short-form videos with 9:16 framing and sentence-boundary snapping.",
      meta: "FFmpeg precision cut & dynamic crop",
    },
    {
      number: "03",
      icon: Share2,
      title: "Ready to publish",
      description:
        "Preview, download and use your clips without manually editing the entire video or scrubbing timelines.",
      meta: "High-contrast subtitles & fast export",
    },
  ];

  return (
    <section className="w-full py-16 sm:py-24 bg-[#0a0b0d] border-b border-[#1f2229]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-2">
            SECTION 04 &bull; CORE VALUE PROPOSITION
          </div>
          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mb-4">
            Stop Searching Through <br className="hidden sm:inline" />
            Hours of Video.
          </h2>
          <p className="text-sm sm:text-base text-gray-400 leading-relaxed font-sans">
            Long-form videos contain valuable moments, but finding them manually takes time. ClipCraft automates transcript parsing, moment selection, 9:16 re-framing, and subtitle rendering in one unified flow.
          </p>
        </div>

        {/* 3 Benefit Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.number}
                className="bg-[#121316] border border-[#272a30] p-6 sm:p-8 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-10 h-10 bg-[#191b20] border border-[#30333d] flex items-center justify-center text-amber-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-400">
                      STEP {benefit.number}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-3">
                    {benefit.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed font-sans">
                    {benefit.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1e2025] text-[11px] font-mono text-gray-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span>{benefit.meta}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
