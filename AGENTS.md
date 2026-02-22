# AGENTS.md - Development Guidelines for SearXNG MCP Bridge

## Build/Test Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript and sets executable permissions
- **Watch mode**: `npm run watch` - Auto-rebuild on file changes
- **Test MCP server**: `npm run inspector` - Run MCP inspector to test server functionality
- **Release**: `npm run release:patch|minor|major` - Version bump and changelog generation
- **HTTP mode**: `npm run start:http` - Start server in HTTP streaming mode on localhost:3002
- **Dev mode**: `npm run dev` - Run with tsx for development

## Git Workflow Requirements

### Branch Creation
- Never commit directly to `master`; always work on a feature branch.
- Start new work from an up-to-date `master`:
  - `git checkout master`
  - `git pull --ff-only`
  - `git checkout -b <type>/<short-kebab-description>`
- Branch names must use lowercase kebab-case and one of these prefixes:
  - `feat/`, `fix/`, `chore/`, `docs/`, `ci/`, `refactor/`, `perf/`
- Example branch names:
  - `fix/release-publish-skip`
  - `chore/deps-axios-update`

### Commit Requirements
- Follow Conventional Commits: `<type>(<scope>): <summary>`.
- Use clear, imperative commit summaries and avoid `wip`/`temp` commits.
- Keep commits focused and atomic; each commit should build successfully.
- Prefer these commit types for release automation compatibility:
  - `feat`, `fix`, `perf`, `revert`, `build`, `ci`, `chore`

### Pull Request Merge Practice
- Prefer **Squash and merge** to keep history linear and preserve one Conventional Commit message.
- Ensure the final squash commit title is also a valid Conventional Commit.
- Avoid merge commits unless there is a specific reason to preserve full branch history.

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
- `SEARXNG_INSTANCE_URL` (required): URL of SearXNG instance (e.g., `http://localhost:8080`)
- `SEARXNG_BRIDGE_DEBUG` (optional): Enable debug logging
- `TRANSPORT` (optional): Transport mode (`stdio` or `http`, default: `stdio`)
- `PORT` (optional): HTTP server port (default: `3000`, use `3002` for development)
- `HOST` (optional): HTTP server host (default: `127.0.0.1`)
- `MCP_HTTP_BEARER` (optional): Bearer token for HTTP authentication
- `CORS_ORIGIN` (optional): CORS origin configuration (default: `localhost:3002` for development, reflects specific origins in production for credentialed requests)
