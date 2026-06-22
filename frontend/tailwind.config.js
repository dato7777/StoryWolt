/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ['"Sora"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        brand: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
        },
        canvas: {
          DEFAULT: "#f4f6fb",
          deep: "#e8edf7",
        },
        ink: {
          DEFAULT: "#0f172a",
          muted: "#475569",
          faint: "#94a3b8",
        },
      },
      boxShadow: {
        soft: "0 2px 8px rgba(15, 23, 42, 0.04), 0 16px 48px rgba(15, 23, 42, 0.06)",
        card: "0 0 0 1px rgba(15, 23, 42, 0.04), 0 8px 32px rgba(15, 23, 42, 0.08)",
        glow: "0 0 0 1px rgba(59, 130, 246, 0.12), 0 12px 40px rgba(59, 130, 246, 0.15)",
        "glow-emerald": "0 0 0 1px rgba(16, 185, 129, 0.15), 0 16px 48px rgba(16, 185, 129, 0.2)",
      },
      animation: {
        "fade-up": "fadeUp 0.55s ease-out forwards",
        "hero-enter-left": "heroEnterLeft 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "hero-enter-right": "heroEnterRight 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "hero-zoom-in": "heroZoomIn 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "tab-spotlight": "tabSpotlight 1.4s ease-in-out infinite",
        "orb-float": "orbFloat 18s ease-in-out infinite",
        "shimmer": "shimmer 2.5s ease-in-out infinite",
        "welcome-ring": "welcomeRingPulse 3.2s ease-in-out infinite",
        "welcome-gradient": "welcomeGradientShift 4s ease infinite",
        "welcome-particle": "welcomeParticleFloat 3.5s ease-in-out infinite",
        "welcome-scan": "welcomeScan 4s linear infinite",
        "welcome-progress": "welcomeProgress 2.2s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "welcome-word-in": "welcomeWordIn 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        heroEnterLeft: {
          "0%": { opacity: "0", transform: "translateX(-48px) scale(0.92)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        heroEnterRight: {
          "0%": { opacity: "0", transform: "translateX(48px) scale(0.92)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        heroZoomIn: {
          "0%": { opacity: "0", transform: "scale(0.88)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        tabSpotlight: {
          "0%, 100%": {
            boxShadow:
              "inset 0 0 0 1px rgba(239, 68, 68, 0.45), 0 0 0 0 rgba(239, 68, 68, 0.35), 0 8px 24px rgba(239, 68, 68, 0.2)",
          },
          "50%": {
            boxShadow:
              "inset 0 0 0 2px rgba(239, 68, 68, 0.55), 0 0 0 4px rgba(239, 68, 68, 0.18), 0 12px 32px rgba(239, 68, 68, 0.28)",
          },
        },
        orbFloat: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(24px, -18px) scale(1.05)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        welcomeRingPulse: {
          "0%, 100%": { transform: "translate(-50%, -50%) scale(0.92)", opacity: "0.35" },
          "50%": { transform: "translate(-50%, -50%) scale(1.08)", opacity: "0.65" },
        },
        welcomeGradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        welcomeParticleFloat: {
          "0%, 100%": { transform: "translateY(0) scale(1)", opacity: "0.2" },
          "50%": { transform: "translateY(-18px) scale(1.4)", opacity: "0.9" },
        },
        welcomeScan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        welcomeProgress: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        welcomeExit: {
          "0%": { opacity: "1", transform: "scale(1)", filter: "blur(0)" },
          "100%": { opacity: "0", transform: "scale(1.06)", filter: "blur(12px)" },
        },
        welcomeWordIn: {
          "0%": { opacity: "0", transform: "translateY(28px) scale(0.88) blur(8px)" },
          "60%": { opacity: "1", transform: "translateY(-4px) scale(1.02) blur(0)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1) blur(0)" },
        },
      },
    },
  },
  plugins: [],
};
