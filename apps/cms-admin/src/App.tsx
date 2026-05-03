import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { FONT_OPTIONS, fontSupportsLanguages, type FontId } from "@community-site-engine/shared/fonts";
import "./styles/app.css";

type Role = "admin" | "designer" | "contributor";
type Collection = "pages" | "articles" | "events" | "navigation" | "settings" | "gallery";
type Tab = "pages" | "menu" | "events" | "articles" | "gallery" | "css" | "settings" | "users" | "json" | "translations";
type BlockType = "hero" | "richText" | "cardGrid" | "gallery" | "eventList" | "articleList" | "cta";
type MediaFolder = "gallery" | "events" | "articles" | "settings";

interface CmsObject<T = unknown> {
  key: string;
  data: T;
}

interface MediaRef {
  src: string;
  alt: string;
  status?: "draft" | "published" | undefined;
  caption?: string | undefined;
  description?: string | undefined;
  translations?: Record<string, Partial<Pick<MediaRef, "alt" | "caption" | "description">>> | undefined;
}

interface Link {
  label: string;
  href: string;
  variant: "primary" | "secondary" | "plain";
}

interface NavigationItem {
  label: string;
  href: string;
  children: NavigationItem[];
}

interface Navigation {
  locale: string;
  items: NavigationItem[];
}

interface MenuRow {
  id: string;
  label: string;
  href: string;
  parentId: string;
  sort: number;
}

interface PageBlock {
  type: BlockType;
  title?: string | undefined;
  body?: string | undefined;
  customCss?: string | undefined;
  layoutColumn?: string | undefined;
  eyebrow?: string | undefined;
  intro?: string | undefined;
  image?: MediaRef | undefined;
  actions?: Link[] | undefined;
  cards?: Array<{ title: string; body: string; image?: MediaRef | undefined; href?: string | undefined }> | undefined;
  items?: MediaRef[] | undefined;
  eventIds?: string[] | undefined;
  articleIds?: string[] | undefined;
}

interface Page {
  id: string;
  locale: string;
  status: "draft" | "published";
  title: string;
  slug: string;
  translationKey: string;
  seo: { title: string; description: string };
  layout?: PageLayout | undefined;
  blocks: PageBlock[];
}

interface PageLayout {
  columns: PageLayoutColumn[];
}

interface PageLayoutColumn {
  id: string;
  label: string;
  width: number;
}

interface Article {
  id: string;
  locale: string;
  status: "draft" | "published";
  title: string;
  slug: string;
  date: string;
  category: string;
  excerpt: string;
  featuredImage?: MediaRef | undefined;
  body: string;
  seo: { title: string; description: string };
}

interface EventItem {
  id: string;
  status: "draft" | "published";
  title: string;
  slug: string;
  startsAt: string;
  endsAt?: string | undefined;
  locationName?: string | undefined;
  address?: string | undefined;
  image?: MediaRef | undefined;
  description: string;
  notes?: string | undefined;
  translations?: Record<string, Partial<Pick<EventItem, "title" | "locationName" | "address" | "description" | "notes">>> | undefined;
}

interface UserInfo {
  id: string;
  name: string;
  role: Role;
}

interface ManagedUser {
  id: string;
  name: string;
  role: Role;
  email?: string;
  token?: string;
  enabled?: boolean;
  status?: string;
}

interface CssFile {
  key: string;
  name: string;
  css: string;
}

interface SiteSettings {
  name: string;
  tagline: string;
  description: string;
  siteIcon?: MediaRef | undefined;
  defaultLocale: string;
  supportedLanguages: LanguageOption[];
  locales?: string[];
  eventTimeZone: string;
  fonts: {
    default: FontId;
    page?: FontId | undefined;
    headings?: FontId | undefined;
    navigation?: FontId | undefined;
    event?: FontId | undefined;
    article?: FontId | undefined;
    gallery?: FontId | undefined;
    card?: FontId | undefined;
    cta?: FontId | undefined;
  };
  contactEmail: string;
  social: Link[];
}

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

const TOP_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "bg", name: "Bulgarian", nativeName: "Български" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "fa", name: "Persian", nativeName: "فارسی" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "ro", name: "Romanian", nativeName: "Română" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar" },
  { code: "cs", name: "Czech", nativeName: "Čeština" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "he", name: "Hebrew", nativeName: "עברית" },
  { code: "sr", name: "Serbian", nativeName: "Српски" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina" },
  { code: "da", name: "Danish", nativeName: "Dansk" },
  { code: "fi", name: "Finnish", nativeName: "Suomi" },
  { code: "no", name: "Norwegian", nativeName: "Norsk" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu" },
  { code: "et", name: "Estonian", nativeName: "Eesti" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "fil", name: "Filipino", nativeName: "Filipino" },
  { code: "jv", name: "Javanese", nativeName: "Basa Jawa" },
  { code: "su", name: "Sundanese", nativeName: "Basa Sunda" },
  { code: "ha", name: "Hausa", nativeName: "Hausa" },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá" },
  { code: "ig", name: "Igbo", nativeName: "Igbo" },
  { code: "am", name: "Amharic", nativeName: "አማርኛ" },
  { code: "om", name: "Oromo", nativeName: "Afaan Oromoo" },
  { code: "so", name: "Somali", nativeName: "Soomaali" },
  { code: "zu", name: "Zulu", nativeName: "IsiZulu" },
  { code: "xh", name: "Xhosa", nativeName: "IsiXhosa" },
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans" },
  { code: "sq", name: "Albanian", nativeName: "Shqip" },
  { code: "hy", name: "Armenian", nativeName: "Հայերեն" },
  { code: "az", name: "Azerbaijani", nativeName: "Azərbaycanca" },
  { code: "ka", name: "Georgian", nativeName: "ქართული" },
  { code: "kk", name: "Kazakh", nativeName: "Қазақша" },
  { code: "ky", name: "Kyrgyz", nativeName: "Кыргызча" },
  { code: "uz", name: "Uzbek", nativeName: "Oʻzbekcha" },
  { code: "mn", name: "Mongolian", nativeName: "Монгол" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली" },
  { code: "si", name: "Sinhala", nativeName: "සිංහල" },
  { code: "my", name: "Burmese", nativeName: "မြန်မာ" },
  { code: "km", name: "Khmer", nativeName: "ខ្មែរ" },
  { code: "lo", name: "Lao", nativeName: "ລາວ" },
  { code: "mnw", name: "Mon", nativeName: "ဘာသာ မန်" },
  { code: "bo", name: "Tibetan", nativeName: "བོད་ཡིག" },
  { code: "ps", name: "Pashto", nativeName: "پښتو" },
  { code: "ku", name: "Kurdish", nativeName: "Kurdî" },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
  { code: "mai", name: "Maithili", nativeName: "मैथिली" },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्" },
  { code: "ti", name: "Tigrinya", nativeName: "ትግርኛ" },
  { code: "rw", name: "Kinyarwanda", nativeName: "Ikinyarwanda" },
  { code: "rn", name: "Kirundi", nativeName: "Ikirundi" },
  { code: "mg", name: "Malagasy", nativeName: "Malagasy" },
  { code: "ny", name: "Chichewa", nativeName: "Chichewa" },
  { code: "sn", name: "Shona", nativeName: "ChiShona" },
  { code: "st", name: "Southern Sotho", nativeName: "Sesotho" },
  { code: "tn", name: "Tswana", nativeName: "Setswana" },
  { code: "ts", name: "Tsonga", nativeName: "Tsonga" },
  { code: "ve", name: "Venda", nativeName: "Tshivenda" },
  { code: "is", name: "Icelandic", nativeName: "Íslenska" },
  { code: "ga", name: "Irish", nativeName: "Gaeilge" },
  { code: "cy", name: "Welsh", nativeName: "Cymraeg" },
  { code: "eu", name: "Basque", nativeName: "Euskara" },
  { code: "ca", name: "Catalan", nativeName: "Català" },
  { code: "gl", name: "Galician", nativeName: "Galego" },
  { code: "mt", name: "Maltese", nativeName: "Malti" },
  { code: "lb", name: "Luxembourgish", nativeName: "Lëtzebuergesch" },
  { code: "be", name: "Belarusian", nativeName: "Беларуская" }
];

function apiBase() {
  return import.meta.env.VITE_CMS_API_URL ?? "http://localhost:8787";
}

function cognitoConfig() {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN as string | undefined;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
  const redirectUri = (import.meta.env.VITE_COGNITO_REDIRECT_URI as string | undefined) || window.location.origin;
  return domain && clientId ? { domain: domain.replace(/\/$/, ""), clientId, redirectUri } : null;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

function randomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function startCognitoLogin() {
  const config = cognitoConfig();
  if (!config) return;
  const verifier = randomBase64Url(64);
  const state = randomBase64Url(32);
  sessionStorage.setItem("community-site-engine-pkce-verifier", verifier);
  sessionStorage.setItem("community-site-engine-oauth-state", state);
  const challenge = base64UrlEncode(await sha256(verifier));
  const params = new URLSearchParams({
    client_id: config.clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state
  });
  window.location.assign(`${config.domain}/oauth2/authorize?${params.toString()}`);
}

async function exchangeCognitoCode(code: string) {
  const config = cognitoConfig();
  const verifier = sessionStorage.getItem("community-site-engine-pkce-verifier");
  if (!config || !verifier) throw new Error("Missing Cognito login session. Please sign in again.");
  const response = await fetch(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri
    })
  });
  const result = await response.json() as { id_token?: string; error?: string; error_description?: string };
  if (!response.ok || !result.id_token) {
    throw new Error(result.error_description ?? result.error ?? "Cognito token exchange failed");
  }
  sessionStorage.removeItem("community-site-engine-pkce-verifier");
  sessionStorage.removeItem("community-site-engine-oauth-state");
  return result.id_token;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pageHref(page: Page) {
  if (page.locale === "en") return page.slug ? `/${page.slug}/` : "/";
  return page.slug ? `/${page.locale}/${page.slug}/` : `/${page.locale}/`;
}

function flattenNavigationItems(items: NavigationItem[], parentId = "", rows: MenuRow[] = []) {
  items.forEach((item, index) => {
    const id = crypto.randomUUID();
    rows.push({
      id,
      parentId,
      sort: index,
      label: item.label,
      href: item.href
    });
    flattenNavigationItems(item.children ?? [], id, rows);
  });
  return rows;
}

function buildNavigationItems(rows: MenuRow[], parentId = ""): NavigationItem[] {
  return rows
    .filter((row) => row.parentId === parentId)
    .sort((a, b) => a.sort - b.sort)
    .map((row) => ({
      label: row.label,
      href: row.href,
      children: buildNavigationItems(rows, row.id)
    }));
}

function orderedMenuRows(rows: MenuRow[], parentId = "", depth = 0): Array<MenuRow & { depth: number }> {
  return rows
    .filter((row) => row.parentId === parentId)
    .sort((a, b) => a.sort - b.sort)
    .flatMap((row) => [{ ...row, depth }, ...orderedMenuRows(rows, row.id, depth + 1)]);
}

function normalizeMenuSort(rows: MenuRow[]) {
  const next = rows.map((row) => ({ ...row }));
  const parentIds = new Set(["", ...next.map((row) => row.parentId)]);
  for (const parentId of parentIds) {
    next
      .filter((row) => row.parentId === parentId)
      .sort((a, b) => a.sort - b.sort)
      .forEach((row, index) => {
        row.sort = index;
      });
  }
  return next;
}

function menuDepth(rows: MenuRow[], id: string): number {
  let depth = 0;
  let current = rows.find((row) => row.id === id);
  while (current?.parentId) {
    depth += 1;
    current = rows.find((row) => row.id === current?.parentId);
  }
  return depth;
}

function wouldCreateMenuCycle(rows: MenuRow[], id: string, parentId: string) {
  let current = rows.find((row) => row.id === parentId);
  while (current) {
    if (current.id === id) return true;
    current = rows.find((row) => row.id === current?.parentId);
  }
  return false;
}

function canStructure(role: Role | undefined) {
  return role === "admin" || role === "designer";
}

function canSettings(role: Role | undefined) {
  return role === "admin";
}

function cssObjectPath(key: string) {
  return `/api/css/object/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function zonedParts(value: string | Date, timeZone: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    hour: Number(part("hour")),
    minute: Number(part("minute"))
  };
}

function offsetMinutesForInstant(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  if (!parts) return 0;
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((zonedAsUtc - date.getTime()) / 60000);
}

function formatOffset(minutes: number) {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const mins = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${mins}`;
}

function zonedDateTimeFields(value: string | undefined, timeZone: string) {
  if (!value) return { date: "", time: "" };
  const parts = zonedParts(value, timeZone);
  if (!parts) {
    const [date = "", rawTime = ""] = value.split("T");
    return { date, time: rawTime.slice(0, 5) };
  }
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
  };
}

function zonedInputToIso(dateValue: string, timeValue: string, timeZone: string) {
  if (!dateValue) return "";
  const dateParts = dateValue.split("-").map(Number);
  const timeParts = (timeValue || "00:00").split(":").map(Number);
  const year = dateParts[0] ?? 1970;
  const month = dateParts[1] ?? 1;
  const day = dateParts[2] ?? 1;
  const hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;
  let offset = offsetMinutesForInstant(new Date(Date.UTC(year, month - 1, day, hour, minute)), timeZone);
  offset = offsetMinutesForInstant(new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60000), timeZone);
  return `${dateValue}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${formatOffset(offset)}`;
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) }
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(JSON.stringify(parsed));
  return parsed as T;
}

function TextField(props: { label: string; value: string | undefined; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input value={props.value ?? ""} onChange={(event) => props.onChange(event.target.value)} disabled={props.disabled} />
    </label>
  );
}

function TextArea(props: { label: string; value: string | undefined; onChange: (value: string) => void; rows?: number; hint?: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.hint && <small>{props.hint}</small>}
      <textarea rows={props.rows ?? 5} value={props.value ?? ""} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function DateTimeField(props: { label: string; value: string | undefined; timeZone: string; onChange: (value: string | undefined) => void; optional?: boolean }) {
  const fields = zonedDateTimeFields(props.value, props.timeZone);
  const update = (date: string, time: string) => {
    if (!date && props.optional) {
      props.onChange(undefined);
      return;
    }
    props.onChange(zonedInputToIso(date, time, props.timeZone));
  };
  return (
    <div className="dateTimeField">
      <div>
        <strong>{props.label}</strong>
        <small>Stored and displayed in {props.timeZone}</small>
      </div>
      <label className="field">
        <span>Date</span>
        <input type="date" value={fields.date} onChange={(event) => update(event.target.value, fields.time)} />
      </label>
      <label className="field">
        <span>Time</span>
        <input type="time" value={fields.time} onChange={(event) => update(fields.date, event.target.value)} />
      </label>
      {props.optional && <button type="button" className="danger small" onClick={() => props.onChange(undefined)}>Clear</button>}
    </div>
  );
}

function CssField(props: { value: string | undefined; onChange: (value: string) => void }) {
  return (
    <TextArea
      label="Custom CSS for this section"
      rows={5}
      hint="Admin/Designer only. Use declarations only, for example: background: #fff7ec; border-radius: 24px; No selectors or braces."
      value={props.value}
      onChange={props.onChange}
    />
  );
}

const DEFAULT_PAGE_COLUMNS: PageLayoutColumn[] = [
  { id: "main", label: "Main", width: 100 }
];

const COLUMN_PRESETS: Record<number, PageLayoutColumn[]> = {
  1: [{ id: "main", label: "Main", width: 100 }],
  2: [
    { id: "main", label: "Left", width: 50 },
    { id: "side", label: "Right", width: 50 }
  ],
  3: [
    { id: "main", label: "Left", width: 34 },
    { id: "middle", label: "Middle", width: 33 },
    { id: "side", label: "Right", width: 33 }
  ]
};

function pageLayout(page: Page): PageLayout {
  const columns = page.layout?.columns?.length ? page.layout.columns : DEFAULT_PAGE_COLUMNS;
  return { columns: columns.slice(0, 3).map((column, index) => ({
    id: column.id || COLUMN_PRESETS[3]?.[index]?.id || `column-${index + 1}`,
    label: column.label || `Column ${index + 1}`,
    width: Math.min(100, Math.max(1, Math.round(Number(column.width) || 1)))
  })) };
}

function columnForBlock(block: PageBlock, layout: PageLayout) {
  return block.layoutColumn && layout.columns.some((column) => column.id === block.layoutColumn)
    ? block.layoutColumn
    : layout.columns[0]?.id ?? "main";
}

function makeLayout(columnCount: number, previous?: PageLayout): PageLayout {
  const preset = COLUMN_PRESETS[columnCount] ?? COLUMN_PRESETS[1] ?? DEFAULT_PAGE_COLUMNS;
  return {
    columns: preset.map((column, index) => {
      const existing = previous?.columns[index];
      return {
        ...column,
        label: existing?.label || column.label,
        width: existing?.width ?? column.width
      };
    })
  };
}

function moveBlock(blocks: PageBlock[], fromIndex: number, toIndex: number, layoutColumn: string) {
  if (fromIndex < 0 || fromIndex >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return blocks;
  next.splice(Math.min(Math.max(toIndex, 0), next.length), 0, { ...moved, layoutColumn });
  return next;
}

function ImageField(props: { label: string; value: MediaRef | undefined; onChange: (value: MediaRef | undefined) => void; onUpload: (folder: MediaFolder) => Promise<MediaRef | null>; folder: MediaFolder }) {
  return (
    <div className="imageField">
      <div>
        <strong>{props.label}</strong>
        <TextField label="Image URL" value={props.value?.src} onChange={(src) => props.onChange(src ? { src, alt: props.value?.alt ?? "" } : undefined)} />
        <TextField label="Alt text" value={props.value?.alt} onChange={(alt) => props.onChange(props.value?.src ? { ...props.value, alt } : undefined)} />
      </div>
      <div className="imagePreview">
        {props.value?.src ? <img src={props.value.src} alt={props.value.alt} /> : <span>No image</span>}
        <button type="button" onClick={async () => {
          const media = await props.onUpload(props.folder);
          if (media) props.onChange(media);
        }}>Upload Image</button>
      </div>
    </div>
  );
}

function BlockEditor(props: { block: PageBlock; disabledStructure: boolean; update: (block: PageBlock) => void; remove: () => void; onUpload: (folder: MediaFolder) => Promise<MediaRef | null> }) {
  const block = props.block;
  return (
    <section className="builderCard blockCard">
      <header className="blockHeader">
        <strong>{block.type}</strong>
        {!props.disabledStructure && <button className="danger small" onClick={props.remove}>Remove Section</button>}
      </header>

      {(block.type === "hero" || block.type === "richText" || block.type === "cardGrid" || block.type === "gallery" || block.type === "eventList" || block.type === "articleList" || block.type === "cta") && (
        <TextField label="Section title" value={block.title} onChange={(title) => props.update({ ...block, title })} />
      )}

      {block.type === "hero" && (
        <>
          <TextField label="Eyebrow" value={block.eyebrow} onChange={(eyebrow) => props.update({ ...block, eyebrow })} />
          <TextArea label="Intro text" value={block.body} onChange={(body) => props.update({ ...block, body })} />
          <ImageField label="Hero image" value={block.image} onChange={(image) => props.update({ ...block, image })} onUpload={props.onUpload} folder="gallery" />
        </>
      )}

      {block.type === "richText" && (
        <TextArea label="Markdown content" hint="Supports plain Markdown text. Keep headings short and use blank lines between paragraphs." rows={10} value={block.body} onChange={(body) => props.update({ ...block, body })} />
      )}

      {(block.type === "cardGrid") && (
        <>
          <TextArea label="Intro" value={block.intro} onChange={(intro) => props.update({ ...block, intro })} />
          {(block.cards ?? []).map((card, index) => (
            <div className="nested" key={index}>
              <TextField label="Card title" value={card.title} onChange={(title) => {
                const cards = [...(block.cards ?? [])];
                cards[index] = { ...card, title };
                props.update({ ...block, cards });
              }} />
              <TextArea label="Card text" value={card.body} onChange={(body) => {
                const cards = [...(block.cards ?? [])];
                cards[index] = { ...card, body };
                props.update({ ...block, cards });
              }} />
              {!props.disabledStructure && <button className="danger small" onClick={() => props.update({ ...block, cards: (block.cards ?? []).filter((_, itemIndex) => itemIndex !== index) })}>Remove Card</button>}
            </div>
          ))}
          {!props.disabledStructure && <button onClick={() => props.update({ ...block, cards: [...(block.cards ?? []), { title: "New card", body: "Card text" }] })}>Add Card</button>}
        </>
      )}

      {block.type === "gallery" && (
        <>
          <TextArea label="Intro" value={block.intro} onChange={(intro) => props.update({ ...block, intro })} />
          <p className="muted">Gallery page images are easiest to manage from the Gallery tab.</p>
        </>
      )}

      {(block.type === "eventList" || block.type === "articleList") && (
        <TextArea label={block.type === "eventList" ? "Event IDs, one per line" : "Article IDs, one per line"} value={(block.type === "eventList" ? block.eventIds : block.articleIds)?.join("\n") ?? ""} onChange={(value) => {
          const ids = value.split("\n").map((item) => item.trim()).filter(Boolean);
          props.update(block.type === "eventList" ? { ...block, eventIds: ids } : { ...block, articleIds: ids });
        }} />
      )}

      {block.type === "cta" && (
        <TextArea label="CTA body" value={block.body} onChange={(body) => props.update({ ...block, body })} />
      )}

      {!props.disabledStructure && (
        <CssField value={block.customCss} onChange={(customCss) => props.update({ ...block, customCss })} />
      )}
    </section>
  );
}

function TranslationsEditor(props: { token: string; onUpdate: () => void }) {
  const [allPages, setAllPages] = useState<CmsObject<Page>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllPages = async () => {
    setLoading(true);
    try {
      const data = await request<CmsObject<Page>[]>(props.token, "/api/list/pages");
      setAllPages(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllPages();
  }, [props.token]);

  const groups = useMemo(() => {
    const map = new Map<string, CmsObject<Page>[]>();
    for (const page of allPages) {
      const key = page.data.translationKey || "unlinked";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(page);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allPages]);

  const existingKeys = useMemo(() => Array.from(new Set(allPages.map(p => p.data.translationKey).filter(Boolean))), [allPages]);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newKeyVal, setNewKeyVal] = useState("");

  const handleUpdate = async (page: CmsObject<Page>, newKey: string) => {
    if (!newKey || newKey === page.data.translationKey) return;
    try {
      await request(props.token, `/api/object/${page.key}`, {
        method: "PUT",
        body: JSON.stringify({ ...page.data, translationKey: newKey })
      });
      await fetchAllPages();
      props.onUpdate();
    } catch (e) {
      alert("Failed to update: " + String(e));
    }
  };

  if (loading) return <div className="editor builder wideEditor" style={{ padding: "2rem" }}><p>Loading pages...</p></div>;

  return (
    <div className="editor builder wideEditor" style={{ padding: "2rem", overflowY: "auto" }}>
      <header className="editorHeader">
        <h2>Manage Page Translations</h2>
      </header>
      <div className="builderCard">
        <p className="muted">Pages with the same Translation Key are linked together. When you modify the layout of a page, it automatically synchronizes to all other pages with the same key.</p>
        
        {groups.map(([translationKey, groupPages]) => (
          <div key={translationKey} style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem" }}>
            <h3 style={{ marginTop: 0, fontSize: "1.1rem" }}>Key: <code>{translationKey}</code></h3>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Locale</th>
                  <th style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Title</th>
                  <th style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Slug</th>
                  <th style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Translation Key</th>
                </tr>
              </thead>
              <tbody>
                {groupPages.map(page => (
                  <tr key={page.key}>
                    <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}><strong>{page.data.locale.toUpperCase()}</strong></td>
                    <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{page.data.title}</td>
                    <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{page.data.slug}</td>
                    <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                      {editingKey === page.key ? (
                        <input 
                          autoFocus
                          value={newKeyVal} 
                          onChange={e => setNewKeyVal(e.target.value)} 
                          onBlur={() => { void handleUpdate(page, newKeyVal); setEditingKey(null); }}
                          onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingKey(null); }}
                          placeholder="New key..."
                        />
                      ) : (
                        <select 
                          value={page.data.translationKey || ""} 
                          onChange={e => {
                            if (e.target.value === "__NEW__") {
                              setNewKeyVal("");
                              setEditingKey(page.key);
                            } else {
                              void handleUpdate(page, e.target.value);
                            }
                          }}
                        >
                          <option value="" disabled>Select key...</option>
                          {existingKeys.map(k => <option key={k} value={k}>{k}</option>)}
                          <option value="__NEW__">+ Create new key...</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("community-site-engine-token") ?? (import.meta.env.DEV ? "dev-admin-token" : ""));
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("pages");
  const [locale, setLocale] = useState("en");
  const [message, setMessage] = useState("");
  const [pages, setPages] = useState<CmsObject<Page>[]>([]);
  const [events, setEvents] = useState<CmsObject<EventItem>[]>([]);
  const [articles, setArticles] = useState<CmsObject<Article>[]>([]);
  const [gallery, setGallery] = useState<CmsObject<MediaRef[]> | null>(null);
  const [settings, setSettings] = useState<CmsObject<SiteSettings> | null>(null);
  const [navigation, setNavigation] = useState<CmsObject<Navigation> | null>(null);
  const [menuRows, setMenuRows] = useState<MenuRow[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const [eventItem, setEventItem] = useState<EventItem | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [jsonCollection, setJsonCollection] = useState<Collection>("pages");
  const [jsonItems, setJsonItems] = useState<CmsObject[]>([]);
  const [jsonValue, setJsonValue] = useState("");
  const [cssFiles, setCssFiles] = useState<CssFile[]>([]);
  const [selectedCssKey, setSelectedCssKey] = useState("");
  const [cssDraft, setCssDraft] = useState<CssFile | null>(null);
  const [facebookImportUrl, setFacebookImportUrl] = useState("");
  const [facebookImporting, setFacebookImporting] = useState(false);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [userSource, setUserSource] = useState("local");
  const [userDraft, setUserDraft] = useState<ManagedUser & { temporaryPassword?: string; suppressEmail?: boolean }>({
    id: "",
    name: "",
    role: "contributor",
    email: "",
    temporaryPassword: "",
    suppressEmail: false
  });
  const [passwordResetDraft, setPasswordResetDraft] = useState<{ id: string; password: string; permanent: boolean }>({
    id: "",
    password: "",
    permanent: false
  });
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const role = user?.role;
  const structureAllowed = canStructure(role);
  const hasCognitoLogin = Boolean(cognitoConfig());
  const currentPageLayout = page ? pageLayout(page) : null;
  const pageLayoutTotal = currentPageLayout?.columns.reduce((sum, column) => sum + column.width, 0) ?? 100;

  async function refresh(activeToken = token) {
    try {
      const me = await request<UserInfo>(activeToken, "/api/me");
      setUser(me);
      const [loadedPages, loadedEvents, loadedArticles, loadedGallery, loadedSettings, loadedNavigation] = await Promise.all([
        request<CmsObject<Page>[]>(activeToken, `/api/list/pages?locale=${locale}`),
        request<CmsObject<EventItem>[]>(activeToken, "/api/list/events"),
        request<CmsObject<Article>[]>(activeToken, `/api/list/articles?locale=${locale}`),
        request<CmsObject<MediaRef[]>[]>(activeToken, "/api/list/gallery"),
        request<CmsObject<SiteSettings>[]>(activeToken, "/api/list/settings"),
        request<CmsObject<Navigation>[]>(activeToken, `/api/list/navigation?locale=${locale}`)
      ]);
      setPages(loadedPages);
      setEvents(loadedEvents);
      setArticles(loadedArticles);
      setGallery(loadedGallery.find((item) => item.key === "gallery/gallery-items.json") ?? loadedGallery[0] ?? null);
      const siteSettings = loadedSettings.find((item) => item.key === "settings/site.json") ?? null;
      setSettings(siteSettings);
      const menu = loadedNavigation.find((item) => item.key === `navigation/${locale}/main.json`) ?? loadedNavigation[0] ?? null;
      setNavigation(menu ?? { key: `navigation/${locale}/main.json`, data: { locale, items: [] } });
      setMenuRows(flattenNavigationItems(menu?.data.items ?? []));
      if (siteSettings && !siteSettings.data.supportedLanguages.some((language) => language.code === locale)) {
        setLocale(siteSettings.data.defaultLocale);
      }
      setMessage(`Signed in as ${me.name} (${me.role})`);
    } catch (error) {
      setUser(null);
      setMessage(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleCognitoCallback() {
    const config = cognitoConfig();
    if (!config) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const expectedState = sessionStorage.getItem("community-site-engine-oauth-state");
    if (!code) return;
    setAuthBusy(true);
    try {
      if (!state || state !== expectedState) throw new Error("Cognito login state did not match. Please sign in again.");
      const idToken = await exchangeCognitoCode(code);
      setToken(idToken);
      localStorage.setItem("community-site-engine-token", idToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      await refresh(idToken);
    } catch (error) {
      setUser(null);
      setMessage(`Cognito login failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAuthBusy(false);
    }
  }

  function signOut() {
    const config = cognitoConfig();
    localStorage.removeItem("community-site-engine-token");
    sessionStorage.removeItem("community-site-engine-pkce-verifier");
    sessionStorage.removeItem("community-site-engine-oauth-state");
    setToken("");
    setUser(null);
    if (config) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        logout_uri: config.redirectUri
      });
      window.location.assign(`${config.domain}/logout?${params.toString()}`);
    }
  }

  useEffect(() => {
    localStorage.setItem("community-site-engine-token", token);
  }, [token]);

  useEffect(() => {
    void handleCognitoCallback();
  }, []);

  useEffect(() => {
    void refresh();
  }, [locale]);

  useEffect(() => {
    if (tab === "json" && user?.role === "admin") {
      void loadJsonItems(jsonCollection);
    }
  }, [tab, jsonCollection, user?.role]);

  useEffect(() => {
    if (tab === "css" && (user?.role === "admin" || user?.role === "designer")) {
      void loadCss();
    }
    if (tab === "users" && user?.role === "admin") {
      void loadUsers();
    }
  }, [tab, user?.role]);

  async function loadJsonItems(collection: Collection) {
    try {
      const items = await request<CmsObject[]>(token, `/api/list/${collection}`);
      setJsonItems(items);
      if (!items.some((item) => item.key === selectedKey)) {
        const first = items[0];
        setSelectedKey(first?.key ?? "");
        setJsonValue(first ? JSON.stringify(first.data, null, 2) : "");
      }
    } catch (error) {
      setJsonItems([]);
      setMessage(`Could not load JSON files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function loadCss() {
    try {
      const result = await request<CssFile[]>(token, "/api/css/list");
      setCssFiles(result);
      if (!selectedCssKey && result[0]) {
        setSelectedCssKey(result[0].key);
        setCssDraft(result[0]);
      } else if (selectedCssKey) {
        const selected = result.find((item) => item.key === selectedCssKey);
        if (selected) setCssDraft(selected);
      }
    } catch (error) {
      setMessage(`Could not load CSS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function saveCss() {
    if (!cssDraft) return;
    try {
      await request(token, "/api/css/validate", { method: "POST", body: JSON.stringify({ css: cssDraft.css }) });
      const saved = await request<CssFile>(token, cssObjectPath(cssDraft.key), { method: "PUT", body: JSON.stringify({ css: cssDraft.css }) });
      setCssDraft(saved);
      setSelectedCssKey(saved.key);
      const buildMessage = await triggerSiteBuildMessage();
      setMessage(`Validated and saved ${saved.key}.${buildMessage}`);
      await loadCss();
    } catch (error) {
      setMessage(`CSS validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function selectCssFile(key: string) {
    setSelectedCssKey(key);
    const existing = cssFiles.find((item) => item.key === key);
    if (existing) {
      setCssDraft(existing);
      return;
    }
    const loaded = await request<CssFile>(token, cssObjectPath(key));
    setCssDraft(loaded);
  }

  function newCssFile() {
    const name = "new-section.css";
    const key = `styles/${name}`;
    setSelectedCssKey(key);
    setCssDraft({
      key,
      name,
      css: "/* New live-site CSS file. */\n"
    });
  }

  async function loadUsers() {
    try {
      const result = await request<{ source: string; users: ManagedUser[] }>(token, "/api/users");
      setUserSource(result.source);
      setManagedUsers(result.users);
    } catch (error) {
      setMessage(`Could not load users: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function saveManagedUser() {
    try {
      const normalizedId = userSource === "cognito" ? (userDraft.email || userDraft.id) : userDraft.id;
      const payload = {
        ...userDraft,
        id: normalizedId,
        email: userDraft.email || undefined,
        temporaryPassword: userDraft.temporaryPassword || undefined
      };
      await request(token, `/api/users/${encodeURIComponent(normalizedId)}`, { method: "PUT", body: JSON.stringify(payload) });
      setMessage(`Saved user ${normalizedId}`);
      setUserDraft({ id: "", name: "", role: "contributor", email: "", temporaryPassword: "", suppressEmail: false });
      await loadUsers();
    } catch (error) {
      setMessage(`Could not save user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function deleteManagedUser(id: string) {
    if (!confirm(`Delete user ${id}?`)) return;
    try {
      await request(token, `/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
      setMessage(`Deleted user ${id}`);
      await loadUsers();
    } catch (error) {
      setMessage(`Could not delete user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function resetManagedUserPassword() {
    if (!passwordResetDraft.id) return;
    try {
      const result = await request<{ source: string; password?: string; token?: string; temporary?: boolean; permanent?: boolean; generated?: boolean }>(
        token,
        `/api/users/${encodeURIComponent(passwordResetDraft.id)}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({
            password: passwordResetDraft.password || undefined,
            permanent: passwordResetDraft.permanent
          })
        }
      );
      setMessage(`Reset ${passwordResetDraft.id} ${result.source === "local" ? "local credential" : "password"} as ${result.temporary ? "temporary" : "permanent"}.`);
      setPasswordResetDraft({ id: "", password: "", permanent: false });
      await loadUsers();
    } catch (error) {
      setMessage(`Could not reset password: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function sendManagedUserLoginEmail(id: string) {
    try {
      const result = await request<{ message: string }>(token, `/api/users/${encodeURIComponent(id)}/send-login-email`, { method: "POST" });
      setMessage(result.message);
    } catch (error) {
      setMessage(`Could not send login email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function uploadMedia(folder: MediaFolder): Promise<MediaRef | null> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
    if (!file) return null;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const result = await request<{ src: string; alt: string }>(token, "/api/media", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, contentType: file.type, base64, folder })
    });
    setMessage(`Uploaded ${file.name}`);
    return result;
  }

  async function triggerSiteBuildMessage() {
    try {
      const result = await request<{ ok: boolean; message?: string; status?: number }>(token, "/api/build-webhook", { method: "POST" });
      if (result.ok) return " Site rebuild triggered.";
      if (result.message) return ` ${result.message}.`;
      return " Site rebuild requested.";
    } catch (error) {
      return ` Saved, but site rebuild trigger failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async function savePage() {
    if (!page || !selectedKey) return;
    const result = await request<{ created?: CmsObject<Page>[] }>(token, structureAllowed ? `/api/object/pages/${selectedKey}` : `/api/page-content/${selectedKey}`, {
      method: "PUT",
      body: JSON.stringify(page)
    });
    const createdCount = result.created?.length ?? 0;
    const buildMessage = await triggerSiteBuildMessage();
    setMessage(`${createdCount > 0 ? `Saved ${selectedKey} and created ${createdCount} language version${createdCount === 1 ? "" : "s"}` : `Saved ${selectedKey}`}.${buildMessage}`);
    await refresh();
  }

  async function createMultilingualPage(basePage: Page) {
    const result = await request<{ created: CmsObject<Page>[] }>(token, "/api/create-multilingual-page", {
      method: "POST",
      body: JSON.stringify({ basePage })
    });
    const buildMessage = await triggerSiteBuildMessage();
    setMessage(`Created ${result.created.length} language versions for ${basePage.title}.${buildMessage}`);
    await refresh();
    const current = result.created.find((item) => item.data.locale === locale) ?? result.created[0];
    if (current) selectPage(current);
  }

  async function saveEvent() {
    if (!eventItem) return;
    const key = selectedKey || `events/${eventItem.slug}.json`;
    const startFields = zonedDateTimeFields(eventItem.startsAt, defaultEventTimeZone);
    const endFields = zonedDateTimeFields(eventItem.endsAt, defaultEventTimeZone);
    const normalizedEvent = {
      ...eventItem,
      startsAt: zonedInputToIso(startFields.date, startFields.time, defaultEventTimeZone),
      endsAt: endFields.date ? zonedInputToIso(endFields.date, endFields.time, defaultEventTimeZone) : undefined
    };
    await request(token, `/api/object/events/${key}`, { method: "PUT", body: JSON.stringify(normalizedEvent) });
    setEventItem(normalizedEvent);
    setSelectedKey(key);
    const buildMessage = await triggerSiteBuildMessage();
    setMessage(`Saved ${key}.${buildMessage}`);
    await refresh();
  }

  async function importFacebookEvent() {
    if (!facebookImportUrl.trim()) {
      setMessage("Paste a public Facebook event link before importing.");
      return;
    }
    setFacebookImporting(true);
    try {
      const result = await request<{ event: EventItem }>(token, "/api/import/facebook-event", {
        method: "POST",
        body: JSON.stringify({ url: facebookImportUrl.trim(), timeZone: defaultEventTimeZone })
      });
      setSelectedKey("");
      setEventItem(result.event);
      setMessage("Imported Facebook event as an unsaved draft. Review it, then click Save Event.");
    } catch (error) {
      setMessage(`Facebook import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setFacebookImporting(false);
    }
  }

  async function saveArticle() {
    if (!article) return;
    const key = selectedKey || `articles/${article.locale}/${article.slug}.json`;
    const result = await request<{ created?: CmsObject<Article>[] }>(token, `/api/object/articles/${key}`, { method: "PUT", body: JSON.stringify(article) });
    setSelectedKey(key);
    const createdCount = result.created?.length ?? 0;
    const buildMessage = await triggerSiteBuildMessage();
    setMessage(`${createdCount > 0 ? `Saved ${key} and created ${createdCount} language version${createdCount === 1 ? "" : "s"}` : `Saved ${key}`}.${buildMessage}`);
    await refresh();
  }

  async function deleteObject(collection: Collection, key: string) {
    if (!confirm(`Delete ${key}?`)) return;
    await request(token, `/api/object/${collection}/${key}`, { method: "DELETE" });
    setSelectedKey("");
    setPage(null);
    setEventItem(null);
    setArticle(null);
    const buildMessage = await triggerSiteBuildMessage();
    setMessage(`Deleted ${key}.${buildMessage}`);
    await refresh();
  }

  async function saveGallery(items: MediaRef[]) {
    const key = gallery?.key ?? "gallery/gallery-items.json";
    await request(token, `/api/object/gallery/${key}`, { method: "PUT", body: JSON.stringify(items) });
    setGallery({ key, data: items });
    const buildMessage = await triggerSiteBuildMessage();
    setMessage(`Saved gallery.${buildMessage}`);
    await refresh();
  }

  async function deleteMediaFromStorage(src: string) {
    const key = src.replace(/^\//, "");
    if (!key.startsWith("media/")) return;
    await request(token, `/api/media/${key}`, { method: "DELETE" });
  }

  async function saveSettings() {
    if (!settings) return;
    await request(token, `/api/object/settings/${settings.key}`, { method: "PUT", body: JSON.stringify(settings.data) });
    const buildMessage = await triggerSiteBuildMessage();
    setMessage(`Saved settings.${buildMessage}`);
    await refresh();
  }

  async function downloadBackup() {
    setBackupBusy(true);
    try {
      const response = await fetch(`${apiBase()}/api/backup`, { headers: authHeaders(token) });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` })) as { message?: string };
        throw new Error(err.message ?? `HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        // Production mode: API returns a presigned S3 download URL
        const result = await response.json() as { ok: boolean; filename: string; size: number; downloadUrl: string };
        const a = document.createElement("a");
        a.href = result.downloadUrl;
        a.download = result.filename;
        a.click();
        setMessage(`Backup ready: ${result.filename} (${(result.size / 1024).toFixed(0)} KB)`);
      } else {
        // Local mode: API returns the ZIP inline
        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition") ?? "";
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
        const filename = filenameMatch?.[1] ?? `site-backup-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}.zip`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setMessage(`Downloaded backup: ${filename} (${(blob.size / 1024).toFixed(0)} KB)`);
      }
    } catch (error) {
      setMessage(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function uploadRestore() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip";
    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
    if (!file) return;
    if (!confirm(`Restore from "${file.name}"?\n\nThis will overwrite ALL current site content (pages, articles, events, gallery, settings, media, etc.) with the contents of this backup.\n\nA pre-restore snapshot will be saved automatically, but this operation cannot be easily undone.\n\nContinue?`)) return;
    setRestoreBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${apiBase()}/api/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const result = await response.json() as { ok?: boolean; restored?: number; snapshotPrefix?: string; message?: string };
      if (!response.ok) throw new Error(result.message ?? `HTTP ${response.status}`);
      setMessage(`Restored ${result.restored ?? 0} files from backup. Pre-restore snapshot saved to ${result.snapshotPrefix ?? "snapshots/"}.`);
      await refresh();
    } catch (error) {
      setMessage(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRestoreBusy(false);
    }
  }

  async function saveMenu() {
    if (!navigation) return;
    const normalizedRows = normalizeMenuSort(menuRows).filter((row) => row.label.trim() && row.href.trim());
    const data: Navigation = {
      locale,
      items: buildNavigationItems(normalizedRows)
    };
    const key = navigation.key || `navigation/${locale}/main.json`;
    await request(token, `/api/object/navigation/${key}`, { method: "PUT", body: JSON.stringify(data) });
    setNavigation({ key, data });
    setMenuRows(flattenNavigationItems(data.items));
    const buildMessage = await triggerSiteBuildMessage();
    setMessage(`Saved menu for ${workingLanguageName}.${buildMessage}`);
    await refresh();
  }

  function addMenuItem(pageItem?: Page) {
    const siblingCount = menuRows.filter((row) => row.parentId === "").length;
    setMenuRows([
      ...menuRows,
      {
        id: crypto.randomUUID(),
        label: pageItem?.title ?? "New menu item",
        href: pageItem ? pageHref(pageItem) : "/",
        parentId: "",
        sort: siblingCount
      }
    ]);
  }

  function updateMenuRow(id: string, changes: Partial<MenuRow>) {
    setMenuRows(normalizeMenuSort(menuRows.map((row) => {
      if (row.id !== id) return row;
      const nextParentId = changes.parentId ?? row.parentId;
      if (nextParentId !== row.parentId && wouldCreateMenuCycle(menuRows, id, nextParentId)) return row;
      return { ...row, ...changes };
    })));
  }

  function removeMenuRow(id: string) {
    if (!confirm("Remove this menu item and its child items?")) return;
    const removeIds = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of menuRows) {
        if (removeIds.has(row.parentId) && !removeIds.has(row.id)) {
          removeIds.add(row.id);
          changed = true;
        }
      }
    }
    setMenuRows(normalizeMenuSort(menuRows.filter((row) => !removeIds.has(row.id))));
  }

  function moveMenuRow(id: string, direction: -1 | 1) {
    const row = menuRows.find((item) => item.id === id);
    if (!row) return;
    const siblings = menuRows
      .filter((item) => item.parentId === row.parentId)
      .sort((a, b) => a.sort - b.sort);
    const index = siblings.findIndex((item) => item.id === id);
    const swap = siblings[index + direction];
    if (!swap) return;
    setMenuRows(menuRows.map((item) => {
      if (item.id === row.id) return { ...item, sort: swap.sort };
      if (item.id === swap.id) return { ...item, sort: row.sort };
      return item;
    }));
  }

  function addMenuChild(parentId: string) {
    const parent = menuRows.find((row) => row.id === parentId);
    const siblingCount = menuRows.filter((row) => row.parentId === parentId).length;
    setMenuRows([
      ...menuRows,
      {
        id: crypto.randomUUID(),
        label: "New child item",
        href: parent?.href ?? "/",
        parentId,
        sort: siblingCount
      }
    ]);
  }

  function selectPage(item: CmsObject<Page>) {
    setSelectedKey(item.key);
    setPage(structuredClone(item.data));
    setJsonCollection("pages");
    setJsonValue(JSON.stringify(item.data, null, 2));
  }

  function selectEvent(item: CmsObject<EventItem>) {
    setSelectedKey(item.key);
    setEventItem(structuredClone(item.data));
    setJsonCollection("events");
    setJsonValue(JSON.stringify(item.data, null, 2));
  }

  function selectArticle(item: CmsObject<Article>) {
    setSelectedKey(item.key);
    setArticle(structuredClone(item.data));
    setJsonCollection("articles");
    setJsonValue(JSON.stringify(item.data, null, 2));
  }

  async function selectJsonKey(key: string) {
    setSelectedKey(key);
    const existing = jsonItems.find((item) => item.key === key);
    if (existing) {
      setJsonValue(JSON.stringify(existing.data, null, 2));
      return;
    }
    const loaded = await request<CmsObject>(token, `/api/object/${key}`);
    setJsonValue(JSON.stringify(loaded.data, null, 2));
  }

  async function saveJson() {
    try {
      const parsed = JSON.parse(jsonValue);
      await request(token, `/api/validate/${jsonCollection}`, { method: "POST", body: JSON.stringify(parsed) });
      await request(token, `/api/object/${jsonCollection}/${selectedKey}`, { method: "PUT", body: JSON.stringify(parsed) });
      const buildMessage = await triggerSiteBuildMessage();
      setMessage(`Validated and saved ${selectedKey}.${buildMessage}`);
      await refresh();
      await loadJsonItems(jsonCollection);
    } catch (error) {
      setMessage(`JSON validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function newPage() {
    const title = "New Page";
    const slug = slugify(title);
    setSelectedKey(`pages/${locale}/${slug}.json`);
    setPage({
      id: slug,
      locale,
      status: "draft",
      title,
      slug,
      translationKey: slug,
      seo: { title, description: "New page description." },
      blocks: [{ type: "hero", title, body: "Intro text", actions: [] }]
    });
  }

  function newEvent() {
    setSelectedKey("");
    setEventItem({
      id: "new-event",
      status: "draft",
      title: "New Event",
      slug: "new-event",
      startsAt: new Date().toISOString(),
      description: "Event description."
    });
  }

  function newArticle() {
    setSelectedKey("");
    setArticle({
      id: "new-article",
      locale,
      status: "draft",
      title: "New Article",
      slug: "new-article",
      date: new Date().toISOString().slice(0, 10),
      category: "News & Articles",
      excerpt: "Short summary.",
      body: "Write the article in Markdown.",
      seo: { title: "New Article", description: "Article description." }
    });
  }

  const currentItems = useMemo(() => {
    if (tab === "pages") return pages;
    if (tab === "events") return events;
    if (tab === "articles") return articles;
    if (tab === "css") return cssFiles.map((item) => ({ key: item.key, data: item }));
    return [];
  }, [tab, pages, events, articles, cssFiles]);

  const visibleTabs: Tab[] = user?.role === "admin"
    ? ["events", "articles", "gallery", "pages", "menu", "settings", "users", "css", "json", "translations"]
    : user?.role === "designer"
      ? ["events", "articles", "gallery", "pages", "menu", "css"]
      : ["events", "articles", "gallery", "pages"];

  const timeZones = useMemo(() => {
    const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return supported.includes("America/Phoenix") ? supported : ["America/Phoenix", ...supported];
  }, []);

  const supportedLanguages = settings?.data.supportedLanguages?.length
    ? settings.data.supportedLanguages
    : TOP_LANGUAGES.filter((language) => language.code === "en" || language.code === "bg");
  const defaultEventTimeZone = settings?.data.eventTimeZone ?? "America/Phoenix";

  const compatibleFonts = useMemo(() => {
    const languageCodes = supportedLanguages.map((language) => language.code);
    return FONT_OPTIONS.filter((font) => fontSupportsLanguages(font.id, languageCodes));
  }, [supportedLanguages]);

  const workingLanguageName = supportedLanguages.find((language) => language.code === locale)?.name ?? locale;
  const menuDisplayRows = useMemo(() => orderedMenuRows(menuRows), [menuRows]);

  function eventText(field: "title" | "locationName" | "address" | "description" | "notes") {
    if (!eventItem) return "";
    if (locale === "en") return eventItem[field] ?? "";
    return eventItem.translations?.[locale]?.[field] || eventItem[field] || "";
  }

  function updateEventText(field: "title" | "locationName" | "address" | "description" | "notes", value: string) {
    if (!eventItem) return;
    if (locale === "en") {
      setEventItem({ ...eventItem, [field]: value });
      return;
    }
    setEventItem({
      ...eventItem,
      translations: {
        ...(eventItem.translations ?? {}),
        [locale]: {
          ...(eventItem.translations?.[locale] ?? {}),
          [field]: value
        }
      }
    });
  }

  function mediaText(item: MediaRef, field: "alt" | "caption" | "description") {
    if (locale === "en") return item[field] ?? "";
    return item.translations?.[locale]?.[field] || item[field] || "";
  }

  function withMediaText(item: MediaRef, field: "alt" | "caption" | "description", value: string) {
    if (locale === "en") return { ...item, [field]: value };
    return {
      ...item,
      translations: {
        ...(item.translations ?? {}),
        [locale]: {
          ...(item.translations?.[locale] ?? {}),
          [field]: value
        }
      }
    };
  }

  function updateSettingsFont(key: keyof SiteSettings["fonts"], value: FontId | "") {
    if (!settings) return;
    const fonts = { ...(settings.data.fonts ?? {}), default: settings.data.fonts?.default ?? "universal-serif" };
    if (value) {
      fonts[key] = value;
    } else if (key !== "default") {
      delete fonts[key];
    }
    setSettings({ ...settings, data: { ...settings.data, fonts } });
  }

  function sanitizeFontsForLanguages(fonts: SiteSettings["fonts"], languages: LanguageOption[]): SiteSettings["fonts"] {
    const languageCodes = languages.map((language) => language.code);
    const fallback = FONT_OPTIONS.find((font) => fontSupportsLanguages(font.id, languageCodes))?.id ?? "system-sans";
    const next: SiteSettings["fonts"] = {
      default: fontSupportsLanguages(fonts.default, languageCodes) ? fonts.default : fallback
    };
    for (const key of ["page", "headings", "navigation", "event", "article", "gallery", "card", "cta"] as Array<keyof SiteSettings["fonts"]>) {
      const value = fonts[key];
      if (value && fontSupportsLanguages(value, languageCodes)) next[key] = value;
    }
    return next;
  }

  function itemLabel(item: CmsObject) {
    const data = item.data as { title?: string; name?: string; locale?: string; date?: string; startsAt?: string; translations?: Record<string, { title?: string }> };
    const title = locale === "en" ? (data.title ?? data.name ?? item.key) : (data.translations?.[locale]?.title || data.title || data.name || item.key);
    const detail = data.locale ? ` (${data.locale})` : data.startsAt ? ` (${data.startsAt.slice(0, 10)})` : data.date ? ` (${data.date})` : "";
    return `${title}${detail}`;
  }

  if (!user) {
    return (
      <main className="loginShell">
        <section className="loginCard">
          <p className="kicker">Community Site Engine</p>
          <h1>Admin Login</h1>
          {hasCognitoLogin ? (
            <>
              <p className="muted">Sign in with the site administrator account.</p>
              <button onClick={() => void startCognitoLogin()} disabled={authBusy}>{authBusy ? "Signing in..." : "Sign in with Cognito"}</button>
            </>
          ) : (
            <>
              <label>
                Development credential
                <input value={token} onChange={(event) => setToken(event.target.value)} />
              </label>
              <button onClick={() => void refresh()}>Sign In</button>
            </>
          )}
          <p className="status">{message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <p className="kicker">Community Site Engine</p>
        <h1>Content Builder</h1>
        <button onClick={() => void refresh()}>Refresh</button>
        <button className="ghost" onClick={signOut}>Sign Out</button>
        <p className="status">{message}</p>
        <div className="roleBox">
          <strong>{user?.name ?? "Not signed in"}</strong>
          <span>{user?.role ?? "No role"}</span>
        </div>
        <label>
          Language
          <select value={locale} onChange={(event) => setLocale(event.target.value)}>
            {supportedLanguages.map((language) => (
              <option value={language.code} key={language.code}>{language.name} ({language.nativeName})</option>
            ))}
          </select>
        </label>
        <nav className="tabs">
          {visibleTabs.map((item) => (
            <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>
          ))}
        </nav>
      </aside>

      {tab !== "menu" && tab !== "gallery" && tab !== "json" && tab !== "settings" && tab !== "users" && tab !== "translations" && (
        <section className="items">
          <header className="listHeader">
            <h2>{tab}</h2>
            {tab === "pages" && structureAllowed && <button onClick={newPage}>New Page</button>}
            {tab === "events" && <button onClick={newEvent}>New Event</button>}
            {tab === "articles" && <button onClick={newArticle}>New Article</button>}
            {tab === "css" && structureAllowed && <button onClick={newCssFile}>New CSS</button>}
          </header>
          {currentItems.map((item) => (
            <button className={(tab === "css" ? item.key === selectedCssKey : item.key === selectedKey) ? "item active" : "item"} key={item.key} onClick={() => {
              if (tab === "pages") selectPage(item as CmsObject<Page>);
              if (tab === "events") selectEvent(item as CmsObject<EventItem>);
              if (tab === "articles") selectArticle(item as CmsObject<Article>);
              if (tab === "css") void selectCssFile(item.key);
            }}>
              <strong>{itemLabel(item)}</strong>
              <span>{tab === "pages" ? "Page" : tab === "events" ? "Event" : tab === "articles" ? "Article" : "Stylesheet"}</span>
            </button>
          ))}
        </section>
      )}

      {tab === "translations" && user?.role === "admin" && (
        <TranslationsEditor token={token} onUpdate={() => refresh(token)} />
      )}

      {tab !== "translations" && (
        <section className={tab === "menu" || tab === "gallery" || tab === "settings" || tab === "users" || tab === "json" ? "editor builder wideEditor" : "editor builder"}>
        {tab === "pages" && page && (
          <>
            <header className="editorHeader">
              <h2>{page.title}</h2>
              <button onClick={selectedKey && pages.some((item) => item.key === selectedKey) ? savePage : () => createMultilingualPage(page)}>
                {selectedKey && pages.some((item) => item.key === selectedKey) ? "Save Page" : "Create in All Languages"}
              </button>
              {structureAllowed && selectedKey && <button className="danger" onClick={() => deleteObject("pages", selectedKey)}>Delete Page</button>}
            </header>
            <div className="builderCard">
              <p className="muted">Only published pages are generated on the public site.</p>
              <label className="field">
                <span>Status</span>
                <select value={page.status} disabled={!structureAllowed} onChange={(event) => setPage({ ...page, status: event.target.value as Page["status"] })}>
                  <option value="draft">Draft - hidden from public site</option>
                  <option value="published">Published - visible on public site</option>
                </select>
              </label>
              <TextField label="Page title" value={page.title} onChange={(title) => setPage({ ...page, title })} />
              <TextField label="Slug" value={page.slug} disabled={!structureAllowed} onChange={(slug) => setPage({ ...page, slug })} />
              <TextField label="SEO title" value={page.seo.title} onChange={(title) => setPage({ ...page, seo: { ...page.seo, title } })} />
              <TextArea label="SEO description" value={page.seo.description} onChange={(description) => setPage({ ...page, seo: { ...page.seo, description } })} />
            </div>
            {currentPageLayout && (
              <div className="builderCard layoutControls">
                <div>
                  <h3>Page Layout</h3>
                  <p className="muted">Choose one, two, or three columns. Width values work as percentages and are applied as responsive column ratios on the public site.</p>
                </div>
                <label className="field">
                  <span>Columns</span>
                  <select
                    value={currentPageLayout.columns.length}
                    disabled={!structureAllowed}
                    onChange={(event) => {
                      const layout = makeLayout(Number(event.target.value), currentPageLayout);
                      setPage({
                        ...page,
                        layout,
                        blocks: page.blocks.map((block) => ({
                          ...block,
                          layoutColumn: layout.columns.some((column) => column.id === block.layoutColumn) ? block.layoutColumn : layout.columns[0]?.id
                        }))
                      });
                    }}
                  >
                    <option value={1}>Single column</option>
                    <option value={2}>Two columns</option>
                    <option value={3}>Three columns</option>
                  </select>
                </label>
                <div className="columnControls">
                  {currentPageLayout.columns.map((column, columnIndex) => (
                    <div className="columnControl" key={column.id}>
                      <TextField label="Column label" value={column.label} disabled={!structureAllowed} onChange={(label) => {
                        const columns = currentPageLayout.columns.map((item) => item.id === column.id ? { ...item, label } : item);
                        setPage({ ...page, layout: { columns } });
                      }} />
                      <label className="field">
                        <span>Width %</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={column.width}
                          disabled={!structureAllowed}
                          onChange={(event) => {
                            const width = Math.min(100, Math.max(1, Number(event.target.value) || 1));
                            const columns = currentPageLayout.columns.map((item) => item.id === column.id ? { ...item, width } : item);
                            setPage({ ...page, layout: { columns } });
                          }}
                        />
                      </label>
                      <small>Column {columnIndex + 1}</small>
                    </div>
                  ))}
                </div>
                <p className={pageLayoutTotal === 100 ? "muted" : "warningText"}>Current width total: {pageLayoutTotal}%. For predictable results, keep the total at 100%.</p>
              </div>
            )}
            {currentPageLayout && (
              <div className="pageCanvas" style={{ "--admin-page-columns": currentPageLayout.columns.map((column) => `${column.width}fr`).join(" ") } as CSSProperties}>
                {currentPageLayout.columns.map((column) => {
                  const columnBlocks = page.blocks
                    .map((block, index) => ({ block, index }))
                    .filter((item) => columnForBlock(item.block, currentPageLayout) === column.id);
                  return (
                    <section
                      className="pageColumn"
                      key={column.id}
                      onDragOver={(event) => structureAllowed && event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (!structureAllowed || draggedBlockIndex === null) return;
                        setPage({ ...page, blocks: moveBlock(page.blocks, draggedBlockIndex, page.blocks.length, column.id) });
                        setDraggedBlockIndex(null);
                      }}
                    >
                      <header className="pageColumnHeader">
                        <strong>{column.label}</strong>
                        <span>{column.width}%</span>
                      </header>
                      {columnBlocks.length === 0 && <div className="dropHint">Drag sections here</div>}
                      {columnBlocks.map(({ block, index }) => (
                        <div
                          className="draggableBlock"
                          key={index}
                          draggable={structureAllowed}
                          onDragStart={() => setDraggedBlockIndex(index)}
                          onDragEnd={() => setDraggedBlockIndex(null)}
                          onDragOver={(event) => structureAllowed && event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (!structureAllowed || draggedBlockIndex === null) return;
                            setPage({ ...page, blocks: moveBlock(page.blocks, draggedBlockIndex, index, column.id) });
                            setDraggedBlockIndex(null);
                          }}
                        >
                          {structureAllowed && <div className="dragHandle" aria-label={`Drag ${block.type} section`}>Drag to reorder</div>}
                          <BlockEditor
                            block={{ ...block, layoutColumn: column.id }}
                            disabledStructure={!structureAllowed}
                            onUpload={uploadMedia}
                            update={(updated) => setPage({ ...page, blocks: page.blocks.map((item, itemIndex) => itemIndex === index ? { ...updated, layoutColumn: column.id } : item) })}
                            remove={() => setPage({ ...page, blocks: page.blocks.filter((_, itemIndex) => itemIndex !== index) })}
                          />
                        </div>
                      ))}
                    </section>
                  );
                })}
              </div>
            )}
            {structureAllowed && (
              <div className="builderCard addBlock">
                {(["hero", "richText", "cardGrid", "gallery", "eventList", "articleList", "cta"] as BlockType[]).map((type) => (
                  <button key={type} onClick={() => setPage({ ...page, blocks: [...page.blocks, { type, title: `New ${type}`, layoutColumn: currentPageLayout?.columns[0]?.id ?? "main" }] })}>Add {type}</button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "menu" && structureAllowed && (
          <>
            <header className="editorHeader">
              <h2>Menu for {workingLanguageName}</h2>
              <button onClick={() => addMenuItem()}>Add Custom Link</button>
              <button onClick={() => void saveMenu()} disabled={!navigation}>Save Menu</button>
            </header>
            <div className="builderCard menuIntro">
              <p className="muted">
                Edit the public navigation for the selected admin language. Use Parent to make one page a child of another,
                and use Move Up / Move Down to control display order within the same parent.
              </p>
              <label className="field">
                <span>Add page to menu</span>
                <select
                  value=""
                  onChange={(event) => {
                    const pageItem = pages.find((item) => item.key === event.target.value)?.data;
                    if (pageItem) addMenuItem(pageItem);
                  }}
                >
                  <option value="">Select a page...</option>
                  {pages.map((item) => (
                    <option value={item.key} key={item.key}>{item.data.title} ({pageHref(item.data)})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="menuEditor">
              {menuDisplayRows.length === 0 && (
                <div className="emptyState">
                  <h2>No menu items yet</h2>
                  <p>Add a page or custom link to start building the navigation menu for {workingLanguageName}.</p>
                </div>
              )}
              {menuDisplayRows.map((row) => {
                const siblings = menuRows.filter((item) => item.parentId === row.parentId).sort((a, b) => a.sort - b.sort);
                const siblingIndex = siblings.findIndex((item) => item.id === row.id);
                return (
                  <article className="menuItem" style={{ "--menu-depth": row.depth } as CSSProperties} key={row.id}>
                    <div className="menuDrag">
                      <strong>{row.depth === 0 ? "Top" : `Level ${row.depth + 1}`}</strong>
                      <button className="small" onClick={() => moveMenuRow(row.id, -1)} disabled={siblingIndex <= 0}>Move Up</button>
                      <button className="small" onClick={() => moveMenuRow(row.id, 1)} disabled={siblingIndex >= siblings.length - 1}>Move Down</button>
                    </div>
                    <div className="menuFields">
                      <TextField label="Menu label" value={row.label} onChange={(label) => updateMenuRow(row.id, { label })} />
                      <TextField label="Link URL" value={row.href} onChange={(href) => updateMenuRow(row.id, { href })} />
                      <label className="field">
                        <span>Use page link</span>
                        <select
                          value=""
                          onChange={(event) => {
                            const pageItem = pages.find((item) => item.key === event.target.value)?.data;
                            if (pageItem) updateMenuRow(row.id, { label: pageItem.title, href: pageHref(pageItem) });
                          }}
                        >
                          <option value="">Keep custom link</option>
                          {pages.map((item) => (
                            <option value={item.key} key={item.key}>{item.data.title} ({pageHref(item.data)})</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Parent item</span>
                        <select value={row.parentId} onChange={(event) => updateMenuRow(row.id, { parentId: event.target.value, sort: menuRows.filter((item) => item.parentId === event.target.value).length })}>
                          <option value="">Top level</option>
                          {menuRows
                            .filter((item) => item.id !== row.id && !wouldCreateMenuCycle(menuRows, row.id, item.id))
                            .sort((a, b) => menuDepth(menuRows, a.id) - menuDepth(menuRows, b.id) || a.sort - b.sort)
                            .map((item) => (
                              <option value={item.id} key={item.id}>
                                {"- ".repeat(menuDepth(menuRows, item.id))}{item.label || item.href}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <div className="menuActions">
                      <button className="small" onClick={() => addMenuChild(row.id)}>Add Child</button>
                      <button className="danger small" onClick={() => removeMenuRow(row.id)}>Remove</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {tab === "events" && (
          <div className="builderCard importCard">
            <h3>Import from Facebook</h3>
            <p className="muted">Paste a public Facebook event/share link. The importer fills an unsaved draft using any title, date/time, location, description, and image metadata Facebook exposes publicly.</p>
            <div className="importRow">
              <TextField label="Facebook event link" value={facebookImportUrl} onChange={setFacebookImportUrl} />
              <button type="button" onClick={() => void importFacebookEvent()} disabled={facebookImporting}>
                {facebookImporting ? "Importing..." : "Import from Facebook"}
              </button>
            </div>
          </div>
        )}

        {tab === "events" && eventItem && (
          <>
            <header className="editorHeader">
              <h2>{eventText("title")}</h2>
              <button onClick={saveEvent}>Save Event</button>
              {selectedKey && <button className="danger" onClick={() => deleteObject("events", selectedKey)}>Delete Event</button>}
            </header>
            <div className="builderCard">
              <p className="muted">Editing event text for {workingLanguageName}. Only published events appear on the public site; missing translated fields fall back to English.</p>
              <label className="field">
                <span>Status</span>
                <select value={eventItem.status} onChange={(event) => setEventItem({ ...eventItem, status: event.target.value as EventItem["status"] })}>
                  <option value="draft">Draft - hidden from public site</option>
                  <option value="published">Published - visible on public site</option>
                </select>
              </label>
              <TextField label="Title" value={eventText("title")} onChange={(title) => {
                if (locale === "en") setEventItem({ ...eventItem, title, slug: eventItem.slug || slugify(title) });
                else updateEventText("title", title);
              }} />
              <TextField label="Slug" value={eventItem.slug} disabled={locale !== "en"} onChange={(slug) => setEventItem({ ...eventItem, slug, id: eventItem.id || slug })} />
              <DateTimeField label="Start date and time" value={eventItem.startsAt} timeZone={defaultEventTimeZone} onChange={(startsAt) => startsAt && setEventItem({ ...eventItem, startsAt })} />
              <DateTimeField label="End date and time" value={eventItem.endsAt} timeZone={defaultEventTimeZone} optional onChange={(endsAt) => setEventItem({ ...eventItem, endsAt })} />
              <TextField label="Location name" value={eventText("locationName")} onChange={(locationName) => updateEventText("locationName", locationName)} />
              <TextField label="Address" value={eventText("address")} onChange={(address) => updateEventText("address", address)} />
              <ImageField label="Event image" value={eventItem.image} onChange={(image) => setEventItem({ ...eventItem, image })} onUpload={uploadMedia} folder="events" />
              <TextArea label="Description" rows={7} value={eventText("description")} onChange={(description) => updateEventText("description", description)} />
              <TextArea label="Notes" value={eventText("notes")} onChange={(notes) => updateEventText("notes", notes)} />
            </div>
          </>
        )}

        {tab === "articles" && article && (
          <>
            <header className="editorHeader">
              <h2>{article.title}</h2>
              <button onClick={saveArticle}>{selectedKey ? "Save Article" : "Create in All Languages"}</button>
              {selectedKey && <button className="danger" onClick={() => deleteObject("articles", selectedKey)}>Delete Article</button>}
            </header>
            <div className="builderCard">
              <p className="muted">Only published articles appear in public article lists.</p>
              <label className="field">
                <span>Status</span>
                <select value={article.status} onChange={(event) => setArticle({ ...article, status: event.target.value as Article["status"] })}>
                  <option value="draft">Draft - hidden from public site</option>
                  <option value="published">Published - visible on public site</option>
                </select>
              </label>
              <TextField label="Title" value={article.title} onChange={(title) => setArticle({ ...article, title, slug: article.slug || slugify(title), seo: { ...article.seo, title } })} />
              <TextField label="Slug" value={article.slug} onChange={(slug) => setArticle({ ...article, slug, id: article.id || slug })} />
              <TextField label="Date" value={article.date} onChange={(date) => setArticle({ ...article, date })} />
              <TextField label="Category" value={article.category} onChange={(category) => setArticle({ ...article, category })} />
              <ImageField label="Featured image" value={article.featuredImage} onChange={(featuredImage) => setArticle({ ...article, featuredImage })} onUpload={uploadMedia} folder="articles" />
              <TextArea label="Excerpt" value={article.excerpt} onChange={(excerpt) => setArticle({ ...article, excerpt })} />
              <TextArea label="Article body Markdown" rows={14} hint="Use Markdown for headings, lists, links, and paragraphs." value={article.body} onChange={(body) => setArticle({ ...article, body })} />
              <TextArea label="SEO description" value={article.seo.description} onChange={(description) => setArticle({ ...article, seo: { ...article.seo, description } })} />
            </div>
          </>
        )}

        {tab === "gallery" && (
          <>
            <header className="editorHeader">
              <h2>Gallery</h2>
              <button onClick={async () => {
                const media = await uploadMedia("gallery");
                if (media) await saveGallery([...(gallery?.data ?? []), { ...media, status: "draft" }]);
              }}>Upload Gallery Image</button>
            </header>
            <p className="muted">Editing gallery text for {workingLanguageName}. Only published gallery images appear on the public site; new uploads start as drafts.</p>
            <div className="galleryManager">
              {(gallery?.data ?? []).map((item, index) => (
                <figure className="galleryItem" key={`${item.src}-${index}`}>
                  <img src={item.src} alt={mediaText(item, "alt")} />
                  <label className="field">
                    <span>Status</span>
                    <select value={item.status ?? "published"} onChange={(event) => {
                      const items = [...(gallery?.data ?? [])];
                      items[index] = { ...item, status: event.target.value as MediaRef["status"] };
                      setGallery(gallery ? { ...gallery, data: items } : null);
                    }}>
                      <option value="draft">Draft - hidden from public site</option>
                      <option value="published">Published - visible on public site</option>
                    </select>
                  </label>
                  <TextField label="Image URL (shared)" value={item.src} onChange={(src) => {
                    const items = [...(gallery?.data ?? [])];
                    items[index] = { ...item, src };
                    setGallery(gallery ? { ...gallery, data: items } : null);
                  }} />
                  <TextField label="Alt text" value={mediaText(item, "alt")} onChange={(alt) => {
                    const items = [...(gallery?.data ?? [])];
                    items[index] = withMediaText(item, "alt", alt);
                    setGallery(gallery ? { ...gallery, data: items } : null);
                  }} />
                  <TextArea label="Description text" value={mediaText(item, "description")} rows={4} onChange={(description) => {
                    const items = [...(gallery?.data ?? [])];
                    items[index] = withMediaText(item, "description", description);
                    setGallery(gallery ? { ...gallery, data: items } : null);
                  }} />
                  <TextField label="Caption" value={mediaText(item, "caption")} onChange={(caption) => {
                    const items = [...(gallery?.data ?? [])];
                    items[index] = withMediaText(item, "caption", caption);
                    setGallery(gallery ? { ...gallery, data: items } : null);
                  }} />
                  <button className="danger" onClick={async () => {
                    if (!confirm("Remove this image from the gallery? Uploaded local media files will also be deleted from storage.")) return;
                    if (item.src.startsWith("/media/")) await deleteMediaFromStorage(item.src);
                    await saveGallery((gallery?.data ?? []).filter((_, itemIndex) => itemIndex !== index));
                  }}>Delete Image</button>
                </figure>
              ))}
            </div>
            <button onClick={() => saveGallery(gallery?.data ?? [])}>Save Gallery Captions</button>
          </>
        )}

        {tab === "css" && (user?.role === "admin" || user?.role === "designer") && (
          <>
            <header className="editorHeader">
              <h2>{cssDraft?.name ?? "Select a CSS file"}</h2>
              <button onClick={() => void loadCss()}>Reload CSS Files</button>
              <button onClick={() => void saveCss()} disabled={!cssDraft}>Validate & Save CSS</button>
            </header>
            {cssDraft ? (
              <div className="builderCard">
                <TextField
                  label="CSS file key"
                  value={cssDraft.key}
                  onChange={(key) => setCssDraft({ ...cssDraft, key, name: key.replace(/^styles\//, "") })}
                />
                <p className="muted">Edit any stylesheet loaded by the live public site. File keys must stay under styles/ and end with .css. Every save is parsed before it is written.</p>
                <TextArea
                  label="Stylesheet CSS"
                  rows={28}
                  hint="Example: .hero { background: #fff7ec; } .event-card h3 { color: #941116; }"
                  value={cssDraft.css}
                  onChange={(css) => setCssDraft({ ...cssDraft, css })}
                />
              </div>
            ) : (
              <div className="emptyState">
                <h2>Select a CSS file</h2>
                <p>Choose a stylesheet from the list, or create a new one if your role allows it.</p>
              </div>
            )}
          </>
        )}

        {tab === "settings" && user?.role === "admin" && settings && (
          <>
            <header className="editorHeader">
              <h2>Site Settings</h2>
              <button onClick={saveSettings}>Save Settings</button>
            </header>
            <div className="builderCard">
              <TextField label="Site name" value={settings.data.name} onChange={(name) => setSettings({ ...settings, data: { ...settings.data, name } })} />
              <TextField label="Site tagline" value={settings.data.tagline} onChange={(tagline) => setSettings({ ...settings, data: { ...settings.data, tagline } })} />
              <TextArea label="Site description" value={settings.data.description} onChange={(description) => setSettings({ ...settings, data: { ...settings.data, description } })} />
              <ImageField label="Site icon" value={settings.data.siteIcon} onChange={(siteIcon) => setSettings({ ...settings, data: { ...settings.data, siteIcon } })} onUpload={uploadMedia} folder="settings" />
              <TextField label="Contact email" value={settings.data.contactEmail} onChange={(contactEmail) => setSettings({ ...settings, data: { ...settings.data, contactEmail } })} />
              <label className="field">
                <span>Default event timezone</span>
                <small>Used for displaying and creating event times. Default is America/Phoenix.</small>
                <select value={settings.data.eventTimeZone ?? "America/Phoenix"} onChange={(event) => setSettings({ ...settings, data: { ...settings.data, eventTimeZone: event.target.value } })}>
                  {timeZones.map((zone) => <option value={zone} key={zone}>{zone}</option>)}
                </select>
              </label>
              <section className="fontPicker">
                <div>
                  <h3>Fonts</h3>
                  <p className="muted">Only fonts compatible with every selected supported language are shown. If you add languages later, incompatible choices must be changed before settings can be saved.</p>
                </div>
                <label className="field">
                  <span>Default Font</span>
                  <select value={settings.data.fonts?.default ?? "universal-serif"} onChange={(event) => updateSettingsFont("default", event.target.value as FontId)}>
                    {compatibleFonts.map((font) => <option value={font.id} key={font.id}>{font.label}</option>)}
                  </select>
                </label>
                <div className="fontGrid">
                  {([
                    ["page", "Pages"],
                    ["headings", "Headings"],
                    ["navigation", "Navigation"],
                    ["event", "Events"],
                    ["article", "News & Articles"],
                    ["gallery", "Gallery"],
                    ["card", "Cards"],
                    ["cta", "Call-to-action sections"]
                  ] as Array<[keyof SiteSettings["fonts"], string]>).map(([key, label]) => (
                    <label className="field" key={key}>
                      <span>{label} font</span>
                      <select value={settings.data.fonts?.[key] ?? ""} onChange={(event) => updateSettingsFont(key, event.target.value as FontId | "")}>
                        <option value="">Use Default Font</option>
                        {compatibleFonts.map((font) => <option value={font.id} key={font.id}>{font.label}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </section>
              <section className="languagePicker">
                <div>
                  <h3>Supported Languages</h3>
                  <p className="muted">These languages appear in the site language switcher and the admin working-language selector. Content is shown only when a page/article exists for that language.</p>
                </div>
                <label className="field">
                  <span>Default site language</span>
                  <select value={settings.data.defaultLocale} onChange={(event) => setSettings({ ...settings, data: { ...settings.data, defaultLocale: event.target.value } })}>
                    {settings.data.supportedLanguages.map((language) => (
                      <option value={language.code} key={language.code}>{language.name} ({language.nativeName})</option>
                    ))}
                  </select>
                </label>
                <div className="languageGrid">
                  {TOP_LANGUAGES.map((language) => {
                    const selected = settings.data.supportedLanguages.some((item) => item.code === language.code);
                    return (
                      <label className="languageChoice" key={language.code}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            const supportedLanguages = event.target.checked
                              ? [...settings.data.supportedLanguages, language].sort((a, b) => a.name.localeCompare(b.name))
                              : settings.data.supportedLanguages.filter((item) => item.code !== language.code);
                            const defaultLocale = supportedLanguages.some((item) => item.code === settings.data.defaultLocale)
                              ? settings.data.defaultLocale
                              : supportedLanguages[0]?.code ?? "en";
                            const fonts = sanitizeFontsForLanguages(settings.data.fonts ?? { default: "universal-serif" }, supportedLanguages);
                            setSettings({ ...settings, data: { ...settings.data, supportedLanguages, locales: supportedLanguages.map((item) => item.code), defaultLocale, fonts } });
                          }}
                        />
                        <span>
                          <strong>{language.name}</strong>
                          <small>{language.nativeName} · {language.code}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>
            <div className="builderCard">
              <section className="backupRestore">
                <div>
                  <h3>Backup & Restore</h3>
                  <p className="muted">Download a complete backup of all site content as a ZIP archive, or restore from a previously downloaded backup. Backups include pages, articles, events, gallery, navigation, settings, styles, and media.</p>
                </div>
                <div className="actionsRow">
                  <button onClick={() => void downloadBackup()} disabled={backupBusy}>
                    {backupBusy ? "Creating backup..." : "\u2B07 Download Backup"}
                  </button>
                  <button className="danger" onClick={() => void uploadRestore()} disabled={restoreBusy}>
                    {restoreBusy ? "Restoring..." : "\u2B06 Restore from Backup"}
                  </button>
                </div>
                <p className="muted"><strong>Warning:</strong> Restoring from a backup will replace all current site content with the backup contents. A pre-restore snapshot is created automatically before any changes are made.</p>
              </section>
            </div>
          </>
        )}

        {tab === "users" && user?.role === "admin" && (
          <>
            <header className="editorHeader">
              <h2>User Management</h2>
              <button onClick={() => void loadUsers()}>Reload Users</button>
            </header>
            <div className="builderCard">
              <p className="muted">Source: {userSource === "cognito" ? "AWS Cognito user pool" : "local development users.json fallback"}. Configure Cognito with COGNITO_USER_POOL_ID in production.</p>
              <div className="userGrid">
                {managedUsers.map((item) => (
                  <article className="userCard" key={item.id}>
                    <strong>{item.name}</strong>
                    <span>{item.id}</span>
                    <span>{item.email}</span>
                    <span>{item.role}</span>
                    {item.status && <span>{item.status}</span>}
                    <div className="actionsRow">
                      <button onClick={() => setUserDraft({ ...item, temporaryPassword: "", suppressEmail: false })}>Edit</button>
                      <button onClick={() => void sendManagedUserLoginEmail(item.id)}>Send Login Email</button>
                      <button onClick={() => setPasswordResetDraft({ id: item.id, password: "", permanent: false })}>Reset Password</button>
                      <button className="danger" onClick={() => void deleteManagedUser(item.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            {passwordResetDraft.id && (
              <div className="builderCard">
                <h3>Reset Password for {passwordResetDraft.id}</h3>
                <p className="muted">
                  Cognito passwords can be temporary or permanent. Temporary passwords require the user to choose a new password at next sign-in.
                  In local development, this rotates the user's development credential instead.
                </p>
                <TextField label="New password (leave blank to generate)" value={passwordResetDraft.password} onChange={(password) => setPasswordResetDraft({ ...passwordResetDraft, password })} />
                <label className="languageChoice">
                  <input
                    type="checkbox"
                    checked={passwordResetDraft.permanent}
                    onChange={(event) => setPasswordResetDraft({ ...passwordResetDraft, permanent: event.target.checked })}
                  />
                  <span>
                    <strong>Make password permanent</strong>
                    <small>If unchecked, Cognito marks it temporary and the user must change it at next login.</small>
                  </span>
                </label>
                <div className="actionsRow">
                  <button onClick={() => void resetManagedUserPassword()}>Reset Password</button>
                  <button className="danger" onClick={() => setPasswordResetDraft({ id: "", password: "", permanent: false })}>Cancel</button>
                </div>
              </div>
            )}
            <div className="builderCard">
              <h3>{userDraft.id ? "Add / Update User" : "Add User"}</h3>
              <TextField
                label={userSource === "cognito" ? "Cognito username / ID (new users use email)" : "Username / ID"}
                value={userDraft.id}
                onChange={(id) => setUserDraft({ ...userDraft, id })}
                disabled={userSource === "cognito" && !userDraft.id}
              />
              <TextField label="Display name" value={userDraft.name} onChange={(name) => setUserDraft({ ...userDraft, name })} />
              <TextField
                label={userSource === "cognito" ? "Email (required)" : "Email (Cognito)"}
                value={userDraft.email}
                onChange={(email) => setUserDraft({ ...userDraft, email, id: userSource === "cognito" && !userDraft.id ? email : userDraft.id })}
              />
              <label className="field">
                <span>Role</span>
                <select value={userDraft.role} onChange={(event) => setUserDraft({ ...userDraft, role: event.target.value as Role })}>
                  <option value="contributor">Contributor</option>
                  <option value="designer">Designer</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <TextField label="Temporary password (Cognito create only; optional)" value={userDraft.temporaryPassword} onChange={(temporaryPassword) => setUserDraft({ ...userDraft, temporaryPassword })} />
              <label className="languageChoice">
                <input
                  type="checkbox"
                  checked={Boolean(userDraft.suppressEmail)}
                  onChange={(event) => setUserDraft({ ...userDraft, suppressEmail: event.target.checked })}
                />
                <span>
                  <strong>Suppress Cognito invitation email</strong>
                  <small>Leave unchecked for normal user setup so Cognito emails the temporary password.</small>
                </span>
              </label>
              <div className="actionsRow">
                <button onClick={() => void saveManagedUser()} disabled={!(userSource === "cognito" ? userDraft.email : userDraft.id) || !userDraft.name}>Save User</button>
                <button className="danger" onClick={() => setUserDraft({ id: "", name: "", role: "contributor", email: "", temporaryPassword: "", suppressEmail: false })}>Clear</button>
              </div>
            </div>
          </>
        )}

        {tab === "json" && user?.role === "admin" && (
          <>
            <header className="editorHeader">
              <select value={jsonCollection} onChange={(event) => {
                const collection = event.target.value as Collection;
                setJsonCollection(collection);
                setSelectedKey("");
                setJsonValue("");
              }}>
                {(["pages", "articles", "events", "navigation", "settings", "gallery"] as Collection[]).map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={selectedKey} onChange={(event) => void selectJsonKey(event.target.value)}>
                <option value="">Select JSON file</option>
                {jsonItems.map((item) => <option value={item.key} key={item.key}>{item.key}</option>)}
              </select>
              <input value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} placeholder="storage key" />
              <button onClick={() => void selectJsonKey(selectedKey)} disabled={!selectedKey}>Load JSON</button>
              <button onClick={() => void saveJson()} disabled={!selectedKey || !jsonValue.trim()}>Validate & Save JSON</button>
            </header>
            <textarea className="jsonArea" value={jsonValue} onChange={(event) => setJsonValue(event.target.value)} spellCheck={false} />
            <p className="muted">JSON editor is admin-only. Every save is parsed as JSON, validated against the collection schema, and then written through the same API permissions as the visual editor.</p>
          </>
        )}

        {tab !== "menu" && tab !== "gallery" && tab !== "css" && tab !== "json" && tab !== "settings" && tab !== "users" && !page && !eventItem && !article && (
          <div className="emptyState">
            <h2>Select an item</h2>
            <p>Choose content from the list, or create a new item if your role allows it.</p>
          </div>
        )}
      </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
