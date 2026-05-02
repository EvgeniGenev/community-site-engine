import { access, cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const source = process.env.CONTENT_ROOT
  ? join(process.env.CONTENT_ROOT, "media")
  : join(root, "site-assets", "content", "media");
const target = join(root, "apps", "site", "public", "media");

await access(source).catch(() => {
  console.log(`No media directory found at ${source}; skipping media copy.`);
  process.exit(0);
});

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log(`Copied media from ${source} to ${target}`);
