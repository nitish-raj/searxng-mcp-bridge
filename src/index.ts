#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const PACKAGE_VERSION = packageJson.version;

interface SearchArgs {
  query: string;
  language?: string;
  categories?: string[];
  time_range?: string;
  safesearch?: number;
  format?: string;
  max_results?: number;
}

const isValidSearchArgs = (args: any): args is SearchArgs => {
  if (typeof args !== 'object' || args === null || typeof args.query !== 'string') return false;
  if (args.language !== undefined && typeof args.language !== 'string') return false;
  if (args.categories !== undefined && !Array.isArray(args.categories)) return false;
  if (args.time_range !== undefined && typeof args.time_range !== 'string') return false;
  if (args.safesearch !== undefined && typeof args.safesearch !== 'number') return false;
  if (args.format !== undefined && typeof args.format !== 'string') return false;
  if (args.max_results !== undefined && typeof args.max_results !== 'number') return false;
  return true;
};

const SEARXNG_URL = process.env.SEARXNG_INSTANCE_URL;
const DEBUG_MODE = process.env.SEARXNG_BRIDGE_DEBUG === 'true';
// Logging utility for redacting sensitive information
const redactLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    // Redact sensitive information from logs
    const redactedMessage = message
      .replace(/(Authorization: Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
      .replace(/(mcp-session-id:\s*)[^\s]+/gi, '$1[REDACTED]')
      .replace(/(SEARXNG_INSTANCE_URL=)[^\s]+/g, '$1[REDACTED]');
    
    console.log(redactedMessage, ...args);
  }
};

// Redact sensitive environment variables from logs
const redactUrl = (url: string | undefined) => {
  if (url && typeof url === 'string') {
    return url.replace(/(https?:\/\/)[^\/@]*@/, '$1[REDACTED]@');
  }
  return url || '';
};

if (!SEARXNG_URL) {
  console.error('[SearxNG Bridge] ERROR: SEARXNG_INSTANCE_URL environment variable is not set.');
  process.exit(1);
} else {
  console.log(`[SearxNG Bridge] Using SearxNG instance URL: ${redactUrl(SEARXNG_URL)}`);
}

interface CacheEntry {
  timestamp: number;
  data: any;
}

class SearxngBridgeServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  constructor() {
    this.server = new Server(
      { name: 'searxng-bridge', version: PACKAGE_VERSION, description: 'MCP Server for SearxNG Bridge' },
      { capabilities: { resources: {}, tools: {} } }
    );

    this.axiosInstance = axios.create({
      baseURL: SEARXNG_URL,
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36' }
    });

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);

    setInterval(() => this.cleanCache(), 60 * 1000);
  }

  private cleanCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) this.cache.delete(key);
    }
  }

  private getCacheKey(params: any): string {
    return JSON.stringify(params);
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search',
          description: 'Perform a search using the configured SearxNG instance',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The search query string' },
              language: { type: 'string', description: 'Language code (e.g., "en-US", "fr", "de")' },
              categories: { type: 'array', items: { type: 'string' }, description: 'e.g., ["general","images","news"]' },
              time_range: { type: 'string', description: 'e.g., "day","week","month","year"' },
              safesearch: { type: 'number', description: '0 off, 1 moderate, 2 strict' },
              format: { type: 'string', description: 'default "json"; options "json","html"' },
              max_results: { type: 'number', description: 'Maximum number of results to return' }
            },
            required: ['query']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'search') {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }

      if (!isValidSearchArgs(request.params.arguments)) {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid search arguments. Requires a "query" string.');
      }

      const args = request.params.arguments;
      const searchParams: Record<string, any> = { q: args.query, format: args.format || 'json' };
      if (args.language) searchParams.language = args.language;
      if (args.categories) searchParams.categories = args.categories.join(',');
      if (args.time_range) searchParams.time_range = args.time_range;
      if (args.safesearch !== undefined) searchParams.safesearch = args.safesearch;

      const cacheKey = this.getCacheKey(searchParams);
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_TTL) {
        let results = cachedResult.data;
        if (args.max_results && results.results) {
          results = { ...results, results: results.results.slice(0, args.max_results) };
        }
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      return await this.performSearchWithRetry(searchParams, args.max_results, cacheKey);
    });
  }

  private async performSearchWithRetry(
    searchParams: Record<string, any>,
    maxResults?: number,
    cacheKey?: string
  ) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.axiosInstance.get('/search', { params: searchParams });
        let results = response.data;
        if (maxResults && results.results) results = { ...results, results: results.results.slice(0, maxResults) };
        if (cacheKey) this.cache.set(cacheKey, { timestamp: Date.now(), data: response.data });
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      } catch (error) {
        lastError = error;
        if (attempt < this.MAX_RETRIES) await new Promise((r) => setTimeout(r, this.RETRY_DELAY * attempt));
      }
    }

    let errorMessage = `Failed to fetch search results from SearxNG instance at ${SEARXNG_URL} after ${this.MAX_RETRIES} attempts.`;
    if (axios.isAxiosError(lastError)) {
      errorMessage = `SearxNG request error (${redactUrl(SEARXNG_URL)}): ${lastError.response?.data?.message || lastError.message}`;
      if (lastError.response?.status) errorMessage += ` (Status: ${lastError.response.status})`;
    } else if (lastError instanceof Error) {
      errorMessage = `Unexpected error while contacting ${redactUrl(SEARXNG_URL)}: ${lastError.message}`;
    }

    return { content: [{ type: 'text', text: errorMessage }], isError: true as const };
  }

  async run() {
    let transport = 'stdio';
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--transport') {
        transport = args[i + 1] || transport;
        break;
      } else if (args[i].startsWith('--transport=')) {
        transport = args[i].split('=')[1] || transport;
        break;
      }
    }
    if (transport === 'stdio' && process.env.TRANSPORT) transport = process.env.TRANSPORT;

    if (transport === 'http') {
      const app = express();
      app.use(express.json());
      
      // Optional Bearer Auth middleware
      const bearerAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const requiredPaths = ['/mcp', '/healthz'];
        const isProtectedPath = requiredPaths.some(path => req.path === path || req.path.startsWith(path));
        
        // Only apply to POST, GET, DELETE requests on protected paths
        if (isProtectedPath && ['POST', 'GET', 'DELETE'].includes(req.method)) {
          const bearerToken = process.env.MCP_HTTP_BEARER;
          
          // If bearer auth is enabled, check for valid Authorization header
          if (bearerToken) {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
              redactLog('[SearxNG Bridge] Unauthorized access attempt - missing or invalid Authorization header');
              return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
            }
            
            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            if (token !== bearerToken) {
              redactLog('[SearxNG Bridge] Unauthorized access attempt - invalid token');
              return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      // Add a logging middleware to inspect headers
      app.use((req, res, next) => {
        redactLog(`[SearxNG Bridge] Incoming request: ${req.method} ${req.path}`);
        redactLog(`[SearxNG Bridge] Headers: ${JSON.stringify(req.headers, null, 2)}`);
        next();
      });

            }
          }
        }
        next();
      };
      
      // Apply the bearer auth middleware
      app.use(bearerAuthMiddleware);
      
      // Enhanced CORS configuration
      const corsOrigin = process.env.CORS_ORIGIN 
        ? (process.env.CORS_ORIGIN.includes(',') 
            ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) 
            : process.env.CORS_ORIGIN)
        : (process.env.NODE_ENV === 'production' ? 'localhost' : '*');
        
      app.use(
        cors({
          origin: corsOrigin,
          exposedHeaders: ['Mcp-Session-Id'],
          allowedHeaders: ['Content-Type', 'mcp-session-id', 'Authorization'],
          methods: ['GET', 'POST', 'DELETE']
        })
      );

      const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // Rate limiting for POST /mcp - 100 requests per 60 seconds per IP
      const mcpRateLimit = rateLimit({
        windowMs: 60 * 1000, // 60 seconds
        limit: 100, // 100 requests per windowMs
        standardHeaders: 'draft-7', // draft-6: RateLimit-* headers; draft-7: combined RateLimit and Limit headers
        legacyHeaders: false, // Disable X-RateLimit-* headers
        message: {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.'
        },
        skipSuccessfulRequests: false, // Count all requests, including successful ones
      });

      app.post('/mcp', mcpRateLimit, async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          transport = transports[sessionId];
        } else if (!sessionId && req.body && typeof req.body === 'object' && req.body.method === 'initialize') {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              transports[sid] = transport;
            },
            enableDnsRebindingProtection: true,
            allowedHosts: ['127.0.0.1:3000', 'localhost:3000']
          });
          transport.onclose = () => {
            if (transport.sessionId) delete transports[transport.sessionId];
          };
          await this.server.connect(transport);
        } else {
          res
            .status(400)
            .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Bad Request: No valid session ID provided' }, id: null });
          return;
        }

        await transport.handleRequest(req, res, req.body);
      });

      const handleSessionRequest = async (req: any, res: any) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      };

      app.get('/mcp', handleSessionRequest);
      app.get('/healthz', (req, res) => {
        res.status(200).json({ status: 'ok', version: PACKAGE_VERSION });
      });
      app.delete('/mcp', handleSessionRequest);

      const PORT = parseInt(process.env.PORT || '3000', 10);
      const HOST = process.env.HOST || '127.0.0.1';

      const server = app.listen(PORT, HOST, () => {
        console.error(`SearxNG Bridge MCP server v${PACKAGE_VERSION} running on http://${HOST}:${PORT}`);
        if (DEBUG_MODE) console.error('[SearxNG Bridge] Debug mode enabled');
        // Log if bearer auth is enabled
        if (process.env.MCP_HTTP_BEARER) {
          console.error('[SearxNG Bridge] Bearer authentication enabled');
        }
      });

      // Graceful shutdown
      const shutdown = async () => {
        console.error('[SearxNG Bridge] Shutting down...');
        // Close all transports
        for (const [sessionId, transport] of Object.entries(transports)) {
          try {
            await transport.close();
          } catch (error) {
            console.error(`[SearxNG Bridge] Error closing transport ${sessionId}:`, error);
          }
        }
        // Close the main server
        await this.server.close();
        // Close HTTP server
        server.close(() => {
          console.error('[SearxNG Bridge] HTTP server closed');
        });
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } else {
      const stdioTransport = new StdioServerTransport();
      await this.server.connect(stdioTransport);
      console.error(`SearxNG Bridge MCP server v${PACKAGE_VERSION} running on stdio`);
      if (DEBUG_MODE) console.error('[SearxNG Bridge] Debug mode enabled');
    }
  }
}

const server = new SearxngBridgeServer();
server.run().catch(console.error);
