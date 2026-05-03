# CMS API Reference

Base URL: `http://localhost:8787` (local) or `https://<api-gateway-url>` (production).

All `/api/*` routes require `Authorization: Bearer <token>`.

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Returns `{ ok: true, storageMode: "local"|"s3" }` |

---

## Identity

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me` | Any | Returns authenticated user: `{ id, name, role }` |

---

## Content Collections

Collections: `pages`, `articles`, `events`, `navigation`, `settings`, `gallery`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/list/:collection` | Any | List all items in a collection. Optional `?locale=<code>` query. |
| GET | `/api/object/*` | Any | Read one item by full storage key (e.g. `pages/en/home.json`) |
| PUT | `/api/object/*` | Varies | Write/update an item. Pages and articles auto-create locale siblings. |
| DELETE | `/api/object/*` | Varies | Delete an item by full storage key. |
| POST | `/api/validate/:collection` | Any | Validate JSON against schema without saving. |
| POST | `/api/publish` | Admin/Designer | Publish draft: copies `draftKey` → `contentKey`, creates snapshot. |

### Write permissions by collection

| Collection | Min role |
|-----------|---------|
| `pages` | Designer (full write) / Contributor (`/api/page-content/*` only) |
| `articles` | Contributor |
| `events` | Contributor |
| `navigation` | Designer |
| `gallery` | Contributor |
| `settings` | Admin |

---

## Page Content (Structure-Preserving Write)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/api/page-content/*` | Contributor+ | Update page content only. Block structure and page identity are preserved. |

---

## Multilingual Creation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/create-multilingual-page` | Designer+ | Create a page in every supported language from one base page. |
| POST | `/api/create-multilingual-article` | Designer+ | Create an article in every supported language from one base article. |

---

## Media

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/media` | Contributor+ | Upload image. Body: `{ filename, contentType, base64, folder }`. Folder: `gallery`, `events`, `articles`, `settings`. |
| GET | `/api/media/*` | Any | Proxy to read a stored media file. |
| DELETE | `/api/media/*` | Contributor+ | Delete a media file by path. |

Allowed types: JPEG, PNG, WebP, GIF. Max size: `MAX_MEDIA_BYTES` (default 10 MB). The API validates magic bytes against the declared content type.

---

## CSS

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/css` | Any | Read `styles/site-custom.css` |
| PUT | `/api/css` | Designer+ | Write `styles/site-custom.css` |
| GET | `/api/css/list` | Any | List all CSS files in `styles/` |
| GET | `/api/css/object/*` | Any | Read one CSS file by key |
| PUT | `/api/css/object/*` | Designer+ | Write one CSS file by key |
| POST | `/api/css/validate` | Any | Validate full selector-based CSS without saving |

---

## Facebook Event Import

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/import/facebook-event` | Contributor+ | Fetch public Facebook event page and return draft event JSON. Body: `{ url, timeZone? }` |

---

## Build Trigger

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/build-webhook` | Any (authenticated) | Start CodeBuild project. Returns build ID and status. |

Returns `{ ok: false }` with message if `CODEBUILD_PROJECT_NAME` is not configured.

---

## Users

Requires Admin role. Uses Cognito when `COGNITO_USER_POOL_ID` is configured, otherwise local `settings/users.json`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create/upsert user. Body: `{ id, name, role, email?, token?, temporaryPassword?, suppressEmail? }` |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| POST | `/api/users/:id/reset-password` | Reset password. Body: `{ password?, permanent? }` |
| POST | `/api/users/:id/send-login-email` | Resend Cognito invitation or reset email |

---

## Storage Key Conventions

All content keys follow the structure:

```
<collection>/<locale?>/<slug>.json   – standard content
drafts/<collection>/<locale?>/<slug>.json  – unsaved drafts
snapshots/<timestamp>/<collection>/… – publish snapshots
settings/site.json                    – site settings
settings/users.json                   – local dev users
gallery/gallery-items.json            – gallery array
navigation/<locale>/main.json         – main navigation
styles/<filename>.css                 – CSS files
media/<folder>/<filename>             – images
```

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Validation error or bad input |
| 401 | Missing or invalid token |
| 403 | Insufficient role for this action |
| 404 | Resource not found |
| 413 | Media file too large |
| 422 | Business logic error (e.g. Facebook event date not extractable) |
| 500 | Unexpected server error |

Validation errors from Zod include an `issues` array:
```json
{ "message": "Validation failed", "issues": [...] }
```
