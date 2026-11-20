"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      question: "What videos can I use?",
      answer:
        "You can upload any video file (.mp4, .mov, .webm) containing spoken dialogue, such as podcasts, interviews, presentations, lectures, and educational breakdowns. The AI processes the audio and transcript to locate peak moments.",
      category: "Supported Input",
    },
    {
      question: "How many clips can I generate?",
      answer:
        "You can configure the system to generate 3, 5, 7, or 10 distinct clips per job run. The AI extracts the top-ranked moments based on narrative completeness and hook strength without overlapping duplicate content.",
      category: "Capacity",
    },
    {
      question: "How long does processing take?",
      answer:
        "Processing happens asynchronously in the background. Typical jobs complete in 30 to 90 seconds depending on the total length of the source video, transcript size, and whether subtitle rendering is enabled.",
      category: "Performance",
    },
    {
      question: "Can I choose the clip duration?",
      answer:
        "Yes. You can select your preferred duration window before launching a job: 15–30 seconds (quick bite-sized clips), 30–60 seconds (optimal for Shorts/Reels), or 60–90 seconds (in-depth explanations).",
      category: "Customization",
    },
    {
      question: "Can I generate vertical clips?",
      answer:
        "Yes. The default output format is 9:16 vertical video (1080x1920) formatted specifically for mobile platforms like TikTok, YouTube Shorts, and Instagram Reels. 1:1 square and 16:9 landscape options are also available.",
      category: "Formats",
    },
    {
      question: "Can I add captions?",
      answer:
        "Yes. When caption rendering is toggled on, high-contrast, styled subtitles are burned directly into the video frames so viewers can understand the clip with sound turned off.",
      category: "Subtitles",
    },
    {
      question: "Can I download my clips?",
      answer:
        "Yes. Every generated clip can be previewed in real-time and downloaded individually as a standard 1080p MP4 file. If cloud storage is enabled, your jobs and clips remain accessible in your history dashboard.",
      category: "Export & Storage",
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="w-full py-16 sm:py-24 bg-[#0a0b0d] border-b border-[#1f2229]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-2">
            SECTION 10 &bull; FREQUENTLY ASKED QUESTIONS
          </div>
          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mb-3">
            Clear Answers. No Guesswork.
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 font-mono">
            Everything you need to know about processing limits, formats, subtitles, and downloads.
          </p>
        </div>

        {/* Accordion List */}
        <div className="flex flex-col gap-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className={`border transition-colors ${
                  isOpen
                    ? "bg-[#14161a] border-amber-500/80"
                    : "bg-[#111215] border-[#252830] hover:border-[#333742]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleFAQ(index)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-4 focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-gray-400">
                      0{index + 1}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-white uppercase tracking-tight">
                      {faq.question}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 bg-[#181a1f] border border-[#272a31] text-gray-400 uppercase">
                      {faq.category}
                    </span>
                    <div className={`p-1 bg-[#1c1e24] border border-[#2e313b] text-gray-300 transition-transform ${isOpen ? "rotate-180 text-amber-400" : ""}`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-5 sm:px-5 sm:pb-6 pt-1 border-t border-[#1e2026] text-xs sm:text-sm text-gray-300 leading-relaxed font-sans">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
