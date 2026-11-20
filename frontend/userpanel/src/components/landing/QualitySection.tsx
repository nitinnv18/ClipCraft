
import React from "react";
import { Check, X, Terminal } from "lucide-react";

export const QualitySection: React.FC = () => {
  const looksFor = [
    "Strong opening hooks & punchy first sentences",
    "Useful technical insights & actionable takeaways",
    "Interesting personal stories with clean narrative arcs",
    "Surprising data points & counter-intuitive arguments",
    "Clear, assertive declarative statements",
    "Complete grammatical thoughts without sentence fragmentation",
    "Strong conclusions and definitive closing points",
  ];

  const avoids = [
    "Introductory greetings, banter, and mic checks ('Hey guys, welcome back')",
    "Verbal filler words ('um', 'you know', 'basically', 'like')",
    "Long acoustic pauses and dead air (>2.5 seconds)",
    "Sponsor reads, commercial segments, and promo plugs",
    "Repeated conversational statements and circular arguments",
    "Incomplete thoughts cut off mid-clause or during topic switches",
    "Abrupt cut-offs before the sentence subject or verb completes",
  ];

  return (
    <section className="w-full py-16 sm:py-24 bg-[#0e0f12] border-b border-[#1f2229]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-2">
            SECTION 09 &bull; QUALITY &amp; ALGORITHMIC RIGOR
          </div>
          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mb-4">
            Built To Find Moments That Stand On Their Own.
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed font-mono">
            ClipCraft does not chop videos at arbitrary intervals. Our extraction pipeline evaluates full semantic transcripts to ensure every clip retains context, clarity, and narrative punch.
          </p>
        </div>

        {/* Comparison Grid: What We Look For vs What We Avoid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LOOKS FOR CARD */}
          <div className="bg-[#121316] border border-emerald-900/60 p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#1e2025]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 inline-block"></div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  What The Algorithm Selects
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-400 uppercase">
                High Retention Target
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {looksFor.map((item, index) => (
                <div key={index} className="flex items-start gap-3 text-xs sm:text-sm text-gray-200">
                  <div className="w-5 h-5 bg-[#14261b] border border-emerald-700/50 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AVOIDS CARD */}
          <div className="bg-[#121316] border border-rose-950/70 p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#1e2025]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-rose-500 inline-block"></div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 font-mono">
                  What The Engine Filters Out
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-400 uppercase">
                Discarded Noise
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {avoids.map((item, index) => (
                <div key={index} className="flex items-start gap-3 text-xs sm:text-sm text-gray-400">
                  <div className="w-5 h-5 bg-[#261417] border border-rose-900/50 flex items-center justify-center text-rose-400 flex-shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Technical Architecture Badge Bar */}
        <div className="mt-8 p-4 bg-[#14161a] border border-[#262931] flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-gray-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span className="text-gray-300 font-bold uppercase">Heuristic &amp; NLP Model:</span>
            <span>Fast Whisper transcription + Custom Punctuation Boundary Alignment</span>
          </div>
          <div className="text-[11px] text-gray-400">
            Deduplication Max Overlap: &le; 25%
          </div>
        </div>
      </div>
    </section>
  );
};
