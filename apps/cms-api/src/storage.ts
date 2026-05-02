import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { config } from "./config.js";

export interface StoredObject {
  key: string;
  body: string;
  lastModified?: string;
}

export interface StorageDriver {
  list(prefix: string): Promise<string[]>;
  get(key: string): Promise<string | null>;
  put(key: string, body: string, contentType?: string): Promise<void>;
  putBytes(key: string, body: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

function assertSafeKey(key: string) {
  if (key.includes("..") || key.startsWith("/") || key.startsWith("\\")) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}

export class LocalStorageDriver implements StorageDriver {
  private root: string;

  constructor(root = config.contentRoot) {
    this.root = resolve(process.cwd(), root);
  }

  private pathFor(key: string) {
    assertSafeKey(key);
    const target = resolve(this.root, normalize(key));
    if (!target.startsWith(this.root + sep) && target !== this.root) {
      throw new Error(`Storage key escapes root: ${key}`);
    }
    return target;
  }

  async list(prefix: string): Promise<string[]> {
    const rootPath = this.pathFor(prefix);
    try {
      await stat(rootPath);
    } catch {
      return [];
    }

    const found: string[] = [];
    async function walk(dir: string) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const absolute = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolute);
        } else {
          found.push(absolute);
        }
      }
    }

    await walk(rootPath);
    return found
      .map((absolute) => absolute.replace(this.root + sep, "").replaceAll("\\", "/"))
      .sort();
  }

  async get(key: string): Promise<string | null> {
    try {
      return await readFile(this.pathFor(key), "utf8");
    } catch {
      return null;
    }
  }

  async put(key: string, body: string): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body, "utf8");
  }

  async putBytes(key: string, body: Uint8Array): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}

async function streamToString(stream: unknown): Promise<string> {
  if (stream instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  if (stream && typeof (stream as { transformToString?: () => Promise<string> }).transformToString === "function") {
    return (stream as { transformToString: () => Promise<string> }).transformToString();
  }
  return "";
}

export class S3StorageDriver implements StorageDriver {
  private client = new S3Client({});
  private bucket: string;
  private prefix: string;

  constructor(bucket = config.s3Bucket, prefix = config.s3Prefix) {
    if (!bucket) {
      throw new Error("CMS_CONTENT_BUCKET is required when STORAGE_MODE=s3");
    }
    this.bucket = bucket;
    this.prefix = prefix.replace(/^\/+|\/+$/g, "");
  }

  private keyFor(key: string) {
    assertSafeKey(key);
    return [this.prefix, key].filter(Boolean).join("/");
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let ContinuationToken: string | undefined;
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.keyFor(prefix),
          ContinuationToken
        })
      );
      for (const item of result.Contents ?? []) {
        if (item.Key) {
          const withoutPrefix = this.prefix ? item.Key.replace(`${this.prefix}/`, "") : item.Key;
          keys.push(withoutPrefix);
        }
      }
      ContinuationToken = result.NextContinuationToken;
    } while (ContinuationToken);
    return keys.sort();
  }

  async get(key: string): Promise<string | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.keyFor(key) }));
      return streamToString(result.Body);
    } catch {
      return null;
    }
  }

  async put(key: string, body: string, contentType = "application/json"): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keyFor(key),
        Body: body,
        ContentType: contentType
      })
    );
  }

  async putBytes(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keyFor(key),
        Body: body,
        ContentType: contentType
      })
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.keyFor(key) }));
  }
}

export function createStorage(): StorageDriver {
  return config.storageMode === "s3" ? new S3StorageDriver() : new LocalStorageDriver();
}
