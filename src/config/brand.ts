export const brandIdentity = {
  name: "Zeylora",
  shortName: "Zeylora",
  positioning:
    "A premium email verification and list cleaning platform for serious senders.",
  personality: ["premium", "fast", "accurate", "operational", "minimal", "trustworthy"],
  colors: {
    primary: {
      cyan: "#2563EB",
      violet: "#4F46E5",
      magenta: "#0F766E",
      auroraBlue: "#2563EB"
    },
    background: {
      obsidian: "#F8FAFC",
      midnight: "#FFFFFF",
      deepInk: "#F1F5F9",
      blueBlack: "#E2E8F0"
    },
    surface: {
      surface1: "#FFFFFF",
      surface2: "#F8FAFC",
      surface3: "#F1F5F9",
      glass: "rgba(255,255,255,0.92)",
      border: "rgba(15,23,42,0.10)"
    },
    text: {
      primary: "#0F172A",
      secondary: "#334155",
      muted: "#64748B",
      subtle: "#64748B",
      inverted: "#FFFFFF"
    },
    status: {
      success: "#34D399",
      warning: "#FBBF24",
      error: "#FB7185"
    }
  },
  gradients: {
    brand: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
    cinematic: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
    surface: "linear-gradient(180deg, #FFFFFF, #F8FAFC)"
  },
  typography: {
    preferred: "Geist Sans",
    fallback: "Inter, ui-sans-serif, system-ui, sans-serif",
    headingWeight: 650,
    bodyWeight: 400,
    uiWeight: 700
  },
  radii: {
    button: "6px",
    input: "6px",
    card: "8px",
    hero: "12px",
    dashboard: "8px"
  },
  assets: {
    mark: "/brand/zeylora-mark.svg",
    primaryLogo: "/brand/zeylora-logo-primary.svg",
    monoLogo: "/brand/zeylora-logo-mono.svg",
    favicon: "/brand/zeylora-favicon.svg"
  }
} as const;
