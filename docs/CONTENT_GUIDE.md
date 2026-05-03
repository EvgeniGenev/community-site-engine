# Content Editing Guide

This guide covers how to create and update content through the Admin UI, MCP tools, or directly as JSON files.

---

## Admin UI

Access the admin at `http://localhost:5174` (local) or the CloudFront admin domain (production).

**Tabs:**

| Tab | What you can do |
|-----|----------------|
| Pages | Create, edit, preview, and publish pages. Manage blocks and layout. |
| Menu | Edit the navigation tree for each locale. |
| Events | Create, edit, import from Facebook, and publish events. |
| Articles | Create, edit, and publish news articles. |
| Gallery | Upload images, edit captions/alt text, publish/draft items. |
| CSS | Edit live-site CSS stylesheets. |
| Settings | Edit site name, contact info, languages, fonts, social links. |
| Users | Add/remove/reset users (Admin only). |
| JSON | Raw JSON editor for any content key (Admin/Designer). |

---

## Status Workflow

All pages, articles, events, and gallery items support `draft` / `published` status.

- **Draft** items are saved but are never rendered on the public site.
- **Published** items render on the public site after the next CodeBuild deploy.
- Saving a published item through Admin automatically triggers a CodeBuild build.

---

## Pages

A page is a JSON document with a list of **blocks**. The public site renders blocks sequentially.

### Creating a Page

Minimum required fields:
- `id`: unique identifier (slug format, e.g. `about-us`)
- `locale`: language code (e.g. `en`, `bg`)
- `status`: `draft` or `published`
- `title`: display title
- `slug`: URL path segment (empty string for root/home)
- `translationKey`: links this page to its translations in other locales (use same value as `id`)
- `seo.title` and `seo.description`
- At least one block

### Page Blocks

Add blocks of these types (Admin → Pages → Edit → Add Section):

- **hero** – Large header. Fields: eyebrow, title, body, image, action buttons.
- **richText** – Markdown body. Supports `## h2`, `### h3`, `- list`, `**bold**`, `*italic*`, `[link](url)`.
- **cardGrid** – Grid of cards. Each card has: title, body, optional image, optional link.
- **gallery** – Photo gallery. Pulls automatically from the Gallery tab content.
- **eventList** – Calendar + event list. Leave `eventIds` empty to show all events, or specify specific event IDs.
- **articleList** – Article cards. Leave `articleIds` empty to show all articles.
- **cta** – Call to action. Fields: title, body, action buttons.

### Multi-Column Layout

Pages support 1, 2, or 3 column layouts. Each block is assigned to a column via `layoutColumn`. The Admin page editor lets you drag blocks between columns.

### Translations

When you create a page through Admin or `cms_write`, placeholder copies are automatically created for every supported language in `settings/site.json`. Edit each locale's copy through the Admin by switching the locale selector.

---

## Events

Events are locale-neutral records with an optional `translations` map.

### Creating an Event

Required fields:
- `id`: unique identifier
- `status`: `draft` or `published`
- `title`: event name
- `slug`: URL-friendly ID
- `startsAt`: ISO 8601 datetime with offset (e.g. `2026-05-09T19:00:00-07:00`)
- `description`: event description

Optional:
- `endsAt`: end time
- `locationName`: venue name
- `address`: venue address
- `image`: `{ src, alt }`
- `notes`: internal notes visible to editors
- `translations`: `{ bg: { title, locationName, address, description, notes } }`

### Timezone

All event times are stored and displayed in the timezone from `settings/site.json → eventTimeZone` (currently `America/Phoenix`).

### Facebook Import

In Admin (Events tab), paste a **public** Facebook event URL. The API fetches the page, extracts structured metadata (JSON-LD, Open Graph, meta tags), and creates a draft event. Always verify the time before publishing since Facebook sometimes hides event times from public pages.

The MCP tool `cms_import_facebook_event` does the same thing.

---

## Articles

Articles support full Markdown body content.

Required fields:
- `id`, `locale`, `status`, `title`, `slug`, `date` (YYYY-MM-DD), `category`, `excerpt`, `body`, `seo`

Optional: `featuredImage`

Articles are locale-specific; each locale directory (`articles/en/`, `articles/bg/`) holds its own copies.

---

## Gallery

The gallery is stored as a single JSON array in `gallery/gallery-items.json`.

Each gallery item is a `MediaRef` with additional fields:
- `src`: image path (e.g. `/media/gallery/photo.jpg`)
- `alt`: alt text (required)
- `caption`: displayed below the image
- `status`: `draft` or `published`
- `tags`: array of string tags
- `translations`: locale-specific alt/caption/description

Upload images through the Gallery tab. Uploaded images go to `media/gallery/` in the content store.

---

## Navigation

Navigation is stored per locale: `navigation/<locale>/main.json`.

Structure:
```json
{
  "locale": "en",
  "items": [
    { "label": "Home", "href": "/", "children": [] },
    { "label": "About", "href": "/about-us/", "children": [
      { "label": "Mission", "href": "/mission-and-values/", "children": [] }
    ]}
  ]
}
```

The Admin Menu tab provides a drag-and-drop editor for the tree. The tree supports up to 2 levels of nesting.

---

## Site Settings

`settings/site.json` controls global site behaviour.

Key fields:

| Field | Description |
|-------|-------------|
| `name` | Site display name |
| `tagline` | Short tagline |
| `description` | Meta description fallback |
| `siteIcon` | Favicon/logo image reference |
| `defaultLocale` | Primary locale (e.g. `en`) |
| `supportedLanguages` | Array of `{ code, name, nativeName }` |
| `eventTimeZone` | IANA timezone for event display (e.g. `America/Phoenix`) |
| `fonts` | Font family selections per content area |
| `contactEmail` | Site contact email |
| `social` | Array of social media links |

Adding a new language to `supportedLanguages` enables multilingual routing on the public site and makes the locale available in Admin dropdowns.

---

## CSS

### Block-level CSS

In any page block editor, the `Custom CSS` field accepts CSS declarations (no selectors):
```css
background: #fff7ec; border-radius: 24px; padding: 2rem;
```

This is only editable by Admin or Designer roles.

### Site-level CSS

Go to Admin → CSS tab. Every `.css` file under `styles/` in the content store is loaded into every public page. `site.css` loads first (if present), then files in alphabetical order.

- `site-custom.css` is the default override file shown in the simple CSS editor.
- Use the file selector in the CSS tab to edit specific files.

Full selector-based CSS is allowed in site stylesheets:
```css
.hero h1 { font-size: 3rem; }
@media (max-width: 768px) { .card-grid { grid-template-columns: 1fr; } }
```

---

## Media

Allowed image types: **JPEG, PNG, WebP, GIF**. Maximum 10 MB per upload (configurable via `MAX_MEDIA_BYTES`).

Images are stored under `media/` in the content store. The site copies all media to `apps/site/public/media/` at build time via `npm run seed:media`.

Media subfolders:
- `media/gallery/` – gallery photos
- `media/events/` – event cover images
- `media/articles/` – article featured images
- `media/settings/` – site icon and other site-level images

Upload through Admin (image upload button in any image field or Gallery tab) or through the MCP `cms_upload_media` tool (base64-encoded).

---

## Direct JSON Editing

The Admin JSON tab lets you read and write raw JSON for any content key. This is useful for bulk edits or schema fields not exposed in the form UI.

Via MCP:
```
cms_read { key: "pages/en/home.json" }
cms_validate { collection: "pages", data: {...} }
cms_write { collection: "pages", key: "pages/en/home.json", data: {...} }
cms_publish { draftKey: "drafts/pages/en/home.json", contentKey: "pages/en/home.json" }
```
