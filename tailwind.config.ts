import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zeylora: {
          cyan: "#20D3FF",
          violet: "#8B5CF6",
          magenta: "#EC4899",
          blue: "#3B82F6",
          obsidian: "#03050D",
          midnight: "#050814",
          ink: "#0B1020",
          surface: "#0E1628",
          surface2: "#111B31",
          surface3: "#17223A"
        },
        midnight: "#050814",
        ink: "#0B1020",
        obsidian: "#03050D",
        panel: "#0E1628",
        line: "rgba(255, 255, 255, 0.10)",
        cyan: "#20D3FF",
        violet: "#8B5CF6",
        magenta: "#EC4899",
        emerald: "#34D399",
        warning: "#FBBF24",
        danger: "#FB7185"
      },
      boxShadow: {
        glow: "0 0 42px rgba(32, 211, 255, 0.28)",
        violet: "0 18px 80px rgba(139, 92, 246, 0.24)",
        magenta: "0 18px 90px rgba(236, 72, 153, 0.18)",
        cinematic: "0 28px 120px rgba(0, 0, 0, 0.52)"
      },
      backgroundImage: {
        "zeylora-brand": "linear-gradient(135deg, #20D3FF 0%, #8B5CF6 52%, #EC4899 100%)",
        "premium-radial":
          "radial-gradient(circle at top left, rgba(32,211,255,.24), transparent 34%), radial-gradient(circle at top right, rgba(236,72,153,.16), transparent 30%), linear-gradient(180deg, #050814 0%, #0B1020 52%, #03050D 100%)",
        "cinematic-depth":
          "radial-gradient(circle at 18% 12%, rgba(32,211,255,.24), transparent 28%), radial-gradient(circle at 82% 18%, rgba(236,72,153,.16), transparent 24%), radial-gradient(circle at 52% 58%, rgba(139,92,246,.14), transparent 36%), linear-gradient(180deg, #050814 0%, #070A18 44%, #03050D 100%)"
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
