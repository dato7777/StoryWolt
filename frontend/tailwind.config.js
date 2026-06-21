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
        "orb-float": "orbFloat 18s ease-in-out infinite",
        "shimmer": "shimmer 2.5s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        orbFloat: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(24px, -18px) scale(1.05)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
