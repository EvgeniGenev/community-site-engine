import { ArticleSchema, EventSchema, GallerySchema, NavigationSchema, PageSchema, SiteSettingsSchema } from "@community-site-engine/shared";
import { z } from "zod";
import type { StorageDriver } from "./storage.js";

export const CollectionSchema = z.enum(["pages", "articles", "events", "navigation", "settings", "gallery"]);
export type Collection = z.infer<typeof CollectionSchema>;

export function collectionPrefix(collection: Collection, locale?: string): string {
  if (collection === "settings") return "settings";
  if (collection === "gallery") return "gallery";
  if (collection === "events") return collection;
  return locale ? `${collection}/${locale}` : collection;
}

export function schemaFor(collection: Collection) {
  if (collection === "pages") return PageSchema;
  if (collection === "articles") return ArticleSchema;
  if (collection === "events") return EventSchema;
  if (collection === "navigation") return NavigationSchema;
  if (collection === "gallery") return GallerySchema;
  return SiteSettingsSchema;
}

export async function listCollection(storage: StorageDriver, collection: Collection, locale?: string) {
  const prefix = collectionPrefix(collection, locale);
  const keys = (await storage.list(prefix)).filter((key) => key.endsWith(".json"));
  const items = [];
  for (const key of keys) {
    const raw = await storage.get(key);
    if (!raw) continue;
    items.push({ key, data: JSON.parse(raw) as unknown });
  }
  return items;
}

export async function readJson(storage: StorageDriver, key: string) {
  const raw = await storage.get(key);
  return raw ? JSON.parse(raw) : null;
}

export async function writeValidated(storage: StorageDriver, collection: Collection, key: string, data: unknown) {
  const schema = schemaFor(collection);
  const parsed = schema.parse(data);
  await storage.put(key, `${JSON.stringify(parsed, null, 2)}\n`);
  return parsed;
}

export async function publishDraft(storage: StorageDriver, draftKey: string, contentKey: string) {
  const raw = await storage.get(draftKey);
  if (!raw) {
    throw new Error(`Draft not found: ${draftKey}`);
  }
  const snapshotKey = `snapshots/${new Date().toISOString().replaceAll(":", "")}/${contentKey}`;
  await storage.put(contentKey, raw);
  await storage.put(snapshotKey, raw);
  return { contentKey, snapshotKey };
}
