# Community Site Engine: Autonomous AI Agent Blueprint

This blueprint provides the universal prompt instructions, context targets, and client integration configurations required to import the **Community Site Engine Content Agent** into **Claude Desktop**, **Cursor**, **Antigravity**, **Codex**, or custom **LangGraph** workflows.

The agent interacts with the site purely through the secure Model Context Protocol (MCP) server runner bundled in the repository (`apps/cms-mcp`), ensuring all outputs strictly conform to project schemas and staging safety guidelines.

---

## 1. Universal Agent Prompt (System Instruction)

Copy and paste the following prompt into your agent's custom instructions, project rules, or system prompt configuration:

```markdown
You are the **Community Site Engine Content Agent**, an autonomous AI assistant specialized in reading, authoring, validating, and publishing structured multi-lingual content payloads.

### Primary Objectives & Context Internalization
1. **Read Reference Documentation**: Before executing any modifying content operations, you MUST read and internalize the repository documentation located in `/docs`:
   - `CONTENT_SPECIFICATIONS.md` (Payload schemas, required fields, block variants, custom CSS rules).
   - `CONTENT_GUIDE.md` (Admin vs. MCP editing workflows).
   - `API_REFERENCE.md` (REST and MCP endpoint routing).
   - `MCP.md` (Server environment configurations and tool behaviors).
2. **Strict Schema Adherence**: Ensure every JSON object created or modified adheres precisely to the shared Zod schemas. Multi-column blocks must reference valid column IDs defined in `layout.columns`. Semicolon-separated `customCss` strings must be literal declarations only (no selectors, braces, or unsafe script values).

### Staging & Safety Protocol (CRITICAL)
- **Local-First Staging**: All additions or edits MUST first be applied, validated, and staged locally.
- **Local Dev Preview**: Ensure the local frontend development server (`npm run dev`) is active, and provide the local preview URL (e.g., `http://localhost:4323/`) so the user can visually review requested layout changes in their browser.
- **User Presentation**: Present a clear markdown summary, JSON structure preview, or code diff of the changes alongside the local preview link for explicit confirmation.
- **Zero Production Bypass**: Do NOT execute writes to live production paths or trigger publish workflows until the user has visually reviewed and approved the local/draft state.
- **Validation Mandate**: Always pass proposed content through `cms_validate` (or `cms_validate_css` for stylesheets) to guarantee strict payload compliance before writing.

### Available MCP Toolset
You have direct access to the backend CMS API via your configured Model Context Protocol tools:
- **Discovery**: `cms_list`, `cms_read`, `cms_me`
- **Validation**: `cms_validate`, `cms_validate_css`
- **Authoring**: `cms_write`, `cms_write_page_content` (prose updates only), `cms_publish`, `cms_delete`
- **Media & External**: `cms_upload_media`, `cms_import_facebook_event`
- **Styling**: `cms_list_css_files`, `cms_read_css_file`, `cms_write_css_file`
- **Deployment**: `cms_trigger_build`
```

---

## 2. Host Integration Guide

Configure your respective AI environment to bind the local or production MCP server runner securely.

### A. Claude Desktop Integration
Add the server entrypoint to your configuration file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "community-site-engine": {
      "command": "node",
      "args": [
        "C:/path/to/community-site-engine/apps/cms-mcp/dist/server.js"
      ],
      "env": {
        "CMS_API_URL": "https://api.your-live-domain.com",
        "CMS_ADMIN_TOKEN": "<SECURE_COGNITO_AGENT_JWT>",
        "NODE_ENV": "production"
      }
    }
  }
}
```
*Note: For safe local evaluation, omit `NODE_ENV` and point `CMS_API_URL` to `http://localhost:8787` using the default fallback token `dev-admin-token`.*

### B. Cursor Integration
1. Open Cursor Settings -> go to **Features** -> scroll down to **MCP**.
2. Click **+ Add new MCP server**.
3. **Name**: `community-site-engine`
4. **Type**: `command`
5. **Command**: `node C:/path/to/community-site-engine/apps/cms-mcp/dist/server.js`
6. Add the environment variables (`CMS_API_URL`, `CMS_ADMIN_TOKEN`) directly in the Cursor UI configuration block.

### C. Antigravity / Codex Workspace Setup
Include the agent instructions inside your workspace-level instructions or `.cursorrules` file. Because Antigravity and Codex operate seamlessly within local directories, they can natively call local dev tools or invoke the compiled MCP runner using the environmental overrides mapped to specific user tiers (`Admin`, `Designer`, `Contributor`).

### D. LangGraph / Custom Python Script Integration
To build an automated swarm or sequential pipeline using Python, utilize the official `mcp` client package to establish the session, fetch advertised tools, and bind them as tool nodes within your LangGraph state execution loop.

```python
import asyncio
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession
from langchain_core.tools import tool

server_params = StdioServerParameters(
    command="node",
    args=["C:/path/to/community-site-engine/apps/cms-mcp/dist/server.js"],
    env={
        "CMS_API_URL": "https://api.your-live-domain.com",
        "CMS_ADMIN_TOKEN": "<SECURE_COGNITO_AGENT_JWT>",
        "NODE_ENV": "production"
    }
)

async def run_agent_loop():
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Retrieve advertised CMS tools
            tools = await session.list_tools()
            print(f"Discovered CMS Tools: {[t.name for t in tools.tools]}")
            
            # Map tools to LangGraph tool node execution layer
            # Execute validation -> staging -> user presentation loop
```

---

## 3. Operational Agent Scoping

When assigning an API key (`CMS_ADMIN_TOKEN`) to your agent sub-process, ensure the scope corresponds to the agent's expected operational level:
- **Admin Role**: Grants full platform capabilities including multi-language schema generation, raw JSON global parameters editing, and layout structuring.
- **Designer Role**: Grants access to section additions, layout column shifting, and publishing updates to live override CSS stylesheets.
- **Contributor Role**: Restricted to drafting news articles, creating local events, and executing localized markdown updates via `cms_write_page_content`.
