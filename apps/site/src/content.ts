import { ArticleSchema, EventSchema, GallerySchema, NavigationSchema, PageSchema, SiteSettingsSchema, type Article, type Event, type Gallery, type Locale, type MediaRef, type Navigation, type Page, type SiteSettings } from "@community-site-engine/shared";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const contentRoot = resolve(process.cwd(), process.env.CONTENT_ROOT ?? "../../site-assets/content");

const fallbackSettings: SiteSettings = SiteSettingsSchema.parse({
  name: "Community Site Engine",
  tagline: "Community content, simple editing, and static publishing.",
  description: "A generic community website powered by structured content.",
  defaultLocale: "en",
  supportedLanguages: [{ code: "en", name: "English", nativeName: "English" }],
  eventTimeZone: "America/Phoenix",
  fonts: { default: "universal-serif" },
  contactEmail: "admin@example.com",
  social: []
});

const fallbackHomePage: Page = PageSchema.parse({
  id: "home",
  locale: "en",
  status: "published",
  title: "Home",
  slug: "",
  translationKey: "home",
  seo: {
    title: "Community Site Engine",
    description: "A generic community website powered by structured content."
  },
  blocks: [
    {
      type: "hero",
      eyebrow: "Community Site Engine",
      title: "Publish a static site from structured content",
      body: "Add private content under site-assets/content or sync it from the CMS content S3 bucket during deployment.",
      actions: []
    }
  ]
});

function fallbackNavigation(locale: Locale): Navigation {
  return NavigationSchema.parse({
    locale,
    items: [{ label: "Home", href: locale === "en" ? "/" : `/${locale}/`, children: [] }]
  });
}

async function readJson<T>(path: string, parser: { parse(value: unknown): T }): Promise<T> {
  const raw = await readFile(join(contentRoot, path), "utf8");
  return parser.parse(JSON.parse(raw));
}

async function listJson<T>(path: string, parser: { parse(value: unknown): T }): Promise<T[]> {
  const dir = join(contentRoot, path);
  const files = (await readdir(dir).catch(() => [])).filter((file) => file.endsWith(".json"));
  const results: T[] = [];
  for (const file of files) {
    try {
      results.push(await readJson(`${path}/${file}`, parser));
    } catch (e) {
      console.error(`Error parsing ${path}/${file}:`, e);
    }
  }
  return results;
}

export async function getSettings(): Promise<SiteSettings> {
  return readJson("settings/site.json", SiteSettingsSchema).catch(() => fallbackSettings);
}

export async function getCustomCss(): Promise<string> {
  return readFile(join(contentRoot, "styles/site-custom.css"), "utf8").catch(() => "");
}

export async function getStylesheets(): Promise<Array<{ key: string; css: string }>> {
  const stylesRoot = join(contentRoot, "styles");
  const files = await readdir(stylesRoot).catch(() => []);
  const cssFiles = files
    .filter((file) => file.endsWith(".css"))
    .sort((a, b) => {
      if (a === "site.css") return -1;
      if (b === "site.css") return 1;
      return a.localeCompare(b);
    });
  return Promise.all(cssFiles.map(async (file) => ({
    key: `styles/${file}`,
    css: await readFile(join(stylesRoot, file), "utf8")
  })));
}

export async function getNavigation(locale: Locale): Promise<Navigation> {
  return readJson(`navigation/${locale}/main.json`, NavigationSchema)
    .catch(() => readJson("navigation/en/main.json", NavigationSchema))
    .catch(() => fallbackNavigation(locale));
}

export async function getContentLocales(): Promise<Locale[]> {
  const pagesRoot = join(contentRoot, "pages");
  const locales = (await readdir(pagesRoot, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return locales.length ? locales : ["en"];
}

export async function getPages(locale?: Locale): Promise<Page[]> {
  const locales: Locale[] = locale ? [locale] : await getContentLocales();
  const pages = (await Promise.all(locales.map((item) => listJson(`pages/${item}`, PageSchema)))).flat();
  const publishedPages = pages.filter((page) => page.status === "published");
  if (publishedPages.length) return publishedPages;
  return locale && locale !== "en" ? [] : [fallbackHomePage];
}

export async function getPage(locale: Locale, slug: string): Promise<Page | undefined> {
  const pages = await getPages(locale);
  return pages.find((page) => page.slug === slug);
}

export async function getEvents(): Promise<Event[]> {
  const events = await listJson("events", EventSchema);
  return events
    .filter((event) => event.status === "published")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function translatedValue(base: string | undefined, translated: string | undefined) {
  return translated?.trim() ? translated : base;
}

export async function getLocalizedEvents(locale: Locale): Promise<Event[]> {
  const events = await getEvents();
  if (locale === "en") return events;
  return events.map((event) => {
    const translation = event.translations?.[locale];
    return {
      ...event,
      title: translatedValue(event.title, translation?.title) ?? event.title,
      locationName: translatedValue(event.locationName, translation?.locationName),
      address: translatedValue(event.address, translation?.address),
      description: translatedValue(event.description, translation?.description) ?? event.description,
      notes: translatedValue(event.notes, translation?.notes)
    };
  });
}

export async function getGallery(locale: Locale): Promise<Gallery> {
  const gallery = await readJson("gallery/gallery-items.json", GallerySchema).catch(() => []);
  const publishedGallery = gallery.filter((item) => item.status === "published");
  if (locale === "en") return publishedGallery;
  return publishedGallery.map((item) => localizeMedia(item, locale));
}

export function localizeMedia<T extends MediaRef>(item: T, locale: Locale): T {
  if (locale === "en") return item;
  const translation = item.translations?.[locale];
  return {
    ...item,
    alt: translatedValue(item.alt, translation?.alt) ?? item.alt,
    caption: translatedValue(item.caption, translation?.caption),
    description: translatedValue(item.description, translation?.description)
  };
}

export async function getArticles(locale: Locale): Promise<Article[]> {
  const articles = await listJson(`articles/${locale}`, ArticleSchema).catch(() => []);
  return articles
    .filter((article) => article.status === "published")
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function findTranslations(current: Page): Promise<Page[]> {
  const pages = await getPages();
  return pages.filter((page) => page.translationKey === current.translationKey && page.locale !== current.locale);
}
