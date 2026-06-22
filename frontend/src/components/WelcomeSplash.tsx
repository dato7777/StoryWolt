/**
 * Full-screen welcome interstitial — shown once after a fresh login.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

interface WelcomeSplashProps {
  onComplete: () => void;
}

const WORDS = ["Welcome", "to", "StoryPhone,", "Tomer!"] as const;
const STAGGER_MS = 220;
const HOLD_MS = 2200;
const EXIT_MS = 700;

export function WelcomeSplash({ onComplete }: WelcomeSplashProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [exiting, setExiting] = useState(false);

  const finish = useCallback(() => {
    setExiting(true);
    window.setTimeout(onComplete, EXIT_MS);
  }, [onComplete]);

  useEffect(() => {
    if (visibleCount >= WORDS.length) return;
    const id = window.setTimeout(() => setVisibleCount((c) => c + 1), STAGGER_MS);
    return () => window.clearTimeout(id);
  }, [visibleCount]);

  useEffect(() => {
    if (visibleCount < WORDS.length) return;
    const id = window.setTimeout(() => finish(), HOLD_MS);
    return () => window.clearTimeout(id);
  }, [visibleCount, finish]);

  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${(i * 37 + 11) % 100}%`,
        top: `${(i * 53 + 7) % 100}%`,
        delay: `${(i % 7) * 0.35}s`,
        size: 3 + (i % 4),
      })),
    [],
  );

  return (
    <div
      className={`welcome-splash fixed inset-0 z-[200] flex cursor-pointer items-center justify-center overflow-hidden ${
        exiting ? "welcome-splash-exit" : ""
      }`}
      role="dialog"
      aria-live="polite"
      aria-label="Welcome to StoryPhone, Tomer!"
      onClick={() => {
        if (!exiting) finish();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!exiting) finish();
        }
      }}
      tabIndex={-1}
    >
      <div className="welcome-splash-bg" aria-hidden />
      <div className="welcome-splash-grid" aria-hidden />
      <div className="welcome-splash-scanline" aria-hidden />

      {particles.map((p) => (
        <span
          key={p.id}
          className="welcome-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
          }}
          aria-hidden
        />
      ))}

      <div className="orb -left-20 top-1/4 h-96 w-96 animate-orb-float bg-indigo-500/40" aria-hidden />
      <div
        className="orb right-0 top-0 h-[32rem] w-[32rem] animate-orb-float bg-cyan-400/30"
        style={{ animationDelay: "-4s" }}
        aria-hidden
      />
      <div
        className="orb bottom-0 left-1/3 h-80 w-80 animate-orb-float bg-violet-500/35"
        style={{ animationDelay: "-9s" }}
        aria-hidden
      />

      <div className="welcome-splash-ring welcome-splash-ring-1" aria-hidden />
      <div className="welcome-splash-ring welcome-splash-ring-2" aria-hidden />
      <div className="welcome-splash-ring welcome-splash-ring-3" aria-hidden />

      <div className="welcome-splash-content relative z-10 px-6 text-center">
        <p className="welcome-splash-eyebrow mb-6 text-xs font-bold uppercase tracking-[0.45em] text-white/70 sm:text-sm">
          Story Phone
        </p>

        <h1 className="welcome-splash-headline flex flex-wrap items-baseline justify-center gap-x-3 gap-y-2 sm:gap-x-4">
          {WORDS.map((word, index) => {
            const shown = index < visibleCount;
            const isBrand = word === "StoryPhone,";
            const isName = word === "Tomer!";
            return (
              <span
                key={word}
                className={`welcome-word inline-block font-display font-bold ${
                  shown ? "welcome-word-in" : "opacity-0"
                } ${
                  isBrand
                    ? "welcome-word-brand text-4xl sm:text-6xl lg:text-7xl"
                    : isName
                      ? "welcome-word-name text-3xl sm:text-5xl lg:text-6xl"
                      : "text-2xl text-white/90 sm:text-4xl lg:text-5xl"
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {word}
              </span>
            );
          })}
        </h1>

        <div
          className={`mx-auto mt-10 h-1 overflow-hidden rounded-full bg-white/10 transition-opacity duration-500 ${
            visibleCount >= WORDS.length ? "opacity-100" : "opacity-0"
          }`}
          style={{ width: "min(18rem, 70vw)" }}
          aria-hidden
        >
          <div className="welcome-splash-progress h-full rounded-full" />
        </div>

        <p
          className={`mt-8 text-xs font-semibold tracking-wide text-white/40 transition-opacity duration-700 ${
            visibleCount >= WORDS.length ? "opacity-100" : "opacity-0"
          }`}
        >
          Tap anywhere to continue
        </p>
      </div>
    </div>
  );
}
