'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Lock,
  ExternalLink,
  X,
  ChevronLeft,
  Zap,
  Award,
} from 'lucide-react';

export interface WelcomeBanner3DProps {
  isOpen: boolean;
  onClose: (dontShowToday?: boolean) => void;
  userName?: string;
}

export const WelcomeBanner3D: React.FC<WelcomeBanner3DProps> = ({
  isOpen,
  onClose,
  userName = 'مدير النظام',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [glare, setGlare] = useState<{ x: number; y: number; opacity: number }>({
    x: 50,
    y: 50,
    opacity: 0,
  });
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [dontShowToday, setDontShowToday] = useState<boolean>(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  // Detect touch screens / mobile devices to completely disable mouse tilt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isCoarse = window.matchMedia('(hover: none) or (pointer: coarse)').matches;
      setIsTouchDevice(isCoarse);
    }
  }, []);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose(dontShowToday);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, dontShowToday]);

  // Subtle, controlled 3D Tilt on Desktop (Max ±1.8deg) - Completely still on mobile
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTouchDevice || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Ultra-subtle micro-tilt (max ±1.8 degrees) to preserve rock-solid stability
      const rotateY = ((x - centerX) / centerX) * 1.8;
      const rotateX = -((y - centerY) / centerY) * 1.8;

      // Subtle Glare coordinates
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;

      setTilt({ x: rotateX, y: rotateY });
      setGlare({ x: glareX, y: glareY, opacity: 0.16 });
    },
    [isTouchDevice]
  );

  const handleMouseEnter = () => {
    if (!isTouchDevice) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
    setGlare(prev => ({ ...prev, opacity: 0 }));
  };

  const handlePrimaryAction = () => {
    onClose(dontShowToday);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="بنر ترحيبي نظام أمان"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-y-auto bg-slate-950/85 backdrop-blur-xl animate-backdrop-fade select-none"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose(dontShowToday);
        }
      }}
    >
      {/* ========================================================================= */}
      {/* CINEMATIC TIMELINE MOTION ENGINE (Pure GPU Compositing - 60 FPS Guaranteed) */}
      {/* ========================================================================= */}
      <style>{`
        /* --- 1. Backdrop Fade (0.0s -> 0.4s) --- */
        @keyframes sceneBackdropFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-backdrop-fade {
          animation: sceneBackdropFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* --- 2. Energy Wakeup Pulse in Center (0.05s -> 0.45s) --- */
        @keyframes energyWakeupPulse {
          0% {
            opacity: 0;
            transform: scale(0.2);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.0);
          }
          100% {
            opacity: 0.35;
            transform: scale(1.0);
          }
        }
        .anim-energy-wake {
          animation: energyWakeupPulse 0.45s 0.05s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 3. Shield Birth (0.35s -> 0.9s) --- */
        @keyframes shieldBirthAnim {
          0% {
            opacity: 0;
            transform: scale(0.95);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: scale(1.0);
            filter: blur(0px);
          }
        }
        .anim-shield-birth {
          animation: shieldBirthAnim 0.55s 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 4. Ring Assembly: Outer & Inner rotate once to form then STOP (0.35s -> 0.9s) --- */
        @keyframes ringAssembleOuter {
          0% {
            opacity: 0;
            transform: rotate(-60deg) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: rotate(0deg) scale(1.0);
          }
        }
        .anim-ring-outer {
          animation: ringAssembleOuter 0.55s 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes ringAssembleInner {
          0% {
            opacity: 0;
            transform: rotate(60deg) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: rotate(0deg) scale(1.0);
          }
        }
        .anim-ring-inner {
          animation: ringAssembleInner 0.55s 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 5. Single Outward Shield Wave Pulse upon shield birth (0.85s -> 1.35s) --- */
        @keyframes shieldWavePulseOut {
          0% {
            opacity: 0.75;
            transform: scale(0.95);
          }
          100% {
            opacity: 0;
            transform: scale(1.85);
          }
        }
        .anim-shield-wave {
          animation: shieldWavePulseOut 0.5s 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* --- 6. Clean RTL Reveal for Title: "مرحباً بك في" (0.75s -> 1.1s) --- */
        @keyframes rtlTextReveal1 {
          0% {
            opacity: 0;
            transform: translateY(6px);
            clip-path: inset(0 0 0 100%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            clip-path: inset(0 0 0 0%);
          }
        }
        .anim-title-part1 {
          animation: rtlTextReveal1 0.4s 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 7. Clean RTL Reveal for System Name: "نظام أمان للتقسيط" (0.95s -> 1.35s) --- */
        @keyframes rtlTextReveal2 {
          0% {
            opacity: 0;
            transform: translateY(6px);
            clip-path: inset(0 0 0 100%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            clip-path: inset(0 0 0 0%);
          }
        }
        .anim-title-part2 {
          animation: rtlTextReveal2 0.45s 0.95s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 8. Value Proposition Line: "حيث" (1.20s -> 1.45s) --- */
        @keyframes subtitleLeadAnim {
          0% {
            opacity: 0;
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .anim-value-lead {
          animation: subtitleLeadAnim 0.35s 1.20s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 9. Sequenced Reveal of the Three Values: القوة -> الثقة -> الأمان (1.30s -> 1.75s) --- */
        @keyframes wordValueReveal {
          0% {
            opacity: 0;
            transform: translateY(5px);
            filter: drop-shadow(0 0 0px transparent);
          }
          60% {
            opacity: 1;
            transform: translateY(0);
            filter: drop-shadow(0 0 8px currentColor);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: drop-shadow(0 0 2px currentColor);
          }
        }
        .anim-val-word1 {
          animation: wordValueReveal 0.35s 1.32s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .anim-val-word2 {
          animation: wordValueReveal 0.35s 1.46s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .anim-val-word3 {
          animation: wordValueReveal 0.35s 1.60s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* Value Underline Laser Trace from Right to Left */
        @keyframes laserUnderlineTrace {
          0% {
            transform: scaleX(0);
            transform-origin: right;
            opacity: 0;
          }
          50% {
            transform: scaleX(1);
            transform-origin: right;
            opacity: 1;
          }
          100% {
            transform: scaleX(1);
            transform-origin: right;
            opacity: 0.6;
          }
        }
        .anim-laser-line {
          animation: laserUnderlineTrace 0.55s 1.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 10. Description Paragraph (1.60s -> 1.95s) --- */
        @keyframes descRevealAnim {
          0% {
            opacity: 0;
            transform: translateY(5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .anim-desc {
          animation: descRevealAnim 0.4s 1.60s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 11. Three Pillars Blur-to-Clear Staggered Reveal (1.75s -> 2.15s) --- */
        @keyframes pillarRevealAnim {
          0% {
            opacity: 0;
            transform: translateY(6px);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
        }
        .anim-pillar-1 {
          animation: pillarRevealAnim 0.4s 1.75s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .anim-pillar-2 {
          animation: pillarRevealAnim 0.4s 1.86s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .anim-pillar-3 {
          animation: pillarRevealAnim 0.4s 1.97s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 12. CTA Area Reveal: Enter Button (2.05s -> 2.45s) --- */
        @keyframes ctaAreaAnim {
          0% {
            opacity: 0;
            transform: translateY(5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .anim-cta-area {
          animation: ctaAreaAnim 0.4s 2.05s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* Single Light Sheen Sweep across CTA button once upon arrival (2.25s -> 2.85s) */
        @keyframes buttonSheenSweep {
          0% {
            transform: translateX(120%) skewX(-20deg);
            opacity: 0;
          }
          20% {
            opacity: 0.85;
          }
          100% {
            transform: translateX(-120%) skewX(-20deg);
            opacity: 0;
          }
        }
        .anim-sheen-sweep {
          animation: buttonSheenSweep 0.65s 2.30s ease-out forwards;
        }

        /* --- 13. Footer & Developer Rights Reveal (2.25s -> 2.65s) --- */
        @keyframes footerRevealAnim {
          0% {
            opacity: 0;
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .anim-footer {
          animation: footerRevealAnim 0.4s 2.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* --- 14. Permanent Subtle Ambient Stillness (2.6s onwards) --- */
        /* Only ultra-slow, breathing micro-glow for the central shield. Card itself is 100% static. */
        @keyframes shieldMicroBreath {
          0%, 100% {
            filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.35));
          }
          50% {
            filter: drop-shadow(0 0 24px rgba(16, 185, 129, 0.55));
          }
        }
        .ambient-shield-breath {
          animation: shieldMicroBreath 8.5s ease-in-out infinite;
        }

        .preserve-3d {
          transform-style: preserve-3d;
        }

        /* Support for users with prefers-reduced-motion: Instant, Still Display */
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after {
            animation-duration: 0.01ms !important;
            animation-delay: 0ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* 3D Perspective Viewport */}
      <div
        className="w-full max-w-3xl perspective-[1200px] flex items-center justify-center py-2 sm:py-4"
        style={{ perspective: '1200px' }}
      >
        {/* Main Card: Rock-solid & grounded after entrance (no whole-card floating) */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            transform:
              !isTouchDevice && isHovered
                ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
                : 'rotateX(0deg) rotateY(0deg)',
            transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative w-full rounded-3xl bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-emerald-500/35 shadow-[0_20px_70px_-15px_rgba(16,185,129,0.30)] p-5 sm:p-8 md:p-10 text-right overflow-hidden preserve-3d"
        >
          {/* Subtle Specular Glare (Active on Desktop mouse move only) */}
          {!isTouchDevice && (
            <div
              className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300 z-30"
              style={{
                background: `radial-gradient(circle 380px at ${glare.x}% ${glare.y}%, rgba(52, 211, 153, ${glare.opacity}), transparent 70%)`,
              }}
            />
          )}

          {/* Background Ambient Glowing Orbs (Steady & Serene) */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 w-80 h-80 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />

          {/* Subtle Grid Pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          {/* Close Button (Top-Corner in RTL) */}
          <button
            onClick={() => onClose(dontShowToday)}
            title="إغلاق الترحيب"
            className="absolute top-4 left-4 sm:top-5 sm:left-5 z-40 p-2 sm:p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white border border-slate-700/60 hover:border-emerald-500/50 transition-all duration-200 cursor-pointer shadow-lg"
            style={{ transform: 'translateZ(30px)' }}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Top Tag: System Version & Greeting */}
          <div
            className="flex items-center justify-between gap-3 mb-4 sm:mb-6 anim-title-part1"
            style={{ transform: 'translateZ(25px)' }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] sm:text-xs font-bold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>إصدار أمان المالي الذكي 2026</span>
            </div>

            <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
              أهلاً وسهلاً بك، <span className="text-emerald-300 font-bold">{userName}</span>
            </div>
          </div>

          {/* Center Visual Hero: Shield & Formed Rings (Born from Light Pulse) */}
          <div
            className="relative flex items-center justify-center my-3 sm:my-6"
            style={{ transform: 'translateZ(40px)' }}
          >
            {/* Step 1: Energy Wake-up Light Point in Center */}
            <div className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-emerald-500/25 blur-2xl anim-energy-wake pointer-events-none" />

            {/* Single Outward Ripple Pulse upon birth */}
            <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-emerald-400/60 anim-shield-wave pointer-events-none" />

            {/* Step 2: Outer Ring Forms once and rests still */}
            <div
              className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full border-2 border-dashed border-emerald-500/30 anim-ring-outer pointer-events-none"
            />

            {/* Step 2: Inner Ring Forms once and rests still */}
            <div
              className="absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-teal-400/40 anim-ring-inner pointer-events-none"
              style={{ borderStyle: 'double' }}
            />

            {/* Step 3: Core Shield: Born from light, rests with ultra-slow micro-breathing */}
            <div
              className="relative w-18 h-18 sm:w-22 sm:h-22 rounded-3xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-[0_0_40px_rgba(16,185,129,0.4)] flex items-center justify-center anim-shield-birth ambient-shield-breath"
            >
              <div className="w-full h-full rounded-[22px] bg-slate-950/90 flex items-center justify-center">
                <ShieldCheck className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-400" />
              </div>
            </div>

            {/* Flanking Badges: Appear in harmony with the shield */}
            <div
              className="absolute -top-1 right-1/4 p-1.5 sm:p-2 rounded-xl bg-slate-900/90 border border-emerald-500/40 text-emerald-300 shadow-md hidden sm:flex items-center gap-1 text-[11px] font-bold anim-shield-birth"
              style={{ transform: 'translateZ(45px)' }}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>سرعة فائقة</span>
            </div>

            <div
              className="absolute -bottom-1 left-1/4 p-1.5 sm:p-2 rounded-xl bg-slate-900/90 border border-teal-500/40 text-teal-300 shadow-md hidden sm:flex items-center gap-1 text-[11px] font-bold anim-shield-birth"
              style={{ transform: 'translateZ(45px)' }}
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>خصوصية تامة</span>
            </div>
          </div>

          {/* Main Headline & Sequential Values (Staggered Cinematic Reveal) */}
          <div className="text-center space-y-2.5 sm:space-y-4 my-3 sm:my-6" style={{ transform: 'translateZ(45px)' }}>
            {/* Title: Reveal from Right to Left */}
            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-snug sm:leading-tight">
              <span className="inline-block anim-title-part1 ml-1.5">مرحباً بك في</span>
              <span className="inline-block anim-title-part2 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                نظام أمان للتقسيط
              </span>
            </h1>

            {/* Subtitle & The 3 Values (Staggered with subtle underline highlight) */}
            <div className="relative inline-block text-sm sm:text-xl md:text-2xl font-bold text-slate-200 tracking-wide">
              <span className="inline-block anim-value-lead ml-2">حيث</span>
              <span className="inline-block anim-val-word1 text-emerald-400 ml-1.5">
                القوة
              </span>
              <span className="inline-block anim-value-lead ml-1.5">و</span>
              <span className="inline-block anim-val-word2 text-teal-300 ml-1.5">
                الثقة
              </span>
              <span className="inline-block anim-value-lead ml-1.5">و</span>
              <span className="inline-block anim-val-word3 text-cyan-300">
                الأمان
              </span>

              {/* Laser Underline Trace flowing from right to left */}
              <div className="h-0.5 sm:h-1 w-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 rounded-full mt-1 anim-laser-line" />
            </div>

            {/* Descriptive Text: Enters smoothly */}
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed anim-desc">
              المنصة المتكاملة لإدارة محافظ الاستثمار، تمويل الأقساط والمواد، متابعة الزبائن والديون، واحتساب الأرباح بدقة متناهية وفق أعلى معايير الحماية المالية.
            </p>
          </div>

          {/* 3 Pillars of Strength, Trust & Security (Blur-to-Clear Staggered Reveal) */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 my-4 sm:my-6 text-right"
            style={{ transform: 'translateZ(35px)' }}
          >
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 hover:border-emerald-500/50 transition-colors duration-200 anim-pillar-1">
              <div className="flex items-center gap-2 sm:gap-2.5 mb-1 sm:mb-1.5">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white">القوة المالية</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                إدارة مستقلة ومباشرة لصناديق المستثمرين، حركة المخزون، وسرعة في إبرام العقود.
              </p>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 hover:border-teal-500/50 transition-colors duration-200 anim-pillar-2">
              <div className="flex items-center gap-2 sm:gap-2.5 mb-1 sm:mb-1.5">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
                  <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white">الثقة المطلقة</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                شفافية كاملة في احتساب حصص الأرباح، تقارير P&L دقيقة، وسندات قبض موثقة.
              </p>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 hover:border-cyan-500/50 transition-colors duration-200 anim-pillar-3">
              <div className="flex items-center gap-2 sm:gap-2.5 mb-1 sm:mb-1.5">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white">الأمان والخصوصية</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                نظام حماية وإخفاء الأرقام والأسماء، صلاحيات دقيقة للموظفين وسجلات تتبع.
              </p>
            </div>
          </div>

          {/* Primary Action Button with Single Arrival Light Sweep */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-slate-800/80 anim-cta-area"
            style={{ transform: 'translateZ(30px)' }}
          >
            {/* Don't Show Again Today Checkbox */}
            <label className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 hover:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={e => setDontShowToday(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span>عدم إظهار هذه الرسالة الترحيبية تلقائياً اليوم</span>
            </label>

            {/* Enter System Button: Solid, Grounded, with Single Welcome Sheen */}
            <button
              onClick={handlePrimaryAction}
              className="relative overflow-hidden w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-2xl bg-[#0A3C6E] hover:bg-[#072B50] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0A3C6E]/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
            >
              {/* Single Arrival Sheen Light Beam */}
              <span className="pointer-events-none absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent anim-sheen-sweep" />

              <span className="relative z-10">دخول النظام والبدء</span>
              <ChevronLeft className="w-4 h-4 relative z-10" />
            </button>
          </div>

          {/* Bottom Footer: Developer Rights & Ajeeb Company Link */}
          <div
            className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-[11px] sm:text-xs text-slate-400 anim-footer"
            style={{ transform: 'translateZ(25px)' }}
          >
            <div className="flex items-center gap-1.5 font-medium">
              <span className="text-slate-500">حقوق التطوير:</span>
              <span className="text-emerald-400 font-bold">برمجة وتطوير مروان أحمد</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">مشغل بواسطة:</span>
              <a
                href="https://www.ajeebiq.com/"
                target="_blank"
                rel="noopener noreferrer"
                title="زيارة موقع شركة عجيب للحلول التقنية والبرمجية"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 font-semibold transition-all duration-200 shadow-sm group"
              >
                <span>شركة عجيب</span>
                <span className="text-[10px] text-slate-400 group-hover:text-emerald-400 font-mono" dir="ltr">
                  ajeebiq.com
                </span>
                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-400 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
