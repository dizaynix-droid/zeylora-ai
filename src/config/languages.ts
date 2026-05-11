export const languages = [
  { code: "en", label: "English", dir: "ltr", enabled: true },
  { code: "es", label: "Español", dir: "ltr", enabled: false },
  { code: "tr", label: "Türkçe", dir: "ltr", enabled: false },
  { code: "ar", label: "العربية", dir: "rtl", enabled: false },
  { code: "pt", label: "Português", dir: "ltr", enabled: false },
  { code: "de", label: "Deutsch", dir: "ltr", enabled: false },
  { code: "fr", label: "Français", dir: "ltr", enabled: false }
] as const;

export type Locale = (typeof languages)[number]["code"];
export const defaultLocale: Locale = "en";
