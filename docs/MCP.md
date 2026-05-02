# Community Site Engine MCP Server

The MCP server lets an LLM agent control the CMS through the same authenticated CMS API used by the admin UI.

## Tools

- `cms_list`: list content in `pages`, `articles`, `events`, `navigation`, or `settings`.
- `cms_read`: read one content object by key.
- `cms_validate`: validate JSON against the shared CMS schema.
- `cms_write`: validate and write a CMS object. New pages and articles are automatically created in every supported language.
- `cms_create_multilingual_page`: create a page in every supported language from one base page.
- `cms_create_multilingual_article`: create an article in every supported language from one base article.
- `cms_write_page_content`: update page content without changing page identity or block structure.
- `cms_publish`: publish a draft by copying draft content into the live content path.
- `cms_delete`: delete content, subject to role permissions.
- `cms_upload_media`: upload base64 image media into gallery, event, article, or settings storage.
- `cms_import_facebook_event`: fetch a public Facebook event/share URL and return an unsaved draft event from public metadata.
- `cms_get_css`: read the default admin-managed live-site CSS override stylesheet.
- `cms_list_css_files`: list every CSS file loaded by the live public site.
- `cms_read_css_file`: read a specific live-site CSS file, for example `styles/site.css`.
- `cms_validate_css`: validate a full selector-based CSS stylesheet without saving.
- `cms_write_css`: validate and save the default live-site CSS override stylesheet.
- `cms_write_css_file`: validate and save a specific live-site CSS file.
- `cms_list_users`: list Cognito users when configured, otherwise local development users.
- `cms_upsert_user`: add or update a Cognito/local user.
- `cms_delete_user`: delete a Cognito/local user.
- `cms_reset_user_password`: reset a Cognito password as temporary/permanent, or reset a local dev token.
- `cms_trigger_build`: start the configured AWS CodeBuild site build/deploy.
- `cms_me`: return the authenticated CMS user and role.

The MCP server intentionally does not bypass validation or storage rules. It calls the CMS API.

## Local Setup

Start the CMS API first:

```powershell
npm run dev:api
```

Run the MCP server:

```powershell
$env:CMS_API_URL="http://localhost:8787"
$env:CMS_ADMIN_TOKEN="dev-admin-token"
npm --workspace apps/cms-mcp run dev
```

For production, set:

```text
CMS_API_URL=https://admin-api.example.com
CMS_ADMIN_TOKEN=<Cognito JWT for the agent role>
NODE_ENV=production
```

In production the MCP server will not fall back to `dev-admin-token`; `CMS_ADMIN_TOKEN` must be explicitly provided. Use a Cognito user/role appropriate for the agent instead of sharing a human admin session token.

Development role tokens:

```text
Admin: dev-admin-token
Designer: dev-designer-token
Contributor: dev-contributor-token
```

Contributor agents should use `cms_write_page_content` for page updates. Designers/admins can use `cms_write` for full page structure changes.
Events and gallery images are shared records with optional `translations` maps. Add localized text under `translations.<locale>`; any missing translated field falls back to the English base field on the public site.
Page blocks support an optional `customCss` field for declaration-only section styling, such as `background: #fff7ec; border-radius: 24px;`. Selectors, braces, at-rules, comments, `url()`, `javascript:`, and `expression()` are rejected by schema validation.
Live-site stylesheets are managed separately through the CSS tools. Use `cms_list_css_files` to discover available files, `cms_read_css_file` to inspect one, `cms_validate_css` to check edits, and `cms_write_css_file` to save a specific file. The shorthand `cms_get_css` / `cms_write_css` targets `styles/site-custom.css`.

## MCP Client Configuration

Use a command like this after `npm install` and `npm run build`:

```json
{
  "mcpServers": {
    "community-site-engine": {
      "command": "node",
      "args": [
        "C:/path/to/community-site-engine/apps/cms-mcp/dist/server.js"
      ],
      "env": {
        "CMS_API_URL": "http://localhost:8787",
        "CMS_ADMIN_TOKEN": "dev-admin-token"
      }
    }
  }
}
```

## Example Agent Workflow

1. Use `cms_list` with `{ "collection": "pages", "locale": "en" }`.
2. Use `cms_read` with a key like `pages/en/events.json`.
3. Modify the JSON.
4. Use `cms_validate`.
5. Use `cms_write`; new pages/articles will be expanded across supported languages automatically.
6. Use `cms_trigger_build` to start the CodeBuild site deployment.

## Security Notes

- Treat `CMS_ADMIN_TOKEN` like a password or bearer session token.
- Use separate tokens for humans and agents in production.
- Use the lowest role that can complete the agent task; only Admin tokens can manage users or raw settings JSON.
- Scope the CMS API IAM role to the CMS content bucket only.
- Prefer draft writes and explicit publish workflows for autonomous agents.
- Log all MCP/API write and publish operations in production.
