import { z } from "zod";
import { parse as parseCss } from "css-tree";
import { FONT_OPTIONS, fontSupportsLanguages, type FontId, type FontSettings } from "./fonts.js";

export { FONT_OPTIONS, fontSupportsLanguages };
export type { FontId, FontSettings };

export const LocaleSchema = z.string().min(2);
export type Locale = z.infer<typeof LocaleSchema>;

export const LanguageSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  nativeName: z.string().min(1)
});
export type Language = z.infer<typeof LanguageSchema>;

export const RoleSchema = z.enum(["admin", "designer", "contributor"]);
export type Role = z.infer<typeof RoleSchema>;

export const PageStatusSchema = z.enum(["draft", "published"]);
export type PageStatus = z.infer<typeof PageStatusSchema>;

function splitCssDeclarations(value: string) {
  const declarations: string[] = [];
  let current = "";
  let quote: "'" | "\"" | "" = "";
  let depth = 0;

  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0) return [];
    if (char === ";" && depth === 0) {
      if (current.trim()) declarations.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (quote || depth !== 0) return [];
  if (current.trim()) declarations.push(current.trim());
  return declarations;
}

export function validateCssDeclarations(value: string): string[] {
  const css = value.trim();
  if (!css) return [];
  const errors: string[] = [];
  if (css.length > 3000) errors.push("CSS must be 3000 characters or fewer.");
  if (/[{}<>]/.test(css)) errors.push("Use CSS declarations only, without selectors, braces, or HTML.");
  if (/@|\/\*|\*\//.test(css)) errors.push("At-rules and CSS comments are not allowed in element CSS.");
  if (/javascript\s*:|expression\s*\(|url\s*\(/i.test(css)) errors.push("javascript:, expression(), and url() are not allowed.");

  const declarations = splitCssDeclarations(css);
  if (!declarations.length && css) errors.push("CSS declarations could not be parsed.");

  for (const declaration of declarations) {
    const colon = declaration.indexOf(":");
    if (colon <= 0) {
      errors.push(`Missing property/value separator in "${declaration}".`);
      continue;
    }
    const property = declaration.slice(0, colon).trim();
    const valuePart = declaration.slice(colon + 1).trim();
    if (!/^(--[a-zA-Z0-9_-]+|-?[a-zA-Z][a-zA-Z0-9-]*)$/.test(property)) {
      errors.push(`Invalid CSS property "${property}".`);
    }
    if (!valuePart) {
      errors.push(`Missing value for "${property}".`);
    }
  }

  return errors;
}

export const CssDeclarationsSchema = z.string().superRefine((value, ctx) => {
  for (const message of validateCssDeclarations(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }
});

export function validateStylesheet(value: string): string[] {
  const css = value.trim();
  if (!css) return [];
  const errors: string[] = [];
  if (css.length > 200000) errors.push("CSS must be 200,000 characters or fewer.");
  if (/<\/?script|<\/?style|javascript\s*:|expression\s*\(/i.test(css)) {
    errors.push("HTML, script/style tags, javascript:, and expression() are not allowed.");
  }
  try {
    parseCss(css, { context: "stylesheet", positions: false });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "CSS could not be parsed.");
  }
  return errors;
}

export const StylesheetSchema = z.object({
  css: z.string().superRefine((value, ctx) => {
    for (const message of validateStylesheet(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  })
});

function isSafeUrl(value: string, options: { allowMailto?: boolean; allowHash?: boolean }) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  if (options.allowHash && trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return !trimmed.includes(":");
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return true;
    return Boolean(options.allowMailto && parsed.protocol === "mailto:");
  } catch {
    return false;
  }
}

export const SafeLinkUrlSchema = z.string().min(1).superRefine((value, ctx) => {
  if (!isSafeUrl(value, { allowMailto: true, allowHash: true })) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL must be relative, http(s), mailto, or an anchor. Unsafe schemes are not allowed." });
  }
});

export const SafeMediaUrlSchema = z.string().min(1).superRefine((value, ctx) => {
  if (!isSafeUrl(value, {})) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Media URL must be relative or http(s). Unsafe schemes are not allowed." });
  }
});

export const LinkSchema = z.object({
  label: z.string().min(1),
  href: SafeLinkUrlSchema,
  variant: z.enum(["primary", "secondary", "plain"]).default("primary")
});
export type Link = z.infer<typeof LinkSchema>;

export const MediaRefSchema = z.object({
  src: SafeMediaUrlSchema,
  alt: z.string().min(1),
  caption: z.string().optional(),
  description: z.string().optional(),
  translations: z.record(
    LocaleSchema,
    z.object({
      alt: z.string().optional(),
      caption: z.string().optional(),
      description: z.string().optional()
    })
  ).optional()
});
export type MediaRef = z.infer<typeof MediaRefSchema>;

export const FontIdSchema = z.enum(FONT_OPTIONS.map((font) => font.id) as [FontId, ...FontId[]]);

export const FontSettingsSchema = z.object({
  default: FontIdSchema.default("universal-serif"),
  page: FontIdSchema.optional(),
  headings: FontIdSchema.optional(),
  navigation: FontIdSchema.optional(),
  event: FontIdSchema.optional(),
  article: FontIdSchema.optional(),
  gallery: FontIdSchema.optional(),
  card: FontIdSchema.optional(),
  cta: FontIdSchema.optional()
});

function validateFontSettings(settings: FontSettings, languageCodes: string[], ctx: z.RefinementCtx) {
  for (const [key, value] of Object.entries(settings)) {
    if (value && !fontSupportsLanguages(value, languageCodes)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fonts", key],
        message: `${value} does not support all selected site languages.`
      });
    }
  }
}

const CustomCssSchema = {
  customCss: CssDeclarationsSchema.optional()
};

export const HeroBlockSchema = z.object({
  type: z.literal("hero"),
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  image: MediaRefSchema.optional(),
  actions: z.array(LinkSchema).default([]),
  ...CustomCssSchema
});

export const RichTextBlockSchema = z.object({
  type: z.literal("richText"),
  title: z.string().optional(),
  body: z.string().min(1),
  ...CustomCssSchema
});

export const CardGridBlockSchema = z.object({
  type: z.literal("cardGrid"),
  title: z.string().optional(),
  intro: z.string().optional(),
  cards: z.array(
    z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      image: MediaRefSchema.optional(),
      href: SafeLinkUrlSchema.optional()
    })
  ),
  ...CustomCssSchema
});

export const GalleryBlockSchema = z.object({
  type: z.literal("gallery"),
  title: z.string().optional(),
  intro: z.string().optional(),
  items: z.array(MediaRefSchema).default([]),
  ...CustomCssSchema
});

export const EventListBlockSchema = z.object({
  type: z.literal("eventList"),
  title: z.string().optional(),
  intro: z.string().optional(),
  eventIds: z.array(z.string()).default([]),
  showCalendar: z.boolean().default(true).optional(),
  ...CustomCssSchema
});

export const ArticleListBlockSchema = z.object({
  type: z.literal("articleList"),
  title: z.string().optional(),
  intro: z.string().optional(),
  articleIds: z.array(z.string()).default([]),
  ...CustomCssSchema
});

export const CtaBlockSchema = z.object({
  type: z.literal("cta"),
  title: z.string().optional(),
  body: z.string().optional(),
  actions: z.array(LinkSchema).default([]),
  ...CustomCssSchema
});

export const PageBlockSchema = z.discriminatedUnion("type", [
  HeroBlockSchema,
  RichTextBlockSchema,
  CardGridBlockSchema,
  GalleryBlockSchema,
  EventListBlockSchema,
  ArticleListBlockSchema,
  CtaBlockSchema
]).and(z.object({
  layoutColumn: z.string().optional()
}));
export type PageBlock = z.infer<typeof PageBlockSchema>;

export const SeoSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1)
});

export const PageLayoutSchema = z.object({
  columns: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    width: z.number().min(1).max(100)
  })).min(1).max(3)
}).default({
  columns: [{ id: "main", label: "Main", width: 100 }]
});
export type PageLayout = z.infer<typeof PageLayoutSchema>;

export const PageSchema = z.object({
  id: z.string().min(1),
  locale: LocaleSchema,
  status: PageStatusSchema.default("draft"),
  title: z.string().min(1),
  slug: z.string(),
  translationKey: z.string().min(1),
  seo: SeoSchema,
  layout: PageLayoutSchema,
  blocks: z.array(PageBlockSchema)
});
export type Page = z.infer<typeof PageSchema>;

export const ArticleSchema = z.object({
  id: z.string().min(1),
  locale: LocaleSchema,
  status: PageStatusSchema.default("draft"),
  title: z.string().min(1),
  slug: z.string().min(1),
  date: z.string().min(1),
  category: z.string().min(1),
  excerpt: z.string().min(1),
  featuredImage: MediaRefSchema.optional(),
  body: z.string().min(1),
  seo: SeoSchema
});
export type Article = z.infer<typeof ArticleSchema>;

export const EventSchema = z.object({
  id: z.string().min(1),
  status: PageStatusSchema.default("draft"),
  title: z.string().min(1),
  slug: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  locationName: z.string().optional(),
  address: z.string().optional(),
  image: MediaRefSchema.optional(),
  description: z.string().min(1),
  notes: z.string().optional(),
  translations: z.record(
    LocaleSchema,
    z.object({
      title: z.string().optional(),
      locationName: z.string().optional(),
      address: z.string().optional(),
      description: z.string().optional(),
      notes: z.string().optional()
    })
  ).optional()
});
export type Event = z.infer<typeof EventSchema>;

export interface NavigationItem {
  label: string;
  href: string;
  children: NavigationItem[];
}

export const NavigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
  z.object({
    label: z.string().min(1),
    href: SafeLinkUrlSchema,
    children: z.array(NavigationItemSchema).default([])
  })
);

export const NavigationSchema = z.object({
  locale: LocaleSchema,
  items: z.array(NavigationItemSchema)
});
export type Navigation = z.infer<typeof NavigationSchema>;

export const SiteSettingsSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().default("Community content, simple editing, and static publishing."),
  description: z.string().min(1),
  siteIcon: MediaRefSchema.optional(),
  defaultLocale: LocaleSchema,
  supportedLanguages: z.array(LanguageSchema).default([
    { code: "en", name: "English", nativeName: "English" }
  ]),
  locales: z.array(LocaleSchema).optional(),
  eventTimeZone: z.string().min(1).default("America/Phoenix"),
  headerMaxWidth: z.number().int().min(600).max(2400).optional(),
  fonts: FontSettingsSchema.default({ default: "universal-serif" }),
  contactEmail: z.string().email(),
  social: z.array(LinkSchema).default([])
}).superRefine((settings, ctx) => {
  validateFontSettings(settings.fonts, settings.supportedLanguages.map((language) => language.code), ctx);
});
export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

export const GalleryItemSchema = MediaRefSchema.extend({
  id: z.string().min(1).optional(),
  status: PageStatusSchema.default("published"),
  tags: z.array(z.string()).default([])
});
export type GalleryItem = z.infer<typeof GalleryItemSchema>;

export const GallerySchema = z.array(GalleryItemSchema);
export type Gallery = z.infer<typeof GallerySchema>;

export const UserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: RoleSchema,
  token: z.string().min(12)
});
export type User = z.infer<typeof UserSchema>;

export const UsersSchema = z.array(UserSchema);
export type Users = z.infer<typeof UsersSchema>;

export function pagePath(locale: Locale, slug: string): string {
  const pathSlug = slug ? `${slug}/` : "";
  return locale === "en" ? `/${pathSlug}` : `/${locale}/${pathSlug}`;
}
