# Architecture

## Overview

Community Site Engine is a **static-site CMS** built for community organisations. The public website is a fully pre-built Astro static site that is rebuilt by AWS CodeBuild whenever content changes. No server renders HTML at request time — CloudFront serves static files directly from S3.

All content editing goes through a private CMS API. The API is the single authority for reading and writing JSON content and media. The public site is never directly written by editors — it is always rebuilt from the stored JSON.

---

## Application Map

```
apps/
  site/          – Astro static site (public, read-only at runtime)
  cms-admin/     – React/Vite admin SPA (authenticated editors)
  cms-api/       – Hono REST API (content + media gateway)
  cms-mcp/       – MCP server (LLM-agent access to the CMS API)
packages/
  shared/        – Zod schemas, TypeScript types, CSS/font utilities
infra/
  production.yml – Single CloudFormation template for a full AWS deployment
scripts/
  copy-media-to-site.mjs – Copies media from site-assets/content/media to apps/site/public/media
```

---

## Data Flow

### Content-to-Site Flow (Production)

```
Editor or AI Agent
  │
  ├─► CMS Admin UI (apps/cms-admin)
  │     └─► CMS API  (apps/cms-api)   ← same API for both paths
  │
  └─► MCP Server (apps/cms-mcp)
        └─► CMS API

CMS API
  ├─► Validates payload against shared Zod schemas
  ├─► Writes JSON / media to private S3 content bucket
  └─► Triggers AWS CodeBuild

CodeBuild
  ├─► git clone public repo (EvgeniGenev/community-site-engine)
  ├─► npm ci
  ├─► aws s3 sync <content-bucket> ./site-assets/content
  ├─► npm run seed:media   (copy media to apps/site/public/media)
  ├─► npm run build:site   (Astro build → apps/site/dist/)
  ├─► aws s3 sync apps/site/dist/ <public-site-bucket>
  └─► CloudFront invalidation → visitors get updated site
```

### Local Development Flow

```
npm run dev:api     → Hono API at :8787  (reads from site-assets/content/)
npm run dev:admin   → Vite admin at :5174 (talks to :8787)
npm run dev:site    → Astro dev at :4321  (reads from site-assets/content/)
```

Content changes through the local admin persist to `site-assets/content/` on disk. To preview on the site, refresh the Astro dev server.

---

## Storage Drivers

The API supports two storage backends, selected by `STORAGE_MODE`:

| Mode | Driver | Used For |
|------|--------|----------|
| `local` (default) | `LocalStorageDriver` | Local dev — reads/writes `site-assets/content/` |
| `s3` | `S3StorageDriver` | Production — reads/writes private S3 content bucket |

Both implement the same `StorageDriver` interface:
```
list(prefix)  → string[]
get(key)      → string | null
put(key, body, contentType?)
putBytes(key, body, contentType)
delete(key)
```

---

## Authentication

Two authentication modes, auto-selected by configuration:

### Local Token Auth (development)
- Tokens stored in `settings/users.json` in the content root.
- Fallback tokens are baked in: `dev-admin-token`, `dev-designer-token`, `dev-contributor-token`.
- Never use in production.

### Cognito JWT Auth (production)
- Admin UI uses PKCE OAuth2 flow with Cognito Hosted UI.
- API verifies RS256 JWT against Cognito JWKS endpoint.
- `custom:role` claim maps to CMS role.
- Dev tokens are disabled automatically when `COGNITO_USER_POOL_ID` is set, unless `CMS_ALLOW_DEV_TOKENS=true`.

---

## Role Model

| Action | Contributor | Designer | Admin |
|--------|-------------|----------|-------|
| Read all content | ✅ | ✅ | ✅ |
| Write events, articles | ✅ | ✅ | ✅ |
| Upload / delete media | ✅ | ✅ | ✅ |
| Update page text (not structure) | ✅ | ✅ | ✅ |
| Create / restructure pages | ❌ | ✅ | ✅ |
| Write live CSS stylesheets | ❌ | ✅ | ✅ |
| Manage settings & users | ❌ | ❌ | ✅ |

---

## Content Model

All content is stored as JSON validated by Zod schemas from `packages/shared`.

### Content Layout on Disk / S3

```
site-assets/content/
  pages/<locale>/<slug>.json         – page documents
  articles/<locale>/<slug>.json      – article documents
  events/<slug>.json                 – event documents (locale-neutral, with translations map)
  gallery/gallery-items.json         – gallery array
  navigation/<locale>/main.json      – main navigation tree
  settings/site.json                 – site-wide settings
  settings/users.json                – local dev users (not used with Cognito)
  styles/*.css                       – live CSS files loaded by every page
  media/**                           – uploaded images
  drafts/…                           – draft copies (before publish)
  snapshots/…                        – timestamped snapshots (created on publish)
```

### Content Types

| Type | Key fields |
|------|-----------|
| `Page` | `id`, `locale`, `status`, `slug`, `translationKey`, `layout`, `blocks[]` |
| `Article` | `id`, `locale`, `status`, `slug`, `date`, `category`, `excerpt`, `body` |
| `Event` | `id`, `status`, `slug`, `startsAt`, `endsAt`, `locationName`, `address`, `translations` |
| `Gallery` | Array of `GalleryItem` (MediaRef + `status`, `tags`) |
| `Navigation` | `locale`, `items[]` (recursive tree) |
| `SiteSettings` | `name`, `tagline`, `description`, `defaultLocale`, `supportedLanguages`, `fonts`, `contactEmail`, `social` |

### Page Blocks

Pages are composed of typed content blocks:

| Block | Purpose |
|-------|---------|
| `hero` | Large header with title, eyebrow, body, image, and action buttons |
| `richText` | Markdown body (h2, h3, ul, bold, italic, links) |
| `cardGrid` | Grid of title+body+image cards |
| `gallery` | Photo gallery with lightbox (pulls from gallery collection) |
| `eventList` | Calendar view + event list |
| `articleList` | Article card grid |
| `cta` | Call-to-action with title, body, and action buttons |

Each block supports optional `customCss` (declaration-only, validated by schema) and `layoutColumn` for multi-column layouts.

---

## Multilingual Support

- Site settings define `supportedLanguages` (list of `{ code, name, nativeName }`).
- Pages and articles exist per-locale: `pages/en/home.json`, `pages/bg/home.json`.
- `translationKey` links the same logical page across locales.
- Events are locale-neutral with an optional `translations` map for locale-specific field overrides.
- Gallery items similarly use a `translations` map on each `MediaRef`.
- The Astro site uses `[locale]/[...slug].astro` for non-default locales.
- English routes are top-level (`/`, `/about-us/`); other locales are prefixed (`/bg/`, `/bg/about-us/`).
- Navigation is stored per locale: `navigation/<locale>/main.json`. The site falls back to `navigation/en/main.json` if a locale-specific file is missing.

---

## CSS Management

There are two layers:

1. **Block-level `customCss`** (Admin/Designer only): Declaration-only CSS applied inline to a single page section. Validated: no selectors, braces, at-rules, `url()`, or `javascript:`.

2. **Site-level stylesheets** in `styles/*.css` (Admin/Designer only): Full selector-based CSS files. Every `.css` file under `styles/` is loaded into every public page, in alphabetical order with `site.css` first. The default editable override file is `styles/site-custom.css`.

---

## MCP Server

`apps/cms-mcp` is an MCP server (Model Context Protocol) that exposes the CMS API as AI agent tools. It connects to the CMS API via HTTP and provides 20+ tools including:

- Content CRUD (list, read, write, publish, delete)
- Media upload
- CSS read/write
- User management
- Facebook event import
- CodeBuild trigger

The MCP server does not bypass validation — it calls the CMS API like any other client.

---

## AWS Infrastructure (Production)

Defined in `infra/production.yml` (CloudFormation). Key resources:

| Resource | Purpose |
|----------|---------|
| S3 content bucket (private) | Stores CMS JSON + media |
| S3 public-site bucket (private, CloudFront origin) | Serves static site |
| S3 admin bucket (private, CloudFront origin) | Serves admin SPA |
| CloudFront (public site) | CDN for public site |
| CloudFront (admin) | CDN for admin UI |
| Cognito User Pool | Production authentication |
| Lambda + API Gateway | Hosts CMS API |
| CodeBuild project | Builds and deploys static site |

See `docs/AWS_DEPLOYMENT.md` for full deployment runbook.

---

## Live Site: Bulgarian Heritage Center of Arizona (BHCAZ)

The deployed instance of this engine serves the BHCAZ website:

- **Site name**: Bulgarian Heritage Center of Arizona
- **Languages**: English (`en`), Bulgarian (`bg`)
- **Event timezone**: `America/Phoenix`
- **Contact**: info@bhcaz.org
- **Social**: Facebook (https://www.facebook.com/profile.php?id=61579826025122)
- **Content pages** (English): home, about-us, mission-and-values, events, gallery, news-articles, projects, volunteers, sponsors, advertising-with-bhcaz, contact-us, donations

Private site content lives in `site-assets-private-backup-20260501-211224/` locally and is **never committed to the public GitHub repository**. The working content is in `site-assets/content/` which is also gitignored.
