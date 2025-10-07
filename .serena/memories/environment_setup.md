# Environment Setup and Configuration

## Required Environment Variables
- `SEARXNG_INSTANCE_URL`: Full URL of the SearXNG instance (e.g., `http://localhost:8080`)

## Optional Environment Variables
- `TRANSPORT`: Transport mode (`stdio` or `http`, default: `stdio`)
- `PORT`: HTTP server port (default: `3000`, use `3002` for development)
- `HOST`: HTTP server host (default: `127.0.0.1`, use `0.0.0.0` for containers)
- `SEARXNG_BRIDGE_DEBUG`: Enable debug logging
- `MCP_HTTP_BEARER`: Bearer token for HTTP authentication
- `CORS_ORIGIN`: CORS origin configuration (default: `localhost:3002` for development)

## Development Setup
1. Install dependencies: `npm install`
2. Set up SearXNG instance (Docker: `docker run -d -p 8888:8080 searxng/searxng`)
3. Configure `SEARXNG_INSTANCE_URL` environment variable
4. Run development server: `npm run dev`

## HTTP Transport Features
- Session management with `Mcp-Session-Id` headers
- Rate limiting (100 requests per minute per IP)
- CORS support with origin validation
- Optional bearer authentication
- Implements MCP Streamable HTTP specification (2025-03-26)

## Testing Setup
- Use MCP inspector: `npm run inspector`
- Test endpoints: `/mcp` for MCP operations, `/healthz` for health checks
- HTTP mode testing: `curl -X POST http://localhost:3002/mcp`