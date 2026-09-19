"use client";

import React from "react";
import Link from "next/link";
import { Scissors } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#0a0b0d] border-t border-[#1f2229] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand & Description */}
          <div className="md:col-span-2 flex flex-col justify-start">
            <Link href="/" className="flex items-center gap-2.5 group mb-4">
              <div className="w-8 h-8 bg-amber-500 text-black flex items-center justify-center font-black text-sm border border-amber-500 flex-shrink-0">
                <Scissors className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="text-base font-black tracking-tight uppercase">
                <span className="text-white">Clip</span>
                <span className="text-amber-500">Craft</span>
              </span>
            </Link>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed font-sans">
              Autonomous short-form video repurposing utility. Transforms YouTube long-form videos into high-retention 9:16 vertical clips with styled subtitles.
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 mb-4">
              Product
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-gray-400 font-mono">
              <li>
                <Link href="/dashboard" className="hover:text-amber-400 transition-colors">
                  AI Video Clipper
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-amber-400 transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-amber-400 transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#before-after" className="hover:text-amber-400 transition-colors">
                  Before &amp; After
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-amber-400 transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Account & Legal */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 mb-4">
              Account &amp; Legal
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-gray-400 font-mono">
              <li>
                <Link href="/login" className="hover:text-amber-400 transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-amber-400 transition-colors">
                  Get Started
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-amber-400 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <span className="text-gray-400 cursor-not-allowed">
                  Privacy Policy
                </span>
              </li>
              <li>
                <span className="text-gray-400 cursor-not-allowed">
                  Terms of Service
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-8 border-t border-[#1e2025] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-1.5 uppercase">
            <span>&copy; {new Date().getFullYear()}</span>
            <span className="font-bold">
              <span className="text-white">Clip</span>
              <span className="text-amber-500">Craft</span>
            </span>
            <span className="text-gray-600">&bull;</span>
            <span>All rights reserved.</span>
            <span className="text-gray-600">&bull;</span>
            <span className="text-gray-500">Autonomous Video Utility</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 font-mono">
            <span>Built by Team</span>
            <span className="font-bold">
              <span className="text-gray-200">Hack</span>
              <span className="text-purple-500">Scouts</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
