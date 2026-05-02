import { ArticleSchema, EventSchema, GallerySchema, NavigationSchema, PageSchema, SiteSettingsSchema } from "@community-site-engine/shared";
import { z } from "zod";

const CollectionSchema = z.enum(["pages", "articles", "events", "navigation", "settings", "gallery"]);
export type Collection = z.infer<typeof CollectionSchema>;

export interface CmsClientOptions {
  baseUrl: string;
  token: string;
}

export class CmsClient {
  private baseUrl: string;
  private token: string;

  constructor(options: CmsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json"
    };
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init?.headers ?? {})
      }
    });
    const body = await response.text();
    const parsed = body ? JSON.parse(body) : null;
    if (!response.ok) {
      throw new Error(`CMS API ${response.status}: ${JSON.stringify(parsed)}`);
    }
    return parsed as T;
  }

  list(collection: Collection, locale?: string) {
    const query = locale ? `?locale=${encodeURIComponent(locale)}` : "";
    return this.request(`/api/list/${collection}${query}`);
  }

  read(key: string) {
    return this.request(`/api/object/${key}`);
  }

  write(collection: Collection, key: string, data: unknown) {
    return this.request(`/api/object/${collection}/${key}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  publish(draftKey: string, contentKey: string) {
    return this.request("/api/publish", {
      method: "POST",
      body: JSON.stringify({ draftKey, contentKey })
    });
  }

  triggerBuild() {
    return this.request("/api/build-webhook", { method: "POST" });
  }

  me() {
    return this.request("/api/me");
  }

  delete(collection: Collection, key: string) {
    return this.request(`/api/object/${collection}/${key}`, { method: "DELETE" });
  }

  writePageContent(key: string, data: unknown) {
    return this.request(`/api/page-content/${key}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  uploadMedia(input: { filename: string; contentType: string; base64: string; folder: "gallery" | "events" | "articles" | "settings" }) {
    return this.request("/api/media", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  createMultilingualPage(basePage: unknown) {
    return this.request("/api/create-multilingual-page", {
      method: "POST",
      body: JSON.stringify({ basePage })
    });
  }

  createMultilingualArticle(baseArticle: unknown) {
    return this.request("/api/create-multilingual-article", {
      method: "POST",
      body: JSON.stringify({ baseArticle })
    });
  }

  importFacebookEvent(input: { url: string; timeZone?: string | undefined }) {
    return this.request("/api/import/facebook-event", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  getCss() {
    return this.request("/api/css");
  }

  validateCss(css: string) {
    return this.request("/api/css/validate", {
      method: "POST",
      body: JSON.stringify({ css })
    });
  }

  writeCss(css: string) {
    return this.request("/api/css", {
      method: "PUT",
      body: JSON.stringify({ css })
    });
  }

  private cssObjectPath(key: string) {
    return `/api/css/object/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  listCssFiles() {
    return this.request("/api/css/list");
  }

  readCssFile(key: string) {
    return this.request(this.cssObjectPath(key));
  }

  writeCssFile(key: string, css: string) {
    return this.request(this.cssObjectPath(key), {
      method: "PUT",
      body: JSON.stringify({ css })
    });
  }

  listUsers() {
    return this.request("/api/users");
  }

  upsertUser(input: { id: string; name: string; role: "admin" | "designer" | "contributor"; email?: string | undefined; token?: string | undefined; temporaryPassword?: string | undefined; suppressEmail?: boolean | undefined }) {
    return this.request(`/api/users/${encodeURIComponent(input.id)}`, {
      method: "PUT",
      body: JSON.stringify(input)
    });
  }

  deleteUser(id: string) {
    return this.request(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  resetUserPassword(id: string, input: { password?: string | undefined; permanent?: boolean | undefined }) {
    return this.request(`/api/users/${encodeURIComponent(id)}/reset-password`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
}

export function validateContent(collection: Collection, data: unknown) {
  if (collection === "pages") return PageSchema.parse(data);
  if (collection === "articles") return ArticleSchema.parse(data);
  if (collection === "events") return EventSchema.parse(data);
  if (collection === "navigation") return NavigationSchema.parse(data);
  if (collection === "gallery") return GallerySchema.parse(data);
  return SiteSettingsSchema.parse(data);
}

export { CollectionSchema };
