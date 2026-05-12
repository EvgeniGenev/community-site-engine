# Content API Specifications

This document defines the exact JSON payload structures, field-level requirements, and validation rules for all content objects managed by the **Community Site Engine** API. 

All endpoints that write or validate content (such as `/api/object/*` and `/api/validate/*` routes, as well as their MCP tool counterparts `cms_write` and `cms_validate`) enforce these specifications using shared runtime schemas defined in `@community-site-engine/shared`.

---

## Common Sub-Structures

Several recurring structures are embedded within primary content objects.

### `MediaRef`
References an uploaded image or media asset along with accessibility metadata and optional localized overrides.

```json
{
  "src": "/media/gallery/example.jpg",
  "alt": "Descriptive alternative text for screen readers",
  "caption": "Displayed below the image in gallery views",
  "description": "Extended background or internal description",
  "translations": {
    "bg": {
      "alt": "Примерен алтернативен текст",
      "caption": "Показва се под изображението"
    }
  }
}
```
- **`src`** *(string, required)*: Must be a safe, relative or `http(s)` URL. Unsafe schemes (e.g. `javascript:`) are rejected.
- **`alt`** *(string, required)*: Cannot be empty.
- **`caption`**, **`description`** *(string, optional)*.
- **`translations`** *(object, optional)*: Keyed by locale codes (e.g., `"bg"`), allowing localization of text properties.

### `Link`
Defines a navigation link or call-to-action button.

```json
{
  "label": "Read Our Story",
  "href": "/about-us/",
  "variant": "primary"
}
```
- **`label`** *(string, required)*: Display text.
- **`href`** *(string, required)*: Valid link URL. Relative paths, absolute `http(s)` URLs, `mailto:` links, or anchors (`#`) are permitted.
- **`variant`** *(string, optional)*: Button styling variant. Allowed values: `"primary"`, `"secondary"`, `"plain"`. Defaults to `"primary"`.

### `Seo`
Search Engine Optimization metadata required for routable pages and articles.

```json
{
  "title": "Page Title | Site Name",
  "description": "Concise summary for search engine results pages."
}
```
- **`title`**, **`description`** *(string, required)*: Must be non-empty strings.

### `CustomCss`
An optional property supported on all block types to allow inline layout tweaks.
- **`customCss`** *(string, optional)*: Semicolon-separated CSS property/value declarations (e.g. `background: #f4f4f4; padding-top: 2rem;`). Selectors, braces, comments, and unsafe values (`expression()`, `url()`, `javascript:`) are strictly forbidden.

---

## Primary Content Types

### 1. Pages (`pages/<locale>/<slug>.json`)
Pages define modular layouts assembled from sequential content blocks.

#### Top-Level Schema
```json
{
  "id": "about-us",
  "locale": "en",
  "status": "published",
  "title": "About Us",
  "slug": "about-us",
  "translationKey": "about-us",
  "seo": {
    "title": "About Us | Organization name",
    "description": "Learn about our mission, history, and community leadership."
  },
  "layout": {
    "columns": [
      { "id": "main", "label": "Main Content", "width": 100 }
    ]
  },
  "blocks": [...]
}
```
- **`id`** *(string, required)*: Unique string identity.
- **`locale`** *(string, required)*: Target language code.
- **`status`** *(string, required)*: `"draft"` or `"published"`.
- **`title`** *(string, required)*: Internal and header fallback title.
- **`slug`** *(string, required)*: URL segment. Use `""` (empty string) for the homepage.
- **`translationKey`** *(string, required)*: Shared key linking localized variants of the same conceptual page.
- **`layout`** *(object, required)*: Contains an array of 1 to 3 column descriptors (`{ id, label, width }`).
- **`blocks`** *(array, required)*: Ordered list of section blocks.

#### Page Block Types
Every block object includes a discriminated **`type`** literal, an optional **`layoutColumn`** string referencing a column ID from `layout.columns`, and optional **`customCss`**.

| Block Type | Specific Fields | Description |
|---|---|---|
| **`hero`** | `eyebrow?` (str)<br>`title?` (str)<br>`body?` (str)<br>`image?` (`MediaRef`)<br>`actions` (`Link[]`, default `[]`) | Prominent introductory banner. |
| **`richText`** | `title?` (str)<br>`body` (str, required) | Primary prose section. `body` accepts full standard Markdown. |
| **`cardGrid`** | `title?` (str)<br>`intro?` (str)<br>`cards` (array of `{ title, body, image?, href? }`) | Feature matrices or multi-column highlights. |
| **`gallery`** | `title?` (str)<br>`intro?` (str)<br>`items` (`MediaRef[]`, default `[]`) | Inline image grid or carousel. |
| **`eventList`** | `title?` (str)<br>`intro?` (str)<br>`eventIds` (str[], default `[]`)<br>`showCalendar?` (bool, default `true`) | Dynamic event listings. An empty `eventIds` array fetches all future events automatically. |
| **`articleList`**| `title?` (str)<br>`intro?` (str)<br>`articleIds` (str[], default `[]`) | Dynamic news feed. An empty `articleIds` array lists all published articles. |
| **`cta`** | `title?` (str)<br>`body?` (str)<br>`actions` (`Link[]`, default `[]`) | Call-To-Action banner. |
| **`fileList`** | `title?` (str)<br>`intro?` (str)<br>`files` (`FileItem[]`, default `[]`) | Downloadable document directory. |

#### `FileItem` Sub-Schema (for `fileList` blocks)
```json
{
  "src": "/media/files/1700000000-bylaws.pdf",
  "label": "Organization Bylaws",
  "description": "Official governing bylaws adopted in 2024.",
  "translations": {
    "bg": {
      "label": "Устав на организацията",
      "description": "Официален устав, приет през 2024 г."
    }
  }
}
```

---

### 2. Navigation (`navigation/<locale>/main.json`)
Defines the multi-level site menu hierarchy per language.

```json
{
  "locale": "en",
  "items": [
    {
      "label": "About",
      "href": "/about-us/",
      "children": [
        {
          "label": "Leadership",
          "href": "/about-us/#leadership",
          "children": []
        }
      ]
    }
  ]
}
```
- **`items`** *(array, required)*: Recursive tree structure. Each node requires **`label`** (string), **`href`** (safe URL string), and **`children`** (array of child nodes). Supports up to two levels of nesting.

---

### 3. Events (`events/<slug>.json`)
Centralized, locale-neutral records for calendaring. Translated overlays are directly nested.

```json
{
  "id": "spring-festival-2026",
  "status": "published",
  "title": "Spring Heritage Festival",
  "slug": "spring-festival-2026",
  "startsAt": "2026-05-24T10:00:00-07:00",
  "endsAt": "2026-05-24T18:00:00-07:00",
  "locationName": "Civic Center Park",
  "address": "100 Park Ave, Scottsdale, AZ",
  "image": {
    "src": "/media/events/festival-cover.jpg",
    "alt": "Dancers in traditional folklore costumes"
  },
  "description": "Full multi-line description text detailing scheduled activities and performers.",
  "notes": "Internal admin reminder: ensure audio tech arrives by 8 AM.",
  "translations": {
    "bg": {
      "title": "Пролетен фолклорен фестивал",
      "locationName": "Парк Сивик Център",
      "description": "Пълно описание на български език..."
    }
  }
}
```
- **`startsAt`** *(string, required)*: ISO 8601 formatted timestamp including specific timezone offset corresponding to the configured `eventTimeZone`.
- **`description`** *(string, required)*: Text descriptions preserve line breaks for clean multi-paragraph rendering.

---

### 4. Articles (`articles/<locale>/<slug>.json`)
Time-stamped blog posts or news publications.

```json
{
  "id": "community-grant-award",
  "locale": "en",
  "status": "published",
  "title": "Center Receives 2026 Cultural Preservation Grant",
  "slug": "community-grant-award",
  "date": "2026-04-15",
  "category": "Announcements",
  "excerpt": "We are thrilled to announce a new grant supporting our archival project.",
  "featuredImage": {
    "src": "/media/articles/grant-check.jpg",
    "alt": "Board members receiving grant check"
  },
  "body": "Full Markdown document body...\n\n## Future Plans\n...",
  "seo": {
    "title": "Cultural Preservation Grant Award | News",
    "description": "Announcement regarding our new state cultural grant."
  }
}
```
- **`date`** *(string, required)*: ISO short date format (`YYYY-MM-DD`).
- **`category`**, **`excerpt`**, **`body`** *(string, required)*.

---

### 5. Gallery Collections
Images managed in the media library exist in two primary formats.

#### Legacy Global List (`gallery/gallery-items.json`)
A flat array of published media items used as the global pool.
- Items are standard `MediaRef` objects extended with **`id?`** (string), **`status`** (`"draft" | "published"`, defaults to `"published"`), and **`tags`** (array of strings, defaults to `[]`).

#### Named Albums (`gallery/<id>.json`)
Structured albums introduced to categorize photos independently.
```json
{
  "id": "folk-dance-troupe",
  "title": "Folklore Dance Troupe Performances",
  "description": "Highlights from our annual performance tour.",
  "status": "published",
  "coverImage": "/media/gallery/album-cover.jpg",
  "items": [
    {
      "src": "/media/gallery/performance1.jpg",
      "alt": "Stage performance in Phoenix",
      "status": "published",
      "tags": ["dance", "stage"]
    }
  ]
}
```
- **`id`**, **`title`** *(string, required)*.
- **`status`** *(string, optional)*: Defaults to `"published"`.
- **`items`** *(array, required)*: Array of extended `GalleryItem` references.

---

### 6. Site Settings (`settings/site.json`)
Global configuration payload managing identity, defaults, and integrations.

```json
{
  "name": "Site name",
  "tagline": "Preserving and celebrating culture.",
  "description": "Official web home of our organization.",
  "siteIcon": {
    "src": "/media/settings/logo.svg",
    "alt": "Site Logo"
  },
  "defaultLocale": "en",
  "supportedLanguages": [
    { "code": "en", "name": "English", "nativeName": "English" },
    { "code": "bg", "name": "Bulgarian", "nativeName": "Български" }
  ],
  "eventTimeZone": "America/Phoenix",
  "headerMaxWidth": 1160,
  "fonts": {
    "default": "universal-serif",
    "headings": "outfit-sans"
  },
  "contactEmail": "info@domain.org",
  "social": [
    { "label": "Facebook", "href": "https://facebook.com/domain" }
  ]
}
```
- **`supportedLanguages`** *(array, required)*: Adding objects to this list immediately generates localized page skeletons and routes.
- **`eventTimeZone`** *(string, required)*: Valid IANA timezone identifier.
- **`headerMaxWidth`** *(number, optional)*: Pixel constraint applied to layout shells (range: `600` to `2400`).
- **`fonts`** *(object, required)*: Maps structural areas (`default`, `headings`, `navigation`, `page`, etc.) to available `FontId` presets declared in the layout system. Validated to ensure chosen fonts support characters for all active language codes.
