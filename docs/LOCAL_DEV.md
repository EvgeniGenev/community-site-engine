# Local Development Setup

## Prerequisites

- Node.js 22+ (matches the CodeBuild runtime)
- npm 10+
- Windows PowerShell or compatible shell

---

## First-Time Setup

```powershell
# 1. Install all workspace dependencies
npm install

# 2. Copy private content into working location
#    Option A: use the BHCAZ private backup (never commit this)
Copy-Item site-assets-private-backup-20260501-211224/content site-assets/content -Recurse

#    Option B: start from generic example content
Copy-Item examples/site-assets site-assets -Recurse

# 3. Copy media files into the Astro public directory
npm run seed:media
```

> **Note:** `site-assets/` and `site-assets-private-backup-*/` are gitignored. They will never be pushed to GitHub.

---

## Running the Dev Environment

Three separate processes — open three terminals or use the combined command:

```powershell
# All three in parallel (requires npm-run-all, already a dependency)
npm run dev
```

Or individually:

```powershell
# Terminal 1 – CMS API (reads site-assets/content)
npm run dev:api

# Terminal 2 – CMS Admin UI
npm run dev:admin

# Terminal 3 – Astro public site (reads site-assets/content)
npm run dev:site
```

### Local URLs

| Service | URL |
|---------|-----|
| Public site | http://localhost:4321 |
| Admin UI | http://localhost:5174 |
| CMS API health | http://localhost:8787/health |

### Dev Auth Tokens

In local mode (no Cognito configured), use these tokens in the `Authorization: Bearer <token>` header:

| Role | Token |
|------|-------|
| Admin | `dev-admin-token` |
| Designer | `dev-designer-token` |
| Contributor | `dev-contributor-token` |

The Admin UI pre-fills `dev-admin-token` in development mode (`import.meta.env.DEV`).

---

## Content Root

The API and Astro site both read from:

```
site-assets/content/
```

This is controlled by the `CONTENT_ROOT` environment variable (defaults to `../../site-assets/content` relative to each app's CWD).

Changes you make through the Admin UI or API are written to `site-assets/content/` on disk. The Astro dev server picks up changes on refresh.

---

## Environment Variables

### cms-api (`apps/cms-api/.env`)

Copy from `.env.example`:

```env
PORT=8787
STORAGE_MODE=local
CONTENT_ROOT=../../site-assets/content
CMS_ADMIN_TOKEN=dev-admin-token
ADMIN_ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
MAX_MEDIA_BYTES=10485760

# Only needed for production:
# CMS_CONTENT_BUCKET=
# CMS_CONTENT_PREFIX=
# COGNITO_USER_POOL_ID=
# COGNITO_REGION=
# COGNITO_APP_CLIENT_ID=
# CMS_ALLOW_DEV_TOKENS=false
# CODEBUILD_PROJECT_NAME=
```

### cms-admin (`apps/cms-admin/.env`)

```env
VITE_CMS_API_URL=http://localhost:8787
# Production only:
# VITE_COGNITO_DOMAIN=https://your-pool.auth.us-east-1.amazoncognito.com
# VITE_COGNITO_CLIENT_ID=your-app-client-id
# VITE_COGNITO_REDIRECT_URI=https://admin.example.com
```

### cms-mcp (`apps/cms-mcp/.env`)

```env
CMS_API_URL=http://localhost:8787
CMS_ADMIN_TOKEN=dev-admin-token
```

---

## Type Checking and Build

```powershell
# Type-check all workspaces
npm run check

# Build shared package (required before building apps)
npm --workspace packages/shared run build

# Build everything (shared → site → admin → api → mcp)
npm run build

# Build only the public site
npm run build:site
```

---

## Working with the Private Content Backup

`site-assets-private-backup-20260501-211224/` is the live BHCAZ site content snapshot. It is:
- Stored only locally on this machine
- **Never pushed to GitHub** (gitignored by `site-assets-private-backup-*/`)
- The source of truth when preparing a production deployment

### Syncing content to/from AWS production

Push local content to the production S3 bucket:
```powershell
aws s3 sync site-assets/content s3://CMS_CONTENT_BUCKET --delete
```

Pull production content to local:
```powershell
aws s3 sync s3://CMS_CONTENT_BUCKET site-assets/content --delete
```

Trigger a production rebuild without going through Admin:
```powershell
aws codebuild start-build --project-name CODEBUILD_PROJECT_NAME
```

---

## Media Seeding

The `npm run seed:media` script copies `site-assets/content/media/` to `apps/site/public/media/` so Astro's dev server can serve images.

Run it any time you add new images to the content store:
```powershell
npm run seed:media
```

This is also run automatically during CodeBuild pre-build.

---

## Troubleshooting

**Admin shows "Connection failed"**
- Make sure `npm run dev:api` is running on port 8787.
- Check `VITE_CMS_API_URL` in `apps/cms-admin/.env`.

**Site shows fallback home page**
- `site-assets/content/pages/en/` is missing or empty.
- Run the content copy command (First-Time Setup step 2).

**Images not loading**
- Run `npm run seed:media` to copy media into the Astro public directory.

**Type errors after pulling changes**
- Run `npm --workspace packages/shared run build` first (shared types must be compiled before dependent apps).
