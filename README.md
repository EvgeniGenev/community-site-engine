# Community Site Engine

Generic starter for a low-cost community website with a simple custom CMS.

The public repo is intended to contain code only. Site-specific JSON content, media, screenshots, exports, and other private working files live outside the tracked code tree under `site-assets/`.

## What Is Included

- Astro static public site.
- React/Vite admin app.
- Hono CMS API.
- MCP server for LLM-agent control of the CMS.
- S3-backed JSON/media storage.
- Draft/published workflow for pages, events, articles, and gallery images.
- Multilingual content model with fallback to the default language.
- Role model: Contributor, Designer, Admin.
- AWS CodeBuild publishing path for static site rebuilds.

## Directory Layout

- `apps/site/`: public Astro site.
- `apps/cms-admin/`: editor/admin UI.
- `apps/cms-api/`: authenticated content API.
- `apps/cms-mcp/`: MCP server for agent access.
- `packages/shared/`: shared schemas, validation, and types.
- `infra/`: CloudFormation templates.
- `scripts/`: local helper scripts.
- `examples/site-assets/`: generic sample content/media safe for public repos.
- `buildspec.yml`: CodeBuild build/deploy script.
- `site-assets/`: private local content/media and working files; ignored by Git.

## Local Development

```powershell
npm install
npm run seed:media
npm run check
npm run build
```

Run locally:

```powershell
npm run dev:api
npm run dev:admin
npm run dev:site
```

Local URLs:

- Site: `http://localhost:4321`
- CMS Admin: `http://localhost:5174`
- CMS API health: `http://localhost:8787/health`

Development tokens:

```text
Admin: dev-admin-token
Designer: dev-designer-token
Contributor: dev-contributor-token
```

## Assets And Content

By default, local content is read from:

```text
site-assets/content/
```

That directory should contain:

```text
pages/
articles/
events/
gallery/
navigation/
settings/
media/
styles/
```

For production, sync only `site-assets/content` to the private CMS content S3 bucket. Do not commit site-specific assets or content into the public code repository.

To start from the included generic sample content:

```powershell
Copy-Item examples/site-assets site-assets -Recurse
```

After that, edit `site-assets/content` locally or through Admin and sync that private content directory to the CMS content S3 bucket.

## Deployment Docs

- `docs/IMPLEMENTATION.md`: architecture and security overview.
- `docs/AWS_DEPLOYMENT.md`: CloudFormation deployment and operations runbook.
- `docs/MCP.md`: MCP setup and available tools.
- `docs/COST.md`: low-traffic AWS cost notes.
