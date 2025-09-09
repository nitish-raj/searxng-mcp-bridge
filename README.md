# SearXNG MCP Bridge Server

[![Release](https://github.com/nitish-raj/searxng-mcp-bridge/actions/workflows/release.yml/badge.svg)](https://github.com/nitish-raj/searxng-mcp-bridge/actions/workflows/release.yml)
[![smithery badge](https://smithery.ai/badge/@nitish-raj/searxng-mcp-bridge)](https://smithery.ai/server/@nitish-raj/searxng-mcp-bridge)

This is a Model Context Protocol (MCP) server that acts as a bridge to a [SearXNG](https://github.com/searxng/searxng) instance. It allows compatible clients to perform searches using a configured SearXNG instance via MCP tools.

## Quick Start (Using from npm)

1. **Set up a SearXNG instance**:
   ```bash
   # Using Docker
   docker run -d -p 8888:8080 --name searxng searxng/searxng
   ```

2. **Install and run the MCP bridge**

   Default (STDIO, unchanged):
   ```bash
   # Run directly with npx (default - stdio transport)
   npx @nitish-raj/searxng-mcp-bridge
   ```

   Optional: Run as an HTTP server (new, opt-in)
   ```bash
   # Using env variables (recommended)
   TRANSPORT=http PORT=3000 HOST=127.0.0.1 SEARXNG_INSTANCE_URL=http://localhost:8888 npx @nitish-raj/searxng-mcp-bridge

   # Or use the CLI flag form
   npx @nitish-raj/searxng-mcp-bridge --transport=http

   # Or run the built bundle
   TRANSPORT=http node build/index.js
   ```

3. **Configure in your MCP settings file** (stdio / legacy clients)
   Add to your MCP settings file (e.g., `~/.vscode-server/.../mcp_settings.json`):
   ```json
   {
     "mcpServers": {
       "searxng-bridge": {
         "command": "npx",
         "args": ["@nitish-raj/searxng-mcp-bridge"],
         "env": {
           "SEARXNG_INSTANCE_URL": "YOUR_SEARXNG_INSTANCE_URL"
         },
         "disabled": false
       }
     }
   }
   ```

   If you use Smithery to install/run the bridge, the package now supports selecting the transport via the Smithery config:
   - In Smithery config (example), set `transport: "http"` to run the bridge over HTTP instead of stdio. Smithery will set `TRANSPORT` in the process environment when launching the bridge.

## Features

* Provides an MCP tool named `search`.
* Connects to a SearXNG instance specified by an environment variable.
* Returns search results from SearXNG in JSON format.

## Environment variables & configuration (new HTTP options)

- `SEARXNG_INSTANCE_URL` — REQUIRED. The full URL of the SearXNG instance (e.g., `http://localhost:8888`).
- `TRANSPORT` — Optional. Select transport: `stdio` (default) or `http`.
- `PORT` — Optional. When running HTTP transport, the server listens on this port. Default: `3000`.
- `HOST` — Optional. Default: `127.0.0.1`. When containerized, set to `0.0.0.0`.
- `CORS_ORIGIN` — Optional. Default `*`. Restrict in production to allowed client origins.
- CORS headers used by the HTTP transport:
  - Exposed headers: `Mcp-Session-Id`
  - Allowed headers: `Content-Type`, `mcp-session-id`

Notes:
- The HTTP transport is opt-in. Default behaviour (stdio) is preserved so existing MCP clients that spawn the tool via stdio continue to work unchanged.
- To revert to stdio, set `TRANSPORT=stdio` or run without the `--transport` flag.

## Running over HTTP — details & smoke test

The HTTP transport exposes a single endpoint for MCP traffic:

- POST /mcp — accepts MCP requests and responds with MCP responses. The transport uses `Mcp-Session-Id` headers to manage session-based transports.

Smoke-test (single-line curl to list tools):
```bash
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

If the server is running in HTTP mode you should receive a JSON-RPC response with the list of registered tools (including `search`).

## Using Smithery

If you install via Smithery, you can configure the `transport` value in the Smithery configuration for this package. When Smithery starts the server, it will set `TRANSPORT` in the process environment accordingly (so you can choose `http` or `stdio` from Smithery without code changes).

Install via Smithery:
```bash
npx -y @smithery/cli install @nitish-raj/searxng-mcp-bridge --client claude
```

## Docker

The Dockerfile now exposes port `3000` (the HTTP default). To run the container and allow HTTP access:
```bash
# Build (example)
docker build -t searxng-mcp-bridge .

# Run mapping port 3000
docker run -d -p 3000:3000 --env SEARXNG_INSTANCE_URL=http://host.docker.internal:8888 --name searxng-mcp-bridge searxng-mcp-bridge

# To run HTTP transport inside container:
docker run -d -p 3000:3000 -e TRANSPORT=http -e PORT=3000 -e SEARXNG_INSTANCE_URL=http://host.docker.internal:8888 searxng-mcp-bridge
```

Note: when containerized set `HOST=0.0.0.0` or rely on the default exposed port mapping.

## Usage

Once configured, you can instruct your MCP client (like Roo) to use the tool unchanged. For STDIO-based clients, no configuration change is required. For Smithery-managed installs, set `transport: "http"` in the Smithery config to switch to HTTP.

## Development

* `npm install`: Install dependencies.
* `npm run build`: Compile TypeScript to JavaScript.
* `npm run watch`: Watch for changes and rebuild automatically.
* `npm run inspector`: Run the MCP inspector to test the server.

## Notes & guarantees

- No tool names, schemas, or IO shapes were changed by the HTTP transport support.
- STDIO remains the default transport and behaves exactly as before; rollback to STDIO is a single env/flag change.
- The HTTP transport is intentionally opt-in and configuration-driven to keep the change minimal and reversible.
