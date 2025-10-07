# Code Style and Conventions

## TypeScript Configuration
- Target: ES2022, Module: Node16, Strict mode enabled
- ES modules (`import`/`export`) exclusively
- Output: `build/`, Source: `src/`

## Code Patterns
- Use TypeScript interfaces for type definitions (e.g., `SearchArgs`)
- Implement proper error handling with `McpError` from MCP SDK
- Use private methods with underscore prefix for internal methods
- Include comprehensive JSDoc comments for tool schemas
- Use template literals for string interpolation

## Error Handling
- Validate all input parameters with type guards (`isValidSearchArgs`)
- Implement retry logic with exponential backoff for external API calls
- Return structured error responses with `isError: true` flag
- Log errors to stderr with descriptive prefixes

## Naming Conventions
- Classes: PascalCase (e.g., `SearxngBridgeServer`)
- Interfaces: PascalCase (e.g., `SearchArgs`)
- Methods/Functions: camelCase
- Constants: UPPER_SNAKE_CASE (e.g., `SEARXNG_URL`)
- Private methods: underscore prefix (e.g., `_performSearch`)

## Dependencies
- Core MCP SDK for server implementation
- Axios for HTTP requests to SearXNG
- Express ecosystem for HTTP transport mode
- No testing framework currently configured
- No linting tools configured (consider adding ESLint/Prettier)