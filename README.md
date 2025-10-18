# SearXNG MCP Bridge Server

[![Release](https://github.com/nitish-raj/searxng-mcp-bridge/actions/workflows/release.yml/badge.svg)](https://github.com/nitish-raj/searxng-mcp-bridge/actions/workflows/release.yml)


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
   npx -y @nitish-raj/searxng-mcp-bridge
   ```

   Optional: Run as an HTTP server (new, opt-in)
   ```bash
    # Using env variables (recommended)
     TRANSPORT=http PORT=3002 HOST=127.0.0.1 SEARXNG_INSTANCE_URL=http://localhost:8080 npx -y @nitish-raj/searxng-mcp-bridge



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
         "args": [
          "-y",
          "@nitish-raj/searxng-mcp-bridge"
          ],
          "env": {
            "SEARXNG_INSTANCE_URL": "http://localhost:8080"
          },
         "disabled": false
       }
     }
   }
   ```

**HTTP Configuration**: Set `TRANSPORT=http` to run the bridge over HTTP instead of stdio. The transport mode can be configured via environment variables.

## Features

* **Search Tool**: Perform web searches using SearXNG with configurable parameters
* **Health Check**: Monitor SearXNG instance connectivity and performance
* **Dual Transport**: Supports both STDIO (default) and HTTP transports
* **Session Management**: HTTP transport includes session-based connections
* **CORS Support**: Proper cross-origin headers for web client integration
* **Rate Limiting**: Built-in protection against excessive requests (HTTP mode)

## Configuration

- `SEARXNG_INSTANCE_URL` — REQUIRED. The full URL of the SearXNG instance (e.g., `http://localhost:8080`).
 - `TRANSPORT` — Transport protocol: `stdio` (default) or `http`
 - `PORT` — HTTP server port. Default: `3000` (use `3002` for development)
 - `HOST` — Server bind address. Default: `127.0.0.1` (use `0.0.0.0` for containers)
 - `CORS_ORIGIN` — Comma-separated list of allowed origins for CORS. Default: localhost:3002 (development) or `*` (production)
 - `MCP_HTTP_BEARER` — Optional bearer token for HTTP authentication
 **HTTP Transport Features**:
- Session management with `mcp-session-id` headers
- Secure CORS with origin whitelist validation
- Rate limiting (100 requests/minute per IP)
- Optional bearer authentication via `MCP_HTTP_BEARER`
- DNS rebinding protection

**Security Notes**:
- CORS uses secure whitelist in development (localhost:3002 only)
- Production reflects specific origins for credentialed requests (CORS-compliant)
- Set `CORS_ORIGIN` to customize allowed origins for your use case
- Set `TRANSPORT=stdio` to revert to stdio mode

## HTTP Transport

The HTTP transport implements the MCP Streamable HTTP specification (2025-03-26) with the following endpoints:

**MCP Endpoints**:
- `POST /mcp` - Send MCP requests
- `GET /mcp` - Server-Sent Events for notifications  
- `DELETE /mcp` - Terminate sessions
- `OPTIONS /mcp` - CORS preflight requests

**System Endpoints**:
- `GET /healthz` - Health check and status

**Test HTTP endpoint**:
```bash
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

This returns a JSON-RPC response with the list of available tools (`search` and `health_check`).



## Docker

The Dockerfile exposes port `8081` for HTTP transport. To run the container and allow HTTP access:
```bash
# Build (example)
docker build -t searxng-mcp-bridge .

# Run mapping port 8081
 docker run -d -p 8081:8081 --env SEARXNG_INSTANCE_URL=http://localhost:8080 --name searxng-mcp-bridge searxng-mcp-bridge

# To run HTTP transport inside container:
 docker run -d -p 8081:8081 -e TRANSPORT=http -e PORT=8081 -e SEARXNG_INSTANCE_URL=http://localhost:8080 searxng-mcp-bridge
```

Note: when containerized set `HOST=0.0.0.0` or rely on the default exposed port mapping.

## Usage

**STDIO Clients**: Use the tool unchanged - no configuration changes required.

**HTTP Clients**: Connect to `http://localhost:3002/mcp` (development port) and send MCP JSON-RPC requests.



## Development

* `npm install`: Install dependencies.
* `npm run build`: Compile TypeScript to JavaScript.
* `npm run watch`: Watch for changes and rebuild automatically.
* `npm run inspector`: Run the MCP inspector to test the server.
* `npm run start:http`: Start server in HTTP streaming mode on localhost:3002.

## Migration & Compatibility

**Backward Compatibility**: 
- STDIO remains the default transport - existing users need no changes
- All tool names, parameters, and responses remain unchanged
- Configuration is opt-in via environment variables

**Migration to HTTP**:
- Set `TRANSPORT=http` to enable HTTP transport
- Configure `PORT` and `HOST` as needed
- Update client to use HTTP endpoint instead of stdio

**Rollback**:
- Set `TRANSPORT=stdio` or omit the variable to return to stdio
