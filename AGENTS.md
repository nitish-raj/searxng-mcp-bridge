# AGENTS.md - Development Guidelines for SearXNG MCP Bridge

## Build/Test Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript and sets executable permissions
- **Watch mode**: `npm run watch` - Auto-rebuild on file changes
- **Test MCP server**: `npm run inspector` - Run MCP inspector to test server functionality
- **Release**: `npm run release:patch|minor|major` - Version bump and changelog generation
- **HTTP mode**: `npm run start:http` - Start server in HTTP streaming mode
- **Dev mode**: `npm run dev` - Run with tsx for development

## Code Style Guidelines

### TypeScript Configuration
- Target: ES2022, Module: Node16, Strict mode enabled
- Use ES modules (`import`/`export`) exclusively
- Output directory: `build/`, Source directory: `src/`

### Code Patterns
- Use TypeScript interfaces for type definitions (e.g., `SearchArgs`)
- Implement proper error handling with `McpError` from MCP SDK
- Use private methods with underscore prefix for internal methods
- Include comprehensive JSDoc comments for tool schemas
- Use template literals for string interpolation

### Error Handling
- Validate all input parameters with type guards (`isValidSearchArgs`)
- Implement retry logic with exponential backoff for external API calls
- Return structured error responses with `isError: true` flag
- Log errors to stderr with descriptive prefixes

### HTTP Streaming Support
- Supports both STDIO and HTTP streaming transports
- HTTP transport implements MCP Streamable HTTP specification (2025-03-26)
- Session management with `Mcp-Session-Id` headers
- CORS configuration with configurable origins
- Rate limiting (100 requests per 60 seconds per IP)
- Optional bearer authentication for protected endpoints
- Graceful shutdown with proper cleanup

### Dependencies
- Core: `@modelcontextprotocol/sdk`, `axios`, `express`, `cors`, `express-rate-limit`
- No testing framework currently configured
- No linting tools configured (consider adding ESLint/Prettier)

### Environment Variables
- `SEARXNG_INSTANCE_URL` (required): URL of SearXNG instance
- `SEARXNG_BRIDGE_DEBUG` (optional): Enable debug logging
- `TRANSPORT` (optional): Transport mode (`stdio` or `http`, default: `stdio`)
- `PORT` (optional): HTTP server port (default: `3000`)
- `HOST` (optional): HTTP server host (default: `127.0.0.1`)
- `MCP_HTTP_BEARER` (optional): Bearer token for HTTP authentication
- `CORS_ORIGIN` (optional): CORS origin configuration (default: `*`)