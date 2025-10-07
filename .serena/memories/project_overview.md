# SearXNG MCP Bridge Project Overview

## Project Purpose
This is a Model Context Protocol (MCP) server that acts as a bridge to SearXNG instances. It allows compatible clients to perform web searches using a configured SearXNG instance via MCP tools.

## Tech Stack
- **Language**: TypeScript (ES2022)
- **Runtime**: Node.js (>=20.0.0)
- **Core Dependencies**: 
  - @modelcontextprotocol/sdk (MCP server implementation)
  - axios (HTTP client for SearXNG API calls)
  - express (HTTP server for HTTP transport mode)
  - cors (CORS handling)
  - express-rate-limit (rate limiting)
- **Build Tools**: TypeScript compiler, tsx (development runner)
- **Transport Modes**: STDIO (default) and HTTP streaming

## Code Structure
- Single-file architecture: `src/index.ts` contains all server logic
- Output directory: `build/`
- Entry point: `build/index.js` (executable)

## Key Features
- Search tool for web queries via SearXNG
- Health check tool for SearXNG instance monitoring
- Dual transport support (STDIO/HTTP)
- Session management (HTTP mode)
- CORS and rate limiting (HTTP mode)
- Environment-based configuration