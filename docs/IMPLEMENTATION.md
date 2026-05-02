# Implementation Overview

Community Site Engine is a generic static-site CMS starter. It is designed so code can be public while private site content and media stay outside the repository.

## Architecture

```text
CMS Admin UI
  -> CMS API
  -> private S3 content bucket
  -> CodeBuild
  -> Astro static build
  -> private public-site S3 origin
  -> CloudFront
  -> visitors
```

The public site is static. The CMS API is only for authenticated editors and agents.

## Code Workspaces

- `apps/site`: Astro static website.
- `apps/cms-admin`: React/Vite admin UI.
- `apps/cms-api`: Hono API with local and S3 storage adapters.
- `apps/cms-mcp`: MCP server for LLM-agent workflows.
- `packages/shared`: Zod schemas and shared TypeScript types.

## Asset Root

Private content and media live under:

```text
site-assets/content/
```

This directory is ignored by Git and should be synced to the private CMS content S3 bucket.

Expected content layout:

```text
site-assets/content/
  pages/<locale>/*.json
  articles/<locale>/*.json
  events/*.json
  gallery/gallery-items.json
  navigation/<locale>/main.json
  settings/site.json
  media/**
  styles/*.css
```

## Local Development

```powershell
npm install
npm run seed:media
npm run dev:api
npm run dev:admin
npm run dev:site
```

Local URLs:

- Static site: `http://localhost:4321`
- CMS Admin: `http://localhost:5174`
- CMS API: `http://localhost:8787/health`

Development role tokens:

```text
Admin: dev-admin-token
Designer: dev-designer-token
Contributor: dev-contributor-token
```

Development tokens are disabled automatically when `COGNITO_USER_POOL_ID` is configured unless `CMS_ALLOW_DEV_TOKENS=true` is explicitly set. Do not enable development tokens in production.

## Roles

- `Contributor`: create/update/delete events; create/update/delete articles; upload/delete images for events, articles, and gallery; update existing page content without changing page structure.
- `Designer`: all Contributor permissions plus create, modify, and delete pages and page structure.
- `Admin`: all permissions, including settings and user management.

The API enforces these rules. The admin UI hides unavailable controls, but security does not depend on the UI.

## Content Model

Public pages are JSON documents composed of controlled blocks:

- `hero`
- `richText`
- `cardGrid`
- `gallery`
- `eventList`
- `articleList`
- `cta`

This avoids arbitrary HTML and keeps rendering predictable.

Pages, articles, events, and gallery images support draft/published status. Only published items render on the public site.

## CSS Management

There are two CSS controls:

- Page section `customCss`: Admin/Designer-only declaration CSS on a single page block.
- `site-assets/content/styles/*.css`: Admin/Designer live-site stylesheets for selector-based CSS.

Both are validated before save. Every CSS file under `styles/` is loaded into every public page.

## Publishing Model

1. Editor updates JSON/media through Admin or MCP.
2. API validates the payload against shared schemas.
3. API writes content to local storage or the private CMS content S3 bucket.
4. API starts the configured CodeBuild project.
5. CodeBuild syncs CMS content from S3 to `site-assets/content`.
6. CodeBuild builds Astro and syncs `apps/site/dist` to the public-origin S3 bucket.
7. CodeBuild creates a CloudFront invalidation.

CodeBuild should have `ConcurrentBuildLimit=1` to prevent overlapping deploys.

## Production Environment

CMS API environment:

```text
STORAGE_MODE=s3
CMS_CONTENT_BUCKET=<private-content-bucket>
CMS_CONTENT_PREFIX=<optional-prefix>
COGNITO_USER_POOL_ID=<pool-id>
COGNITO_REGION=<region>
COGNITO_APP_CLIENT_ID=<app-client-id>
ADMIN_ALLOWED_ORIGINS=https://admin.example.com
CMS_ALLOW_DEV_TOKENS=false
MAX_MEDIA_BYTES=10485760
CODEBUILD_PROJECT_NAME=<codebuild-project-name>
CODEBUILD_QUEUED_TIMEOUT_MINUTES=30
```

## Security Notes

- Use Cognito JWT authentication in production.
- Keep private content and public-origin S3 buckets private.
- Configure `ADMIN_ALLOWED_ORIGINS` to exact Admin origins.
- The API validates storage keys, rejects unsafe URL schemes, blocks SVG uploads, and limits media types to JPEG, PNG, WebP, and GIF.
- CodeBuild should only read the CMS content bucket, write/delete public-site origin objects, and invalidate the configured CloudFront distribution.
- Keep live CSS editing limited to trusted Admin/Designer users.
