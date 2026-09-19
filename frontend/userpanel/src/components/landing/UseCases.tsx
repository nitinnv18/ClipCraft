"use client";

import React from "react";
import { Mic, Video, GraduationCap, Users, UserCheck, Briefcase, User } from "lucide-react";

export const UseCases: React.FC = () => {
  const useCases = [
    {
      icon: Mic,
      title: "Podcasters",
      description: "Extract high-energy exchanges, debates, and memorable stories from 1-2 hour episodes.",
      focus: "Audio/Video Podcasts",
    },
    {
      icon: Video,
      title: "YouTubers",
      description: "Repurpose long-form video archives into vertical Shorts to capture organic feed distribution.",
      focus: "YouTube Shorts Growth",
    },
    {
      icon: GraduationCap,
      title: "Educators",
      description: "Break complex lectures, webinars, and course recordings into concise 45-second micro-lessons.",
      focus: "Course Repurposing",
    },
    {
      icon: UserCheck,
      title: "Coaches",
      description: "Extract actionable advice, frameworks, and client insights from recorded consultation calls.",
      focus: "Consulting & Webinars",
    },
    {
      icon: Users,
      title: "Interview Creators",
      description: "Clip the most impactful questions and candid guest revelations without scrubbing manually.",
      focus: "Interview Highlights",
    },
    {
      icon: Briefcase,
      title: "Content Teams",
      description: "Scale short-form output for brands and media companies without scaling editorial headcount.",
      focus: "Multi-Platform Publishing",
    },
    {
      icon: User,
      title: "Personal Brands",
      description: "Maintain daily publishing presence across TikTok, Instagram Reels, and Shorts from one weekly recording.",
      focus: "Creator Repurposing",
    },
  ];

  return (
    <section className="w-full py-16 sm:py-24 bg-[#0a0b0d] border-b border-[#1f2229]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-2">
            SECTION 08 &bull; TARGET AUDIENCE
          </div>
          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mb-4">
            Built For High-Output Creators &amp; Teams
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed font-sans">
            ClipCraft is designed for anyone producing long-form video who needs a fast, reliable workflow to extract and publish vertical clips.
          </p>
        </div>

        {/* Use Cases Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {useCases.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-9 h-9 bg-[#181a1f] border border-[#2d3039] flex items-center justify-center text-amber-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 uppercase">
                      0{idx + 1}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white uppercase tracking-tight mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-gray-400 leading-relaxed font-sans">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1e2025] text-[10px] font-mono text-amber-400">
                  {item.focus}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
