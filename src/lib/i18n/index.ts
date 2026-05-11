import en from "@/i18n/en.json";
import tr from "@/i18n/tr.json";
import { defaultLocale, type Locale } from "@/config/languages";

const dictionaries = {
  en,
  tr
} as const;

export function getDictionary(locale: Locale = defaultLocale) {
  return dictionaries[locale as keyof typeof dictionaries] || dictionaries.en;
}
