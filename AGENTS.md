# AGENTS.md - Development Guidelines for SearXNG MCP Bridge

## Build/Test Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript and sets executable permissions
- **Watch mode**: `npm run watch` - Auto-rebuild on file changes
- **Test MCP server**: `npm run inspector` - Run MCP inspector to test server functionality
- **Release**: `npm run release:patch|minor|major` - Version bump and changelog generation

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

### Dependencies
- Core: `@modelcontextprotocol/sdk`, `axios`
- No testing framework currently configured
- No linting tools configured (consider adding ESLint/Prettier)

### Environment Variables
- `SEARXNG_INSTANCE_URL` (required): URL of SearXNG instance
- `SEARXNG_BRIDGE_DEBUG` (optional): Enable debug logging