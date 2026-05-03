#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CmsClient, CollectionSchema, validateContent } from "./cmsClient.js";

const apiUrl = process.env.CMS_API_URL ?? "http://localhost:8787";
const token = process.env.CMS_ADMIN_TOKEN ?? (process.env.NODE_ENV === "production" ? "" : "dev-admin-token");
if (!token) {
  throw new Error("CMS_ADMIN_TOKEN is required when running the CMS MCP server in production.");
}
const cms = new CmsClient({ baseUrl: apiUrl, token });

function jsonText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

const server = new McpServer({
  name: "community-site-engine",
  version: "0.1.0"
});

server.registerTool(
  "cms_me",
  {
    title: "Current CMS user",
    description: "Return the authenticated CMS user and role for this MCP connection.",
    inputSchema: {}
  },
  async () => jsonText(await cms.me())
);

server.registerTool(
  "cms_list",
  {
    title: "List CMS content",
    description: "List content JSON objects in a CMS collection, optionally scoped by locale.",
    inputSchema: {
      collection: CollectionSchema,
      locale: z.string().min(2).optional()
    }
  },
  async ({ collection, locale }) => jsonText(await cms.list(collection, locale))
);

server.registerTool(
  "cms_read",
  {
    title: "Read CMS object",
    description: "Read one CMS JSON object by storage key, for example pages/en/about-us.json.",
    inputSchema: {
      key: z.string().min(1)
    }
  },
  async ({ key }) => jsonText(await cms.read(key))
);

server.registerTool(
  "cms_validate",
  {
    title: "Validate CMS JSON",
    description: "Validate a JSON object against the CMS schema without saving it.",
    inputSchema: {
      collection: CollectionSchema,
      data: z.unknown()
    }
  },
  async ({ collection, data }) => jsonText({ ok: true, data: validateContent(collection, data) })
);

server.registerTool(
  "cms_write",
  {
    title: "Write CMS object",
    description: "Validate and write a CMS JSON object to the selected collection and key. New pages and articles are automatically created across all supported languages by the CMS API.",
    inputSchema: {
      collection: CollectionSchema,
      key: z.string().min(1),
      data: z.unknown()
    }
  },
  async ({ collection, key, data }) => jsonText(await cms.write(collection, key, validateContent(collection, data)))
);

server.registerTool(
  "cms_create_multilingual_page",
  {
    title: "Create multilingual page",
    description: "Create a page in every supported language using one base page. Non-source languages are created as placeholders with language code suffixes.",
    inputSchema: {
      basePage: z.unknown()
    }
  },
  async ({ basePage }) => jsonText(await cms.createMultilingualPage(validateContent("pages", basePage)))
);

server.registerTool(
  "cms_create_multilingual_article",
  {
    title: "Create multilingual article",
    description: "Create an article in every supported language using one base article. Non-source languages are created as placeholders with language code suffixes.",
    inputSchema: {
      baseArticle: z.unknown()
    }
  },
  async ({ baseArticle }) => jsonText(await cms.createMultilingualArticle(validateContent("articles", baseArticle)))
);

server.registerTool(
  "cms_write_page_content",
  {
    title: "Write page content only",
    description: "Update a page while preserving page identity and section structure. Contributors should use this instead of cms_write for pages.",
    inputSchema: {
      key: z.string().min(1),
      data: z.unknown()
    }
  },
  async ({ key, data }) => jsonText(await cms.writePageContent(key, validateContent("pages", data)))
);

server.registerTool(
  "cms_publish",
  {
    title: "Publish CMS draft",
    description: "Publish a draft by copying draftKey to contentKey through the CMS API.",
    inputSchema: {
      draftKey: z.string().min(1),
      contentKey: z.string().min(1)
    }
  },
  async ({ draftKey, contentKey }) => jsonText(await cms.publish(draftKey, contentKey))
);

server.registerTool(
  "cms_delete",
  {
    title: "Delete CMS object",
    description: "Delete a CMS object by collection and key, subject to role permissions.",
    inputSchema: {
      collection: CollectionSchema,
      key: z.string().min(1)
    }
  },
  async ({ collection, key }) => jsonText(await cms.delete(collection, key))
);

server.registerTool(
  "cms_upload_media",
  {
    title: "Upload media",
    description: "Upload a base64-encoded image into gallery, events, or articles media storage.",
    inputSchema: {
      filename: z.string().min(1),
      contentType: z.string().min(1),
      base64: z.string().min(1),
      folder: z.enum(["gallery", "events", "articles", "settings"])
    }
  },
  async (input) => jsonText(await cms.uploadMedia(input))
);

server.registerTool(
  "cms_import_facebook_event",
  {
    title: "Import Facebook event",
    description: "Fetch a public Facebook event/share URL and return a draft CMS event populated from public metadata. Requires contributor, designer, or admin token.",
    inputSchema: {
      url: z.string().url(),
      timeZone: z.string().min(1).optional()
    }
  },
  async (input) => jsonText(await cms.importFacebookEvent(input))
);

server.registerTool(
  "cms_get_css",
  {
    title: "Get live site CSS",
    description: "Read the default admin-managed live site CSS override stylesheet.",
    inputSchema: {}
  },
  async () => jsonText(await cms.getCss())
);

server.registerTool(
  "cms_list_css_files",
  {
    title: "List live site CSS files",
    description: "List every CSS file loaded by the live public site.",
    inputSchema: {}
  },
  async () => jsonText(await cms.listCssFiles())
);

server.registerTool(
  "cms_read_css_file",
  {
    title: "Read live site CSS file",
    description: "Read one CSS file loaded by the live public site, for example styles/site.css.",
    inputSchema: {
      key: z.string().min(1)
    }
  },
  async ({ key }) => jsonText(await cms.readCssFile(key))
);

server.registerTool(
  "cms_validate_css",
  {
    title: "Validate live site CSS",
    description: "Validate a full selector-based CSS stylesheet without saving it.",
    inputSchema: {
      css: z.string()
    }
  },
  async ({ css }) => jsonText(await cms.validateCss(css))
);

server.registerTool(
  "cms_write_css",
  {
    title: "Write live site CSS",
    description: "Validate and save the default admin-managed live site CSS override stylesheet. Requires an admin or designer token.",
    inputSchema: {
      css: z.string()
    }
  },
  async ({ css }) => jsonText(await cms.writeCss(css))
);

server.registerTool(
  "cms_write_css_file",
  {
    title: "Write live site CSS file",
    description: "Validate and save a specific CSS file loaded by the live public site. Requires an admin or designer token.",
    inputSchema: {
      key: z.string().min(1),
      css: z.string()
    }
  },
  async ({ key, css }) => jsonText(await cms.writeCssFile(key, css))
);

server.registerTool(
  "cms_list_users",
  {
    title: "List CMS users",
    description: "List users from Cognito when configured, otherwise from the local development users file. Requires admin token.",
    inputSchema: {}
  },
  async () => jsonText(await cms.listUsers())
);

server.registerTool(
  "cms_upsert_user",
  {
    title: "Add or update CMS user",
    description: "Add or update a user in Cognito when configured, otherwise in the local development users file. Requires admin token.",
    inputSchema: {
      id: z.string().min(1),
      name: z.string().min(1),
      role: z.enum(["admin", "designer", "contributor"]),
      email: z.string().email().optional(),
      token: z.string().min(12).optional(),
      temporaryPassword: z.string().min(8).optional(),
      suppressEmail: z.boolean().optional()
    }
  },
  async (input) => jsonText(await cms.upsertUser(input))
);

server.registerTool(
  "cms_delete_user",
  {
    title: "Delete CMS user",
    description: "Delete a user from Cognito when configured, otherwise from the local development users file. Requires admin token.",
    inputSchema: {
      id: z.string().min(1)
    }
  },
  async ({ id }) => jsonText(await cms.deleteUser(id))
);

server.registerTool(
  "cms_reset_user_password",
  {
    title: "Reset CMS user password",
    description: "Reset a user's Cognito password as temporary or permanent. In local development, resets the user's dev token. Requires admin token.",
    inputSchema: {
      id: z.string().min(1),
      password: z.string().min(8).optional(),
      permanent: z.boolean().optional()
    }
  },
  async ({ id, password, permanent }) => jsonText(await cms.resetUserPassword(id, { password, permanent }))
);

server.registerTool(
  "cms_trigger_build",
  {
    title: "Trigger static site build",
    description: "Start the configured AWS CodeBuild project to rebuild/deploy the static site.",
    inputSchema: {}
  },
  async () => jsonText(await cms.triggerBuild())
);

server.registerTool(
  "cms_backup",
  {
    title: "Download site backup",
    description: "Download a full site backup as a ZIP archive. The ZIP is saved to the local tmp/ directory. Returns the file path and size. Requires admin token.",
    inputSchema: {
      outputDir: z.string().min(1).optional()
    }
  },
  async ({ outputDir }) => jsonText(await cms.backup(outputDir))
);

server.registerTool(
  "cms_restore",
  {
    title: "Restore site from backup",
    description: "Restore all site content from a previously downloaded backup ZIP file. This overwrites all current content. A pre-restore snapshot is created automatically. Requires admin token.",
    inputSchema: {
      zipPath: z.string().min(1)
    }
  },
  async ({ zipPath }) => jsonText(await cms.restore(zipPath))
);

const transport = new StdioServerTransport();
await server.connect(transport);
