import { Hono } from "hono";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  ArticleSchema,
  EventSchema,
  PageSchema,
  RoleSchema,
  SiteSettingsSchema,
  StylesheetSchema,
  UserSchema,
  UsersSchema,
  type Article,
  type Event,
  type Page,
  type Role,
  type User
} from "@community-site-engine/shared";
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminResetUserPasswordCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { CodeBuildClient, StartBuildCommand, type EnvironmentVariable } from "@aws-sdk/client-codebuild";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { can, authenticate, type AuthUser } from "./auth.js";
import { config } from "./config.js";
import { CollectionSchema, listCollection, publishDraft, readJson, schemaFor, writeValidated } from "./content.js";
import { createStorage } from "./storage.js";

const storage = createStorage();
type Variables = { user: AuthUser };
export const app = new Hono<{ Variables: Variables }>();
const cognito = config.cognitoUserPoolId ? new CognitoIdentityProviderClient({}) : null;
const codebuild = config.codeBuildProjectName ? new CodeBuildClient({}) : null;
const customCssKey = "styles/site-custom.css";
const allowedMediaTypes = new Map([
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
  ["image/gif", [".gif"]]
]);

function allowedCorsOrigin(origin: string) {
  if (!origin) return undefined;
  return config.adminAllowedOrigins.includes(origin) ? origin : undefined;
}

function storageKeyFromPath(pathValue: string) {
  const key = decodeURIComponent(pathValue).replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new HTTPException(400, { message: "Invalid content key" });
  }
  return key;
}

function assertCollectionKey(collection: z.infer<typeof CollectionSchema>, key: string) {
  const prefix = collection === "settings" ? "settings/" : `${collection}/`;
  if (!key.startsWith(prefix) || !key.endsWith(".json")) {
    throw new HTTPException(400, { message: `Key must be a JSON file under ${prefix}` });
  }
}

function assertRawJsonAccess(user: AuthUser, key: string) {
  if (key === "settings/site.json") return;
  if (key.startsWith("settings/") && !can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can access raw settings JSON" });
  }
  if ((key.startsWith("drafts/") || key.startsWith("snapshots/")) && !can(user.role, "writeStructure")) {
    throw new HTTPException(403, { message: "Only admins and designers can access drafts and snapshots" });
  }
}

function mediaKeyFromPath(pathValue: string) {
  const key = storageKeyFromPath(pathValue);
  if (!key.startsWith("media/") || key.includes("..") || key.includes("\\")) {
    throw new HTTPException(400, { message: "Media key must stay under media/" });
  }
  return key;
}

function assertAllowedImage(contentType: string, filename: string, bytes: Buffer) {
  const extensions = allowedMediaTypes.get(contentType);
  if (!extensions) {
    throw new HTTPException(400, { message: "Only JPEG, PNG, WebP, and GIF image uploads are allowed." });
  }
  if (bytes.byteLength > config.maxMediaBytes) {
    throw new HTTPException(413, { message: `Image uploads must be ${config.maxMediaBytes} bytes or smaller.` });
  }
  const lowerName = filename.toLowerCase();
  if (!extensions.some((extension) => lowerName.endsWith(extension))) {
    throw new HTTPException(400, { message: `File extension must match ${contentType}.` });
  }
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isGif = bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a";
  const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const matchesMagic =
    (contentType === "image/jpeg" && isJpeg) ||
    (contentType === "image/png" && isPng) ||
    (contentType === "image/gif" && isGif) ||
    (contentType === "image/webp" && isWebp);
  if (!matchesMagic) {
    throw new HTTPException(400, { message: "Uploaded file bytes do not match the declared image type." });
  }
}

function cssKeyFromPath(pathValue: string) {
  const key = storageKeyFromPath(pathValue);
  if (!key.startsWith("styles/") || !key.endsWith(".css") || key.includes("..") || key.includes("\\")) {
    throw new HTTPException(400, { message: "CSS key must be under styles/ and end with .css" });
  }
  return key;
}

const ManagedUserInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: RoleSchema,
  email: z.string().email().optional(),
  token: z.string().min(12).optional(),
  temporaryPassword: z.string().min(8).optional(),
  suppressEmail: z.boolean().optional()
});

const PasswordResetSchema = z.object({
  password: z.string().min(8).optional(),
  permanent: z.boolean().default(false)
});

function isEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function cognitoErrorMessage(error: unknown) {
  const typed = error as { name?: string; message?: string };
  return typed.message ? `${typed.name ?? "Cognito error"}: ${typed.message}` : "Cognito user operation failed";
}

app.onError((error, c) => {
  if (error instanceof z.ZodError) {
    return c.json({ message: "Validation failed", issues: error.issues }, 400);
  }
  if (error instanceof HTTPException) {
    return c.json({ message: error.message }, error.status);
  }
  console.error(error);
  return c.json({ message: "Internal server error" }, 500);
});

async function supportedLanguageCodes() {
  const settingsRaw = await readJson(storage, "settings/site.json");
  return SiteSettingsSchema.parse(settingsRaw).supportedLanguages.map((language) => language.code);
}

async function readLocalUsers(): Promise<User[]> {
  const raw = await storage.get("settings/users.json");
  return raw ? UsersSchema.parse(JSON.parse(raw)) : [];
}

async function writeLocalUsers(users: User[]) {
  await storage.put("settings/users.json", `${JSON.stringify(UsersSchema.parse(users), null, 2)}\n`);
}

async function listManagedUsers() {
  if (cognito && config.cognitoUserPoolId) {
    const result = await cognito.send(new ListUsersCommand({ UserPoolId: config.cognitoUserPoolId }));
    return {
      source: "cognito",
      users: (result.Users ?? []).map((user) => {
        const attributes = Object.fromEntries((user.Attributes ?? []).map((item) => [item.Name ?? "", item.Value ?? ""]));
        return {
          id: user.Username ?? "",
          name: attributes.name || user.Username || "",
          email: attributes.email,
          role: (attributes["custom:role"] || "contributor") as Role,
          enabled: user.Enabled,
          status: user.UserStatus
        };
      })
    };
  }
  return {
    source: "local",
    users: (await readLocalUsers()).map((user) => ({ id: user.id, name: user.name, role: user.role, token: user.token }))
  };
}

async function upsertManagedUser(input: z.infer<typeof ManagedUserInputSchema>) {
  if (cognito && config.cognitoUserPoolId) {
    const username = input.email ?? input.id;
    const email = input.email ?? (isEmail(input.id) ? input.id : undefined);
    if (!email) {
      throw new HTTPException(400, { message: "Email is required when creating users in Cognito." });
    }
    const attributes = [
      { Name: "name", Value: input.name },
      { Name: "custom:role", Value: input.role },
      { Name: "email", Value: email },
      { Name: "email_verified", Value: "true" }
    ];
    try {
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: config.cognitoUserPoolId,
        Username: username,
        TemporaryPassword: input.temporaryPassword,
        MessageAction: input.suppressEmail ? "SUPPRESS" : undefined,
        UserAttributes: attributes
      }));
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name !== "UsernameExistsException") {
        throw new HTTPException(400, { message: cognitoErrorMessage(error) });
      }
      try {
        await cognito.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: config.cognitoUserPoolId,
          Username: input.id,
          UserAttributes: attributes
        }));
      } catch (updateError) {
        throw new HTTPException(400, { message: cognitoErrorMessage(updateError) });
      }
    }
    return { source: "cognito", user: { id: username, name: input.name, email, role: input.role } };
  }

  const users = await readLocalUsers();
  const token = input.token ?? `dev-${input.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${randomUUID()}`;
  const next = UserSchema.parse({ id: input.id, name: input.name, role: input.role, token });
  const index = users.findIndex((user) => user.id === input.id);
  if (index >= 0) users[index] = next;
  else users.push(next);
  await writeLocalUsers(users);
  return { source: "local", user: next };
}

async function deleteManagedUser(id: string) {
  if (cognito && config.cognitoUserPoolId) {
    await cognito.send(new AdminDeleteUserCommand({ UserPoolId: config.cognitoUserPoolId, Username: id }));
    return { source: "cognito", id };
  }
  const users = (await readLocalUsers()).filter((user) => user.id !== id);
  await writeLocalUsers(users);
  return { source: "local", id };
}

async function sendManagedUserLoginEmail(id: string) {
  if (cognito && config.cognitoUserPoolId) {
    const existingUser = await cognito.send(new AdminGetUserCommand({
      UserPoolId: config.cognitoUserPoolId,
      Username: id
    }));
    if (existingUser.UserStatus === "FORCE_CHANGE_PASSWORD") {
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: config.cognitoUserPoolId,
        Username: id,
        MessageAction: "RESEND"
      }));
      return { source: "cognito", id, message: "Cognito invitation email sent." };
    }
    await cognito.send(new AdminResetUserPasswordCommand({
      UserPoolId: config.cognitoUserPoolId,
      Username: id
    }));
    return { source: "cognito", id, message: "Cognito password reset email sent." };
  }

  return {
    source: "local",
    id,
    message: "Local token email delivery is not configured. Rotate the local token with Reset Password if needed."
  };
}

function generatedPassword() {
  return `Cms-${randomUUID().replace(/-/g, "").slice(0, 14)}!aA1`;
}

async function resetManagedUserPassword(id: string, input: z.infer<typeof PasswordResetSchema>) {
  const password = input.password ?? generatedPassword();
  if (cognito && config.cognitoUserPoolId) {
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: config.cognitoUserPoolId,
      Username: id,
      Password: password,
      Permanent: input.permanent
    }));
    return {
      source: "cognito",
      id,
      permanent: input.permanent,
      temporary: !input.permanent,
      generated: !input.password,
      password
    };
  }

  const users = await readLocalUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) throw new HTTPException(404, { message: "User not found" });
  const token = input.password ?? `dev-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${randomUUID()}`;
  users[index] = UserSchema.parse({ ...users[index], token });
  await writeLocalUsers(users);
  return {
    source: "local",
    id,
    permanent: true,
    temporary: false,
    generated: !input.password,
    token
  };
}

function codeBuildEnvironment(user: AuthUser): EnvironmentVariable[] {
  return [
    { name: "BUILD_REQUESTED_BY", value: user.id, type: "PLAINTEXT" },
    { name: "BUILD_REQUESTED_BY_ROLE", value: user.role, type: "PLAINTEXT" },
    ...(config.s3Bucket ? [{ name: "CMS_CONTENT_BUCKET", value: config.s3Bucket, type: "PLAINTEXT" as const }] : []),
    ...(config.s3Prefix ? [{ name: "CMS_CONTENT_PREFIX", value: config.s3Prefix, type: "PLAINTEXT" as const }] : [])
  ];
}

async function triggerSiteBuild(user: AuthUser) {
  if (!config.codeBuildProjectName || !codebuild) {
    return {
      ok: false,
      provider: "codebuild",
      message: "CODEBUILD_PROJECT_NAME is not configured"
    };
  }

  const result = await codebuild.send(new StartBuildCommand({
    projectName: config.codeBuildProjectName,
    queuedTimeoutInMinutesOverride: config.codeBuildQueuedTimeoutMinutes,
    environmentVariablesOverride: codeBuildEnvironment(user)
  }));

  return {
    ok: true,
    provider: "codebuild",
    projectName: config.codeBuildProjectName,
    buildId: result.build?.id,
    buildNumber: result.build?.buildNumber,
    status: result.build?.buildStatus ?? "QUEUED"
  };
}

async function listCssFiles() {
  const keys = (await storage.list("styles"))
    .filter((key) => key.endsWith(".css"))
    .sort((a, b) => {
      if (a === "styles/site.css") return -1;
      if (b === "styles/site.css") return 1;
      return a.localeCompare(b);
    });
  return Promise.all(keys.map(async (key) => ({
    key,
    name: key.replace(/^styles\//, ""),
    css: await storage.get(key) ?? ""
  })));
}

/* ---- Minimal ZIP helpers (Node.js built-in zlib, no extra deps) ---- */

function crc32(buf: Uint8Array) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function le16(n: number) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function le32(n: number) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }

interface ZipEntry { name: string; data: Uint8Array; }

function createZipArchive(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);
    const useDeflate = compressed.length < entry.data.length;
    const stored = useDeflate ? compressed : Buffer.from(entry.data);
    const method = useDeflate ? 8 : 0;

    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // local header sig
      le16(20), le16(0x0800), le16(method),
      le16(0), le16(0), // mod time/date
      le32(crc), le32(stored.length), le32(entry.data.length),
      le16(nameBytes.length), le16(0),
      nameBytes, stored
    ]);
    localHeaders.push(local);

    const central = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      le16(0x0314), le16(20), le16(0x0800), le16(method),
      le16(0), le16(0),
      le32(crc), le32(stored.length), le32(entry.data.length),
      le16(nameBytes.length), le16(0), le16(0), le16(0), le16(0),
      le32(0x81A40000), le32(offset),
      nameBytes
    ]);
    centralHeaders.push(central);
    offset += local.length;
  }

  const centralDirSize = centralHeaders.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    le16(0), le16(0),
    le16(entries.length), le16(entries.length),
    le32(centralDirSize), le32(offset),
    le16(0)
  ]);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function extractZipArchive(zipBuffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let pos = 0;
  while (pos + 30 <= zipBuffer.length) {
    if (zipBuffer[pos] !== 0x50 || zipBuffer[pos + 1] !== 0x4b || zipBuffer[pos + 2] !== 0x03 || zipBuffer[pos + 3] !== 0x04) break;
    const method = zipBuffer.readUInt16LE(pos + 8);
    const compressedSize = zipBuffer.readUInt32LE(pos + 18);
    const uncompressedSize = zipBuffer.readUInt32LE(pos + 22);
    const nameLen = zipBuffer.readUInt16LE(pos + 26);
    const extraLen = zipBuffer.readUInt16LE(pos + 28);
    const name = zipBuffer.subarray(pos + 30, pos + 30 + nameLen).toString("utf8");
    const dataStart = pos + 30 + nameLen + extraLen;
    const rawData = zipBuffer.subarray(dataStart, dataStart + compressedSize);
    let data: Uint8Array;
    if (method === 8) {
      data = inflateRawSync(rawData);
    } else {
      data = new Uint8Array(rawData);
    }
    if (name && !name.endsWith("/")) {
      entries.push({ name, data });
    }
    pos = dataStart + compressedSize;
  }
  return entries;
}

const BACKUP_PREFIXES = ["pages", "articles", "events", "gallery", "navigation", "settings", "styles", "media"];
const MAX_RESTORE_BYTES = 100 * 1024 * 1024; // 100 MB

async function createSiteBackup(): Promise<Buffer> {
  const allKeys = await storage.listAll();
  const contentKeys = allKeys.filter((key) =>
    BACKUP_PREFIXES.some((prefix) => key.startsWith(`${prefix}/`) || key === prefix) &&
    !key.startsWith("drafts/") &&
    !key.startsWith("snapshots/")
  );

  const entries: ZipEntry[] = [];
  for (const key of contentKeys) {
    if (key.startsWith("media/")) {
      const bytes = await storage.getBytes(key);
      if (bytes) entries.push({ name: key, data: bytes });
    } else {
      const text = await storage.get(key);
      if (text !== null) entries.push({ name: key, data: new TextEncoder().encode(text) });
    }
  }

  return createZipArchive(entries);
}

async function restoreSiteBackup(zipBuffer: Buffer) {
  if (zipBuffer.length > MAX_RESTORE_BYTES) {
    throw new HTTPException(413, { message: `Backup archive too large. Maximum ${MAX_RESTORE_BYTES} bytes.` });
  }

  const entries = extractZipArchive(zipBuffer);
  if (entries.length === 0) {
    throw new HTTPException(400, { message: "The uploaded archive contains no files." });
  }

  // Validate: every entry key must be under one of the allowed prefixes
  for (const entry of entries) {
    if (entry.name.includes("..") || entry.name.startsWith("/") || entry.name.startsWith("\\")) {
      throw new HTTPException(400, { message: `Unsafe path in archive: ${entry.name}` });
    }
    if (!BACKUP_PREFIXES.some((prefix) => entry.name.startsWith(`${prefix}/`))) {
      throw new HTTPException(400, { message: `Unexpected path in archive: ${entry.name}. Allowed top-level directories: ${BACKUP_PREFIXES.join(", ")}` });
    }
  }

  // Create a pre-restore snapshot of current content
  const snapshotPrefix = `snapshots/pre-restore-${new Date().toISOString().replaceAll(":", "")}`;
  const currentKeys = await storage.listAll();
  const currentContentKeys = currentKeys.filter((key) =>
    BACKUP_PREFIXES.some((prefix) => key.startsWith(`${prefix}/`)) &&
    !key.startsWith("drafts/") &&
    !key.startsWith("snapshots/")
  );
  for (const key of currentContentKeys) {
    if (key.startsWith("media/")) {
      const bytes = await storage.getBytes(key);
      if (bytes) await storage.putBytes(`${snapshotPrefix}/${key}`, bytes, "application/octet-stream");
    } else {
      const text = await storage.get(key);
      if (text !== null) await storage.put(`${snapshotPrefix}/${key}`, text);
    }
  }

  // Restore from archive
  let restored = 0;
  for (const entry of entries) {
    if (entry.name.startsWith("media/")) {
      const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
      const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };
      const contentType = mimeMap[ext] ?? "application/octet-stream";
      await storage.putBytes(entry.name, entry.data, contentType);
      // Also copy to Astro public directory in local mode
      if (config.storageMode === "local") {
        const publicPath = resolve(process.cwd(), "../../apps/site/public", entry.name);
        await mkdir(dirname(publicPath), { recursive: true });
        await writeFile(publicPath, entry.data);
      }
    } else {
      const text = new TextDecoder().decode(entry.data);
      const contentType = entry.name.endsWith(".css") ? "text/css" : "application/json";
      await storage.put(entry.name, text, contentType);
    }
    restored += 1;
  }

  return { restored, snapshotPrefix, entries: entries.map((e) => e.name) };
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match)
    .replace(/\\u0025/g, "%")
    .replace(/\\\//g, "/")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return undefined;
}

function titleFromHtml(html: string) {
  const title = metaContent(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? stripTags(title).replace(/\s*\|\s*Facebook\s*$/i, "").replace(/\s+public group\s*$/i, "").trim() : undefined;
}

function slugifyImport(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "facebook-event";
}

function partsInTimeZone(value: string | Date, timeZone: string) {
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
  const parts = partsInTimeZone(date, timeZone);
  if (!parts) return 0;
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((zonedAsUtc - date.getTime()) / 60000);
}

function offsetString(minutes: number) {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function zonedInputToIso(dateValue: string, timeValue: string, timeZone: string) {
  const dateParts = dateValue.split("-").map(Number);
  const timeParts = timeValue.split(":").map(Number);
  const year = dateParts[0] ?? 1970;
  const month = dateParts[1] ?? 1;
  const day = dateParts[2] ?? 1;
  const hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;
  let offset = offsetMinutesForInstant(new Date(Date.UTC(year, month - 1, day, hour, minute)), timeZone);
  offset = offsetMinutesForInstant(new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60000), timeZone);
  return `${dateValue}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offsetString(offset)}`;
}

function toConfiguredTimeZoneIso(value: string | number | undefined, timeZone: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const date = typeof value === "number" ? new Date(value > 100000000000 ? value : value * 1000) : new Date(value);
  const parts = partsInTimeZone(date, timeZone);
  if (!parts) return undefined;
  const dateValue = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const timeValue = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  return zonedInputToIso(dateValue, timeValue, timeZone);
}

function parseHumanDate(text: string, timeZone: string) {
  const clean = text.replace(/\s+/g, " ");
  const match = clean.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?(?:\s+(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (!match) return undefined;
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = monthNames.findIndex((name) => match[1]?.toLowerCase().startsWith(name)) + 1;
  const year = Number(match[3] ?? new Date().getFullYear());
  const day = Number(match[2]);
  let hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const meridiem = match[6]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return {
    iso: zonedInputToIso(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, timeZone),
    hasTime: Boolean(match[4])
  };
}

function jsonLdObjects(html: string) {
  const objects: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    if (!match[1]) continue;
    try {
      const parsed = JSON.parse(decodeHtml(match[1]));
      objects.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      // Ignore malformed metadata blocks.
    }
  }
  return objects;
}

function findJsonLdEvent(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => String(item).toLowerCase() === "event")) return record;
  for (const nested of Object.values(record)) {
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const found = findJsonLdEvent(item);
        if (found) return found;
      }
    } else {
      const found = findJsonLdEvent(nested);
      if (found) return found;
    }
  }
  return undefined;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) return firstString(value[0]);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return firstString(record.url) ?? firstString(record.name) ?? firstString(record["@id"]);
  }
  return undefined;
}

async function importFacebookEvent(url: string, timeZone: string): Promise<Event> {
  const initialUrl = new URL(url);
  const allowedHosts = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "fb.me"]);
  if (!allowedHosts.has(initialUrl.hostname.toLowerCase())) {
    throw new HTTPException(400, { message: "Only public Facebook event/share links are supported." });
  }

  let currentUrl = initialUrl;
  let response: Response | null = null;
  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    response = await fetch(currentUrl.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; CommunitySiteEngine/0.1)"
      }
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location) break;
    currentUrl = new URL(location, currentUrl);
    if (!allowedHosts.has(currentUrl.hostname.toLowerCase())) {
      throw new HTTPException(400, { message: "Facebook import redirected to an unsupported host." });
    }
  }
  if (!response?.ok) {
    throw new HTTPException(400, { message: `Facebook returned ${response?.status ?? "no response"}. Make sure this is a public event link.` });
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("text/html")) {
    throw new HTTPException(400, { message: "Facebook import expected an HTML page." });
  }
  const html = (await response.text()).slice(0, 3_000_000);
  const plainText = stripTags(html);
  const jsonLdEvent = jsonLdObjects(html).map(findJsonLdEvent).find(Boolean);
  const title = firstString(jsonLdEvent?.name) ?? titleFromHtml(html) ?? "Imported Facebook Event";
  const metaDescription = metaContent(html, "og:description") ?? metaContent(html, "description") ?? "";
  const description = firstString(jsonLdEvent?.description) ?? metaDescription;
  const imageSrc = firstString(jsonLdEvent?.image) ?? metaContent(html, "og:image");
  const location = jsonLdEvent?.location && typeof jsonLdEvent.location === "object" ? jsonLdEvent.location as Record<string, unknown> : undefined;
  const address = location?.address && typeof location.address === "object" ? location.address as Record<string, unknown> : undefined;
  const locationName = firstString(location?.name);
  const locationText = [firstString(address?.streetAddress), firstString(address?.addressLocality), firstString(address?.addressRegion), firstString(address?.postalCode)]
    .filter(Boolean)
    .join(", ");
  const startFromMeta = metaContent(html, "event:start_time") ?? metaContent(html, "startDate");
  const endFromMeta = metaContent(html, "event:end_time") ?? metaContent(html, "endDate");
  const humanStart = parseHumanDate(`${description} ${metaDescription} ${plainText}`, timeZone);
  const startsAt = toConfiguredTimeZoneIso(firstString(jsonLdEvent?.startDate) ?? startFromMeta, timeZone)
    ?? humanStart?.iso;
  const endsAt = toConfiguredTimeZoneIso(firstString(jsonLdEvent?.endDate) ?? endFromMeta, timeZone);

  if (!startsAt) {
    throw new HTTPException(422, { message: "Could not extract an event start date/time from the public Facebook page. The page may require login or hide event metadata." });
  }

  const slug = slugifyImport(title);
  return EventSchema.parse({
    id: slug,
    status: "draft",
    title,
    slug,
    startsAt,
    endsAt,
    locationName,
    address: locationText || undefined,
    image: imageSrc ? { src: imageSrc, alt: title } : undefined,
    description: description || `Imported from Facebook: ${initialUrl.toString()}`,
    notes: [
      `Imported from Facebook: ${initialUrl.toString()}`,
      humanStart && !humanStart.hasTime ? "Facebook public metadata did not expose a start time; verify the event time before publishing." : undefined
    ].filter(Boolean).join("\n")
  });
}

function localizedPage(basePage: Page, locale: string): Page {
  return PageSchema.parse({
    ...basePage,
    locale,
    title: locale === basePage.locale ? basePage.title : `${basePage.title} (${locale.toUpperCase()})`,
    seo: {
      ...basePage.seo,
      title: locale === basePage.locale ? basePage.seo.title : `${basePage.seo.title} (${locale.toUpperCase()})`
    }
  });
}

function localizedArticle(baseArticle: Article, locale: string): Article {
  return ArticleSchema.parse({
    ...baseArticle,
    locale,
    title: locale === baseArticle.locale ? baseArticle.title : `${baseArticle.title} (${locale.toUpperCase()})`,
    seo: {
      ...baseArticle.seo,
      title: locale === baseArticle.locale ? baseArticle.seo.title : `${baseArticle.seo.title} (${locale.toUpperCase()})`
    }
  });
}

async function writeLocalizedObject(collection: "pages" | "articles", key: string, body: unknown) {
  const data = collection === "pages" ? PageSchema.parse(body) : ArticleSchema.parse(body);
  const languages = await supportedLanguageCodes();
  const created = [];

  await storage.put(key, `${JSON.stringify(data, null, 2)}\n`);

  for (const locale of languages) {
    const localized = collection === "pages" ? localizedPage(data as Page, locale) : localizedArticle(data as Article, locale);
    const siblingKey = `${collection}/${locale}/${localized.slug}.json`;
    const exists = siblingKey === key || Boolean(await readJson(storage, siblingKey));
    if (exists) continue;
    await storage.put(siblingKey, `${JSON.stringify(localized, null, 2)}\n`);
    created.push({ key: siblingKey, data: localized });
  }

  return { key, data, created };
}

app.use("*", cors({
  origin: allowedCorsOrigin,
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  maxAge: 600
}));

app.use("/api/*", async (c, next) => {
  const user = await authenticate(storage, c.req.header("authorization"));
  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  c.set("user", user);
  await next();
});

app.get("/health", (c) => c.json({ ok: true, storageMode: config.storageMode }));

app.get("/api/list/:collection", async (c) => {
  const collection = CollectionSchema.parse(c.req.param("collection"));
  const user = c.get("user");
  const locale = c.req.query("locale");
  const items = await listCollection(storage, collection, locale);
  if (collection !== "settings" || can(user.role, "settings")) {
    return c.json(items);
  }
  return c.json(items.filter((item) => item.key === "settings/site.json"));
});

app.get("/api/me", (c) => c.json(c.get("user")));

app.post("/api/import/facebook-event", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "writeContent")) {
    throw new HTTPException(403, { message: "Insufficient permissions" });
  }
  const body = z.object({
    url: z.string().url(),
    timeZone: z.string().min(1).default("America/Phoenix")
  }).parse(await c.req.json());
  return c.json({ event: await importFacebookEvent(body.url, body.timeZone) });
});

app.get("/api/users", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can manage users" });
  }
  return c.json(await listManagedUsers());
});

app.post("/api/users", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can manage users" });
  }
  return c.json(await upsertManagedUser(ManagedUserInputSchema.parse(await c.req.json())));
});

app.put("/api/users/:id", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can manage users" });
  }
  const body = ManagedUserInputSchema.parse({ ...(await c.req.json()), id: c.req.param("id") });
  return c.json(await upsertManagedUser(body));
});

app.post("/api/users/:id/reset-password", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can reset user passwords" });
  }
  const body = PasswordResetSchema.parse(await c.req.json());
  return c.json(await resetManagedUserPassword(c.req.param("id"), body));
});

app.post("/api/users/:id/send-login-email", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can email login instructions" });
  }
  return c.json(await sendManagedUserLoginEmail(c.req.param("id")));
});

app.delete("/api/users/:id", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can manage users" });
  }
  return c.json(await deleteManagedUser(c.req.param("id")));
});

app.get("/api/css", async (c) => {
  const css = await storage.get(customCssKey);
  return c.json({ key: customCssKey, css: css ?? "" });
});

app.get("/api/css/list", async (c) => c.json(await listCssFiles()));

app.get("/api/css/object/*", async (c) => {
  const key = cssKeyFromPath(c.req.path.replace("/api/css/object/", ""));
  const css = await storage.get(key);
  if (css === null) throw new HTTPException(404, { message: "CSS file not found" });
  return c.json({ key, name: key.replace(/^styles\//, ""), css });
});

app.post("/api/css/validate", async (c) => {
  const body = StylesheetSchema.parse(await c.req.json());
  return c.json({ ok: true, css: body.css });
});

app.put("/api/css", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "writeStructure")) {
    throw new HTTPException(403, { message: "Only admins and designers can update live CSS" });
  }
  const body = StylesheetSchema.parse(await c.req.json());
  await storage.put(customCssKey, body.css, "text/css");
  return c.json({ key: customCssKey, css: body.css });
});

app.put("/api/css/object/*", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "writeStructure")) {
    throw new HTTPException(403, { message: "Only admins and designers can update live CSS" });
  }
  const key = cssKeyFromPath(c.req.path.replace("/api/css/object/", ""));
  const body = StylesheetSchema.parse(await c.req.json());
  await storage.put(key, body.css, "text/css");
  return c.json({ key, name: key.replace(/^styles\//, ""), css: body.css });
});

app.get("/api/object/*", async (c) => {
  const user = c.get("user");
  const key = storageKeyFromPath(c.req.path.replace("/api/object/", ""));
  assertRawJsonAccess(user, key);
  const data = await readJson(storage, key);
  if (!data) throw new HTTPException(404, { message: "Not found" });
  return c.json({ key, data });
});

app.post("/api/validate/:collection", async (c) => {
  const collection = CollectionSchema.parse(c.req.param("collection"));
  const data = schemaFor(collection).parse(await c.req.json());
  return c.json({ ok: true, data });
});

app.put("/api/object/:collection/*", async (c) => {
  const collection = CollectionSchema.parse(c.req.param("collection"));
  const user = c.get("user");
  if (collection === "settings" && !can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can update settings" });
  }
  if ((collection === "pages" || collection === "navigation") && !can(user.role, "writeStructure")) {
    throw new HTTPException(403, { message: "Contributor can update page content, not page structure" });
  }
  if ((collection === "articles" || collection === "events" || collection === "gallery") && !can(user.role, "writeContent")) {
    throw new HTTPException(403, { message: "Insufficient permissions" });
  }
  const key = storageKeyFromPath(c.req.path.replace(`/api/object/${collection}/`, ""));
  assertCollectionKey(collection, key);
  assertRawJsonAccess(user, key);
  const body = await c.req.json();
  if (collection === "pages" || collection === "articles") {
    return c.json(await writeLocalizedObject(collection, key, body));
  }
  const data = await writeValidated(storage, collection, key, body);
  return c.json({ key, data });
});

app.post("/api/create-multilingual-page", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "writeStructure")) {
    throw new HTTPException(403, { message: "Only designers and admins can create page structures" });
  }
  const body = z.object({ basePage: PageSchema }).parse(await c.req.json());
  const key = `pages/${body.basePage.locale}/${body.basePage.slug}.json`;
  const result = await writeLocalizedObject("pages", key, body.basePage);
  return c.json({ created: [{ key: result.key, data: result.data }, ...result.created] });
});

app.post("/api/create-multilingual-article", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "writeContent")) {
    throw new HTTPException(403, { message: "Insufficient permissions" });
  }
  const body = z.object({ baseArticle: ArticleSchema }).parse(await c.req.json());
  const key = `articles/${body.baseArticle.locale}/${body.baseArticle.slug}.json`;
  const result = await writeLocalizedObject("articles", key, body.baseArticle);
  return c.json({ created: [{ key: result.key, data: result.data }, ...result.created] });
});

function assertSamePageStructure(existing: Page, next: Page) {
  if (existing.id !== next.id || existing.slug !== next.slug || existing.locale !== next.locale || existing.translationKey !== next.translationKey) {
    throw new HTTPException(403, { message: "Contributor cannot change page identity, slug, locale, or translation key" });
  }
  if (JSON.stringify(existing.layout) !== JSON.stringify(next.layout)) {
    throw new HTTPException(403, { message: "Contributor cannot change page layout" });
  }
  if (existing.blocks.length !== next.blocks.length) {
    throw new HTTPException(403, { message: "Contributor cannot add or remove page sections" });
  }
  existing.blocks.forEach((block, index) => {
    if (block.type !== next.blocks[index]?.type) {
      throw new HTTPException(403, { message: "Contributor cannot change page section types" });
    }
    if ((block.layoutColumn ?? "") !== (next.blocks[index]?.layoutColumn ?? "")) {
      throw new HTTPException(403, { message: "Contributor cannot move page sections between columns" });
    }
    if ((block.customCss ?? "") !== (next.blocks[index]?.customCss ?? "")) {
      throw new HTTPException(403, { message: "Contributor cannot change custom CSS" });
    }
  });
}

app.put("/api/page-content/*", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "writeContent")) {
    throw new HTTPException(403, { message: "Insufficient permissions" });
  }
  const key = storageKeyFromPath(c.req.path.replace("/api/page-content/", ""));
  assertCollectionKey("pages", key);
  const existingRaw = await readJson(storage, key);
  if (!existingRaw) throw new HTTPException(404, { message: "Page not found" });
  const existing = PageSchema.parse(existingRaw);
  const next = PageSchema.parse(await c.req.json());
  if (!can(user.role, "writeStructure")) {
    assertSamePageStructure(existing, next);
  }
  await storage.put(key, `${JSON.stringify(next, null, 2)}\n`);
  return c.json({ key, data: next });
});

app.delete("/api/object/:collection/*", async (c) => {
  const collection = CollectionSchema.parse(c.req.param("collection"));
  const user = c.get("user");
  if (collection === "pages" || collection === "navigation" || collection === "settings") {
    if (!can(user.role, "writeStructure") || collection === "settings") {
      throw new HTTPException(403, { message: "Only admins/designers can delete structure; settings cannot be deleted here" });
    }
  }
  if ((collection === "articles" || collection === "events" || collection === "gallery") && !can(user.role, "delete")) {
    throw new HTTPException(403, { message: "Insufficient permissions" });
  }
  const key = storageKeyFromPath(c.req.path.replace(`/api/object/${collection}/`, ""));
  assertCollectionKey(collection, key);
  await storage.delete(key);
  return c.json({ ok: true, key });
});

app.post("/api/media", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "media")) {
    throw new HTTPException(403, { message: "Insufficient permissions" });
  }
  const body = z
    .object({
        filename: z.string().min(1),
        contentType: z.string().min(1),
        base64: z.string().min(1),
        folder: z.enum(["gallery", "events", "articles", "settings"]).default("gallery")
      })
    .parse(await c.req.json());
  const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
  const key = `media/${body.folder}/${Date.now()}-${safeName}`;
  const bytes = Buffer.from(body.base64, "base64");
  assertAllowedImage(body.contentType, safeName, bytes);
  await storage.putBytes(key, bytes, body.contentType);
  if (config.storageMode === "local") {
    const publicPath = resolve(process.cwd(), "../../apps/site/public", key);
    await mkdir(dirname(publicPath), { recursive: true });
    await writeFile(publicPath, bytes);
  }
  return c.json({ key, src: `/${key}`, alt: safeName.replace(/\.[^.]+$/, "").replaceAll("-", " ") });
});

app.delete("/api/media/*", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "media")) {
    throw new HTTPException(403, { message: "Insufficient permissions" });
  }
  const key = mediaKeyFromPath(c.req.path.replace("/api/media/", ""));
  await storage.delete(key);
  return c.json({ ok: true, key });
});

app.post("/api/publish", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "writeStructure")) {
    throw new HTTPException(403, { message: "Only admins and designers can publish drafts" });
  }
  const body = z.object({ draftKey: z.string().min(1), contentKey: z.string().min(1) }).parse(await c.req.json());
  const draftKey = storageKeyFromPath(body.draftKey);
  const contentKey = storageKeyFromPath(body.contentKey);
  if (!draftKey.startsWith("drafts/")) {
    throw new HTTPException(400, { message: "draftKey must stay under drafts/" });
  }
  assertRawJsonAccess(user, contentKey);
  const result = await publishDraft(storage, draftKey, contentKey);
  return c.json(result);
});

app.post("/api/build-webhook", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "writeContent")) {
    throw new HTTPException(403, { message: "Insufficient permissions" });
  }
  const result = await triggerSiteBuild(user);
  return c.json(result, result.ok ? 200 : 202);
});

app.get("/api/backup", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can create site backups" });
  }
  const zip = await createSiteBackup();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const filename = `site-backup-${timestamp}.zip`;

  // In S3 mode, upload to bucket and return a presigned download URL
  // to bypass Lambda's 6 MB response payload limit.
  if (config.storageMode === "s3" && config.s3Bucket) {
    const backupKey = `backups/${filename}`;
    await storage.putBytes(backupKey, new Uint8Array(zip), "application/zip");
    const s3 = new S3Client({});
    const command = new GetObjectCommand({
      Bucket: config.s3Bucket,
      Key: backupKey,
      ResponseContentDisposition: `attachment; filename="${filename}"`
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 600 });
    return c.json({ ok: true, filename, size: zip.length, downloadUrl: url });
  }

  // Local mode: return the ZIP inline
  c.header("Content-Type", "application/zip");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  c.header("Content-Length", String(zip.length));
  return c.body(zip as unknown as ArrayBuffer);
});

app.post("/api/restore", async (c) => {
  const user = c.get("user");
  if (!can(user.role, "settings")) {
    throw new HTTPException(403, { message: "Only admins can restore site backups" });
  }
  const contentType = c.req.header("content-type") ?? "";
  let zipBuffer: Buffer;
  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.parseBody();
    const file = formData.file;
    if (!file || typeof file === "string" || Array.isArray(file)) {
      throw new HTTPException(400, { message: "No file uploaded. Send a ZIP file as multipart form-data with field name 'file'." });
    }
    zipBuffer = Buffer.from(await (file as File).arrayBuffer());
  } else {
    zipBuffer = Buffer.from(await c.req.arrayBuffer());
  }
  if (zipBuffer.length < 22) {
    throw new HTTPException(400, { message: "Uploaded file is too small to be a valid ZIP archive." });
  }
  if (zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4b) {
    throw new HTTPException(400, { message: "Uploaded file does not appear to be a ZIP archive." });
  }
  const result = await restoreSiteBackup(zipBuffer);
  return c.json({ ok: true, ...result });
});
