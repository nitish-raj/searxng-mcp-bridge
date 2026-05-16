# SearXNG MCP Bridge Server

[![Release](https://github.com/nitish-raj/searxng-mcp-bridge/actions/workflows/release.yml/badge.svg)](https://github.com/nitish-raj/searxng-mcp-bridge/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@nitish-raj/searxng-mcp-bridge.svg)](https://www.npmjs.com/package/@nitish-raj/searxng-mcp-bridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-25.x-green.svg)](https://nodejs.org/)

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that bridges to a [SearXNG](https://github.com/searxng/searxng) metasearch engine instance. It exposes SearXNG search capabilities as MCP tools, allowing any MCP-compatible client (Claude Desktop, Cursor, opencode, etc.) to perform web searches through a self-hosted, privacy-respecting search engine.

## Requirements

- Node.js >=25.0.0 <26
- A running [SearXNG](https://github.com/searxng/searxng) instance with JSON API enabled

## Quick Start

### 1. Set up a SearXNG instance

```bash
docker run -d -p 8080:8080 --name searxng searxng/searxng
```

### 2. Run the MCP bridge

**STDIO mode** (default, for MCP clients like Claude Desktop):
```bash
npx -y @nitish-raj/searxng-mcp-bridge
```

**HTTP mode** (for web/remote clients):
```bash
TRANSPORT=http PORT=3002 SEARXNG_INSTANCE_URL=http://localhost:8080 npx -y @nitish-raj/searxng-mcp-bridge
```

**Via CLI flag** (alternative to env var):
```bash
SEARXNG_INSTANCE_URL=http://localhost:8080 npx -y @nitish-raj/searxng-mcp-bridge --transport=http
```

### 3. Configure your MCP client

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):
```json
{
  "mcpServers": {
    "searxng-bridge": {
      "command": "npx",
      "args": ["-y", "@nitish-raj/searxng-mcp-bridge"],
      "env": {
        "SEARXNG_INSTANCE_URL": "http://localhost:8080"
      }
    }
  }
}
```

**Cursor / VS Code** (`mcp_settings.json`):
```json
{
  "mcpServers": {
    "searxng-bridge": {
      "command": "npx",
      "args": ["-y", "@nitish-raj/searxng-mcp-bridge"],
      "env": {
        "SEARXNG_INSTANCE_URL": "http://localhost:8080"
      },
      "disabled": false
    }
  }
}
```

## MCP Tools

### `search`

Perform a web search using the configured SearXNG instance.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search query string |
| `language` | string | No | Language code for results (e.g., `en-US`, `fr`, `de`) |
| `categories` | string[] | No | Categories to search (e.g., `["general", "images", "news"]`) |
| `time_range` | string | No | Time range filter: `day`, `week`, `month`, `year` |
| `safesearch` | number | No | Safe search level: `0` (off), `1` (moderate), `2` (strict) |
| `format` | string | No | Result format: `json` (default) or `html` |
| `max_results` | number | No | Maximum number of results to return |

**Example response:**
```json
{
  "query": "test query",
  "number_of_results": 10,
  "results": [
    {
      "url": "https://example.com",
      "title": "Example Title",
      "content": "Snippet of the search result...",
      "engine": "google",
      "score": 1.0
    }
  ]
}
```

### `health_check`

Check the health and connectivity status of the SearXNG instance and bridge server.

**Parameters:** None

**Example response:**
```json
{
  "status": "healthy",
  "searxng_instance": "http://localhost:8080",
  "searxng_status": "healthy",
  "response_time_ms": 42,
  "cache_size": 3,
  "debug_mode": false,
  "version": "0.11.19",
  "timestamp": "2026-05-16T12:00:00.000Z"
}
```

## Features

- **Search Tool** -- Perform web searches with configurable language, categories, time range, safe search, and result limits
- **Health Check** -- Monitor SearXNG connectivity, response time, cache size, and version
- **Dual Transport** -- Supports both STDIO (default) and HTTP streaming transports
- **Response Caching** -- 5-minute TTL cache with periodic cleanup to reduce duplicate requests
- **Retry Logic** -- Automatic retry with exponential backoff (3 attempts) for transient failures
- **Startup Validation** -- Validates SearXNG connection on launch with detailed error diagnostics
- **Session Management** -- HTTP transport includes UUID-based session tracking via `mcp-session-id` headers
- **CORS Support** -- Configurable origin whitelist with proper preflight handling
- **Rate Limiting** -- Built-in protection (100 requests/minute per IP) in HTTP mode
- **Bearer Authentication** -- Optional token-based auth for HTTP endpoints
- **Debug Logging** -- Redacted logs that strip sensitive info (tokens, session IDs, URLs)
- **DNS Rebinding Protection** -- Prevents DNS-based attacks in HTTP mode
- **Graceful Shutdown** -- Proper cleanup of transports and HTTP server on SIGINT/SIGTERM

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SEARXNG_INSTANCE_URL` | Yes | -- | Full URL of the SearXNG instance (e.g., `http://localhost:8080`) |
| `TRANSPORT` | No | `stdio` | Transport protocol: `stdio` or `http` |
| `PORT` | No | `3002` | HTTP server port (when `TRANSPORT=http`) |
| `HOST` | No | `127.0.0.1` | Server bind address (use `0.0.0.0` for containers) |
| `CORS_ORIGIN` | No | `localhost:3002` (dev) / `*` (prod) | Comma-separated allowed origins for CORS |
| `MCP_HTTP_BEARER` | No | -- | Bearer token for HTTP endpoint authentication |
| `SEARXNG_BRIDGE_DEBUG` | No | `false` | Enable debug logging (`true` to enable) |

### CLI Flags

| Flag | Description |
|------|-------------|
| `--transport <stdio\|http>` | Transport mode (overrides `TRANSPORT` env var) |

## HTTP Transport

The HTTP transport implements the [MCP Streamable HTTP specification](https://modelcontextprotocol.io/specification/2025-03-26) (2025-03-26).

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | Send MCP JSON-RPC requests; initialize new sessions |
| `GET` | `/mcp` | Server-Sent Events stream for notifications |
| `DELETE` | `/mcp` | Terminate sessions |
| `OPTIONS` | `/mcp` | CORS preflight requests |
| `GET` | `/healthz` | Health check (returns `{ "status": "ok", "version": "..." }`) |

**Initialize and search via HTTP:**
```bash
# 1. Initialize a session
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# 2. List tools (use mcp-session-id from step 1 response)
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 3. Perform a search
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search","arguments":{"query":"hello world"}}}'
```

## Docker

The Dockerfile is based on `node:25-alpine` and exposes port `8081`.

```bash
# Build
docker build -t searxng-mcp-bridge .

# Run in STDIO mode (default)
docker run -d \
  -e SEARXNG_INSTANCE_URL=http://host.docker.internal:8080 \
  searxng-mcp-bridge

# Run in HTTP mode
docker run -d -p 8081:8081 \
  -e TRANSPORT=http \
  -e PORT=8081 \
  -e HOST=0.0.0.0 \
  -e SEARXNG_INSTANCE_URL=http://host.docker.internal:8080 \
  searxng-mcp-bridge
```

> **Note:** Use `HOST=0.0.0.0` when running inside containers to allow external connections.

## Development

```bash
npm install          # Install dependencies
npm run dev          # Run with tsx (TypeScript execution, no build step)
npm run build        # Compile TypeScript to JavaScript
npm run watch        # Watch for changes and rebuild automatically
npm run start        # Run the compiled server (stdio mode)
npm run start:http   # Run the compiled server (HTTP mode on port 3002)
npm run inspector    # Run MCP inspector for interactive testing
```

**Release scripts:**
```bash
npm run release:patch   # Bump patch version (0.11.x)
npm run release:minor   # Bump minor version (0.x.0)
npm run release:major   # Bump major version (x.0.0)
```

Releases are automated via [release-please](https://github.com/googleapis/release-please) with Renovate for dependency management.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes following existing code style
4. Ensure `npm run build` passes
5. Open a pull request using the [PR template](.github/PULL_REQUEST_TEMPLATE.md)

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/nitish-raj/searxng-mcp-bridge/issues).

## License

[MIT](LICENSE) -- Copyright (c) 2025 Nitish Raj
