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
  }
] as const;

export type FontId = (typeof FONT_OPTIONS)[number]["id"];

export interface FontSettings {
  default: FontId;
  page?: FontId | undefined;
  headings?: FontId | undefined;
  navigation?: FontId | undefined;
  event?: FontId | undefined;
  article?: FontId | undefined;
  gallery?: FontId | undefined;
  card?: FontId | undefined;
  cta?: FontId | undefined;
}

export function fontSupportsLanguages(fontId: string, languageCodes: readonly string[]) {
  const font = FONT_OPTIONS.find((item) => item.id === fontId);
  if (!font) return false;
  if (font.languageCodes === "all") return true;
  return languageCodes.every((code) => (font.languageCodes as readonly string[]).includes(code));
}
