# Development Commands

## Build and Development
- `npm run build` - Compile TypeScript to JavaScript and set executable permissions
- `npm run watch` - Auto-rebuild on file changes during development
- `npm run dev` - Run with tsx for development
- `npm run start` - Run the compiled server (STDIO mode)
- `npm run start:http` - Start server in HTTP streaming mode on localhost:3002

## Testing and Inspection
- `npm run inspector` - Run MCP inspector to test server functionality
- No automated tests currently configured

## Release Management
- `npm run release:patch` - Version bump and changelog generation (patch version)
- `npm run release:minor` - Version bump and changelog generation (minor version)
- `npm run release:major` - Version bump and changelog generation (major version)

## Environment Setup
- `SEARXNG_INSTANCE_URL` (required): URL of SearXNG instance
- `TRANSPORT` (optional): `stdio` or `http` (default: `stdio`)
- `PORT` (optional): HTTP server port (default: `3000`, use `3002` for dev)
- `HOST` (optional): HTTP server host (default: `127.0.0.1`)
- `SEARXNG_BRIDGE_DEBUG` (optional): Enable debug logging
- `MCP_HTTP_BEARER` (optional): Bearer token for HTTP authentication
- `CORS_ORIGIN` (optional): CORS origin configuration

## System Utilities
- Standard Linux commands: `git`, `ls`, `cd`, `grep`, `find`
- Node.js: `node`, `npm`, `npx`
- Development: `tsx` for TypeScript execution