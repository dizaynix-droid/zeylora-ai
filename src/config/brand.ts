export const brandIdentity = {
  name: "Zeylora AI",
  shortName: "Zeylora",
  positioning:
    "A premium email verification and list cleaning platform for serious senders.",
  personality: ["premium", "fast", "accurate", "operational", "minimal", "trustworthy"],
  colors: {
    primary: {
      cyan: "#20D3FF",
      violet: "#8B5CF6",
      magenta: "#EC4899",
      auroraBlue: "#3B82F6"
    },
    background: {
      obsidian: "#03050D",
      midnight: "#050814",
      deepInk: "#0B1020",
      blueBlack: "#08111F"
    },
    surface: {
      surface1: "#0E1628",
      surface2: "#111B31",
      surface3: "#17223A",
      glass: "rgba(255,255,255,0.06)",
      border: "rgba(255,255,255,0.10)"
    },
    text: {
      primary: "#F8FAFC",
      secondary: "#CBD5E1",
      muted: "#94A3B8",
      subtle: "#64748B",
      inverted: "#07111F"
    },
    status: {
      success: "#34D399",
      warning: "#FBBF24",
      error: "#FB7185"
    }
  },
  gradients: {
    brand: "linear-gradient(135deg, #20D3FF 0%, #8B5CF6 52%, #EC4899 100%)",
    cinematic:
      "radial-gradient(circle at 18% 12%, rgba(32,211,255,.24), transparent 28%), radial-gradient(circle at 82% 18%, rgba(236,72,153,.16), transparent 24%), linear-gradient(180deg, #050814 0%, #070A18 44%, #03050D 100%)",
    surface: "linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.035))"
  },
  typography: {
    preferred: "Geist Sans",
    fallback: "Inter, ui-sans-serif, system-ui, sans-serif",
    headingWeight: 900,
    bodyWeight: 400,
    uiWeight: 700
  },
  radii: {
    button: "999px",
    input: "16px",
    card: "24px",
    hero: "32px",
    dashboard: "14px"
  },
  assets: {
    mark: "/brand/zeylora-mark.svg",
    primaryLogo: "/brand/zeylora-logo-primary.svg",
    monoLogo: "/brand/zeylora-logo-mono.svg",
    favicon: "/brand/zeylora-favicon.svg"
  }
} as const;
