export const FONT_OPTIONS = [
  {
    id: "system-sans",
    label: "System Sans",
    stack: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    languageCodes: "all"
  },
  {
    id: "universal-serif",
    label: "Universal Serif",
    stack: "Georgia, \"Times New Roman\", \"Noto Serif\", serif",
    languageCodes: "all"
  },
  {
    id: "editorial-serif",
    label: "Editorial Serif",
    stack: "Georgia, \"Times New Roman\", serif",
    languageCodes: ["en", "bg", "ru", "uk", "sr", "mk", "be", "el", "ro", "pl", "cs", "sk", "sl", "hr", "hu", "de", "fr", "es", "it", "pt", "nl", "sv", "da", "fi", "no", "lt", "lv", "et", "tr", "sq", "mt", "ga", "cy", "is", "lb", "ca", "eu", "gl"]
  },
  {
    id: "humanist-sans",
    label: "Humanist Sans",
    stack: "\"Segoe UI\", Frutiger, \"Helvetica Neue\", Arial, sans-serif",
    languageCodes: ["en", "bg", "ru", "uk", "sr", "mk", "be", "el", "ro", "pl", "cs", "sk", "sl", "hr", "hu", "de", "fr", "es", "it", "pt", "nl", "sv", "da", "fi", "no", "lt", "lv", "et", "tr", "sq", "mt", "ga", "cy", "is", "lb", "ca", "eu", "gl", "id", "ms", "fil", "vi", "sw", "af"]
  },
  {
    id: "ui-mono",
    label: "UI Monospace",
    stack: "\"Cascadia Code\", \"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace",
    languageCodes: ["en", "bg", "ru", "uk", "sr", "mk", "be", "ro", "pl", "cs", "sk", "sl", "hr", "hu", "de", "fr", "es", "it", "pt", "nl", "sv", "da", "fi", "no", "lt", "lv", "et", "tr", "sq", "mt"]
  },
  {
    id: "sans-serif",
    label: "Sans Serif",
    stack: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
    languageCodes: "all"
  }
] as const;

export type FontId = (typeof FONT_OPTIONS)[number]["id"];

export interface FontSettings {
  default: FontId;
  defaultSize?: string | undefined;
  page?: FontId | undefined;
  pageSize?: string | undefined;
  headings?: FontId | undefined;
  headingsSize?: string | undefined;
  navigation?: FontId | undefined;
  navigationSize?: string | undefined;
  event?: FontId | undefined;
  eventSize?: string | undefined;
  article?: FontId | undefined;
  articleSize?: string | undefined;
  gallery?: FontId | undefined;
  gallerySize?: string | undefined;
  card?: FontId | undefined;
  cardSize?: string | undefined;
  cta?: FontId | undefined;
  ctaSize?: string | undefined;
}

export function fontSupportsLanguages(fontId: string, languageCodes: readonly string[]) {
  const font = FONT_OPTIONS.find((item) => item.id === fontId);
  if (!font) return false;
  if (font.languageCodes === "all") return true;
  return languageCodes.every((code) => (font.languageCodes as readonly string[]).includes(code));
}
