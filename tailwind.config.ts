import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zeylora: {
          cyan: "#2563EB",
          violet: "#4F46E5",
          magenta: "#0F766E",
          blue: "#2563EB",
          obsidian: "#F8FAFC",
          midnight: "#FFFFFF",
          ink: "#0F172A",
          surface: "#FFFFFF",
          surface2: "#F1F5F9",
          surface3: "#E2E8F0"
        },
        midnight: "#FFFFFF",
        ink: "#0F172A",
        obsidian: "#F8FAFC",
        panel: "#FFFFFF",
        line: "rgba(15, 23, 42, 0.10)",
        cyan: "#2563EB",
        violet: "#4F46E5",
        magenta: "#0F766E",
        emerald: "#059669",
        warning: "#FBBF24",
        danger: "#FB7185"
      },
      boxShadow: {
        glow: "0 10px 24px rgba(15, 23, 42, 0.10)",
        violet: "0 12px 34px rgba(15, 23, 42, 0.10)",
        magenta: "0 12px 34px rgba(15, 23, 42, 0.10)",
        cinematic: "0 18px 46px rgba(15, 23, 42, 0.12)"
      },
      backgroundImage: {
        "zeylora-brand": "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
        "premium-radial":
          "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 52%, #EFF6FF 100%)",
        "cinematic-depth":
          "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 44%, #EFF6FF 100%)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" }
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        shimmer: "shimmer 3.2s ease-in-out infinite",
        "fade-up": "fadeUp .7s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
