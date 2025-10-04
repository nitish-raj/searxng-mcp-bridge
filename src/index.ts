#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
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

// For Smithery deployment, we'll handle configuration per-session
// For direct deployment, use environment variable
const DEFAULT_SEARXNG_URL = process.env.SEARXNG_INSTANCE_URL;
const DEBUG_MODE = process.env.SEARXNG_BRIDGE_DEBUG === 'true';

// Logging utility for redacting sensitive information
const redactLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    // Redact sensitive information from logs
    const redactedMessage = message
      .replace(/(Authorization: Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
      .replace(/(mcp-session-id:\s*)[^\s]+/gi, '$1[REDACTED]')
      .replace(/(SEARXNG_INSTANCE_URL=)[^\s]+/g, '$1[REDACTED]');
    
    console.error(redactedMessage, ...args);
  }
};

// Redact sensitive environment variables from logs
const redactUrl = (url: string | undefined) => {
  if (url && typeof url === 'string') {
    return url.replace(/(https?:\/\/)[^\/@]*@/, '$1[REDACTED]@');
  }
  return url || '';
};

// For direct deployment, validate environment variable at startup
// For Smithery deployment, this will be handled per-session
if (DEFAULT_SEARXNG_URL) {
  console.error(`[SearxNG Bridge] Using default SearxNG instance URL from environment: ${redactUrl(DEFAULT_SEARXNG_URL)}`);
} else {
  console.error(`[SearxNG Bridge] No default SearxNG URL configured - will use per-session configuration for Smithery deployment`);
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
  private searxngUrl: string;

  private async validateSearxngConnection(): Promise<void> {
    try {
      console.error(`[SearxNG Bridge] Validating connection to ${redactUrl(this.searxngUrl)}...`);
      const response = await this.axiosInstance.get('/search', {
        params: { q: 'connection_test', format: 'json' },
        timeout: 10000 // 10s for validation
      });
      
      if (response.status === 200 && response.data) {
        console.error(`[SearxNG Bridge] ✅ Successfully connected to SearXNG instance`);
      } else {
        console.error(`[SearxNG Bridge] ⚠️  SearXNG returned status: ${response.status}`);
      }
    } catch (error) {
      console.error(`[SearxNG Bridge] ❌ Failed to connect to SearXNG instance at ${redactUrl(this.searxngUrl)}`);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          console.error(`[SearxNG Bridge] Connection refused - check if SearXNG is running at ${redactUrl(this.searxngUrl)}`);
        } else if (error.code === 'ETIMEDOUT') {
          console.error(`[SearxNG Bridge] Connection timeout - SearXNG may be slow or unreachable`);
        } else if (error.response?.status === 404) {
          console.error(`[SearxNG Bridge] Search endpoint not found - verify SearXNG configuration`);
        } else {
          console.error(`[SearxNG Bridge] HTTP Error: ${error.response?.status || error.message}`);
        }
      } else {
        console.error(`[SearxNG Bridge] Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      console.error(`[SearxNG Bridge] Server will continue running but searches may fail`);
    }
  }

  private async performHealthCheck() {
    const startTime = Date.now();
    let searxngStatus = 'unknown';
    let responseTime = 0;

    try {
      const response = await this.axiosInstance.get('/search', {
        params: { q: 'health_check', format: 'json' },
        timeout: 5000
      });
      responseTime = Date.now() - startTime;
      searxngStatus = response.status === 200 ? 'healthy' : 'unhealthy';
    } catch (error) {
      responseTime = Date.now() - startTime;
      searxngStatus = 'error';
    }

    const healthStatus = {
      status: searxngStatus === 'healthy' ? 'healthy' : 'degraded',
      searxng_instance: this.searxngUrl,
      searxng_status: searxngStatus,
      response_time_ms: responseTime,
      cache_size: this.cache.size,
      debug_mode: DEBUG_MODE,
      version: PACKAGE_VERSION,
      timestamp: new Date().toISOString()
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(healthStatus, null, 2),
        },
      ],
      isError: searxngStatus !== 'healthy',
    };
  }

  constructor() {
    // Handle unhandled promise rejections to prevent unexpected connection closures
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
    });

    // Use environment variable (Smithery will set this)
    this.searxngUrl = DEFAULT_SEARXNG_URL || '';
    
    if (!this.searxngUrl) {
      throw new Error('SEARXNG_INSTANCE_URL environment variable is required.');
    }

    this.server = new Server(
      {
        name: 'searxng-bridge',
        version: PACKAGE_VERSION,
        description: 'MCP Server for SearxNG Bridge',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: this.searxngUrl,
      timeout: 30000, // 30s timeout for slower instances
      headers: {
        // Add a common browser User-Agent to potentially avoid bot detection
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      }
    });

    // Validate SearXNG connection on startup
    this.validateSearxngConnection();

    this.setupToolHandlers();

    this.server.onerror = (error) => {
      if (error instanceof McpError && error.code === ErrorCode.ConnectionClosed) {
        console.error('[MCP Connection] Client connection closed unexpectedly');
      } else {
        console.error('[MCP Error]', error);
      }
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
    
    setInterval(() => this.cleanCache(), 60 * 1000); // Clean cache every minute
  }

  private cleanCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) this.cache.delete(key);
    }
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
              query: {
                type: 'string',
                description: 'The search query string',
              },
              language: {
                type: 'string',
                description: 'Language code for search results (e.g., "en-US", "fr", "de")',
              },
              categories: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Categories to search in (e.g., ["general", "images", "news"])',
              },
              time_range: {
                type: 'string',
                description: 'Time range for results (e.g., "day", "week", "month", "year")',
              },
              safesearch: {
                type: 'number',
                description: 'Safe search level (0: off, 1: moderate, 2: strict)',
              },
              format: {
                type: 'string',
                description: 'Result format (default: "json", options: "json", "html")',
              },
              max_results: {
                type: 'number',
                description: 'Maximum number of results to return',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'health_check',
          description: 'Check the health and connectivity status of the SearxNG bridge',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'health_check') {
        return this.performHealthCheck();
      }

      if (request.params.name !== 'search') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
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

      const cacheKey = `search:${JSON.stringify(searchParams)}`;
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_TTL) {
        let results = cachedResult.data;
        if (args.max_results && results.results) {
          results = { ...results, results: results.results.slice(0, args.max_results) };
        }
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      // Perform the search with retry logic
      let lastError: unknown;
      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          const response = await this.axiosInstance.get('/search', { params: searchParams });
          let results = response.data;
          if (args.max_results && results.results) {
            results = { ...results, results: results.results.slice(0, args.max_results) };
          }
          if (cacheKey) {
            this.cache.set(cacheKey, { timestamp: Date.now(), data: response.data });
          }
          return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
        } catch (error) {
          lastError = error;
          if (attempt < this.MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
          }
        }
      }

      // All retries failed
      let errorMessage = `Failed to fetch search results from SearxNG instance at ${redactUrl(this.searxngUrl)} after ${this.MAX_RETRIES} attempts.`;
      
      if (axios.isAxiosError(lastError)) {
        if (lastError.code === 'ECONNREFUSED') {
          errorMessage = `Connection refused to SearXNG at ${redactUrl(this.searxngUrl)} - check if the instance is running and accessible`;
        } else if (lastError.code === 'ETIMEDOUT') {
          errorMessage = `Connection timeout to SearXNG at ${redactUrl(this.searxngUrl)} - the instance may be slow or unreachable`;
        } else if (lastError.code === 'ENOTFOUND') {
          errorMessage = `SearXNG instance not found at ${redactUrl(this.searxngUrl)} - check the URL configuration`;
        } else if (lastError.response?.status === 404) {
          errorMessage = `SearXNG search endpoint not found at ${redactUrl(this.searxngUrl)}/search - verify instance configuration`;
        } else if (lastError.response?.status === 503) {
          errorMessage = `SearXNG service unavailable (503) - the instance may be overloaded or down`;
        } else if (lastError.response?.status) {
          errorMessage = `SearXNG request error (${redactUrl(this.searxngUrl)}): HTTP ${lastError.response.status} - ${lastError.response.statusText}`;
        } else {
          errorMessage = `SearXNG request error (${redactUrl(this.searxngUrl)}): ${lastError.message}`;
        }
      } else if (lastError instanceof Error) {
        errorMessage = `Unexpected error while contacting ${redactUrl(this.searxngUrl)}: ${lastError.message}`;
      }

      return { content: [{ type: 'text', text: errorMessage }], isError: true as const };
    });
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
       const PORT = parseInt(process.env.PORT || '3002', 10);
       const HOST = process.env.HOST || '127.0.0.1';
       app.use(express.json());
      
      // Add a logging middleware to inspect headers
      app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        redactLog(`[SearxNG Bridge] Incoming request: ${req.method} ${req.path}`);
        redactLog(`[SearxNG Bridge] Headers: ${JSON.stringify(req.headers, null, 2)}`);
        next();
      });

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
            }
          }
        }
        next();
      };
      
      // Apply the bearer auth middleware
      app.use(bearerAuthMiddleware);
      
        // Secure CORS configuration with whitelist approach
        const corsOrigin = process.env.CORS_ORIGIN 
          ? (process.env.CORS_ORIGIN.includes(',') 
              ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) 
              : process.env.CORS_ORIGIN)
          : process.env.NODE_ENV === 'production' 
            ? '*' // Smithery requires wildcard for their deployment
            : ['http://localhost:3002', 'http://127.0.0.1:3002']; // Development whitelist - only port 3002
        
        // CORS validation function
        const validateOrigin = (origin: string | undefined, allowedOrigins: string | string[]): boolean => {
          if (!origin) return true; // Allow requests with no origin (curl, mobile apps)
          if (allowedOrigins === '*') return true; // Wildcard allows all origins
          if (Array.isArray(allowedOrigins)) {
            return allowedOrigins.some(allowed => allowed === origin);
          }
          return allowedOrigins === origin;
        };
        
        app.use(cors({
         origin: (origin, callback) => {
           // For credentialed requests, we cannot use wildcard
           // Must reflect the actual origin or return specific allowed origins
           if (!origin) {
             // No origin header (curl, mobile apps) - allow but don't use credentials
             return callback(null, false);
           }
           
           if (validateOrigin(origin, corsOrigin)) {
             // Return the specific origin for credentialed requests
             callback(null, origin);
           } else {
             redactLog(`[SearxNG Bridge] CORS blocked origin: ${origin}`);
             callback(new Error('Not allowed by CORS'));
           }
         },
         credentials: corsOrigin !== '*', // Only enable credentials for non-wildcard
         exposedHeaders: ['mcp-session-id', 'mcp-protocol-version'],
         allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
         methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
       }));

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

      app.post('/mcp', mcpRateLimit, async (req: express.Request, res: express.Response) => {
        redactLog(`[SearxNG Bridge] POST /mcp received: ${JSON.stringify(req.body)}`);
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
            enableDnsRebindingProtection: true, // Enable for security
            allowedHosts: [`${HOST}:${PORT}`, `localhost:${PORT}`, '127.0.0.1:' + PORT]
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

      const handleSessionRequest = async (req: express.Request, res: express.Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      };

      // OPTIONS endpoint for CORS preflight requests with security
      app.options('/mcp', (req: express.Request, res: express.Response) => {
        const origin = req.headers.origin;
        
        // Validate origin for preflight requests
        if (!origin) {
          // No origin header - allow without credentials
          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');
          res.header('Access-Control-Expose-Headers', 'mcp-session-id, mcp-protocol-version');
          res.status(200).send();
          return;
        }
        
        if (validateOrigin(origin, corsOrigin)) {
          // For credentialed requests, must reflect specific origin
          res.header('Access-Control-Allow-Origin', origin);
          res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');
          res.header('Access-Control-Allow-Credentials', 'true');
          res.header('Access-Control-Expose-Headers', 'mcp-session-id, mcp-protocol-version');
          res.status(200).send();
        } else {
          redactLog(`[SearxNG Bridge] CORS preflight blocked origin: ${origin}`);
          res.status(403).json({ error: 'Origin not allowed' });
        }
      });

      app.get('/mcp', handleSessionRequest);
      app.get('/healthz', async (req: express.Request, res: express.Response) => {
        const healthResult = await this.performHealthCheck();
        res.status(200).json({ 
          status: 'ok', 
          version: PACKAGE_VERSION,
          searxng_health: healthResult.isError ? 'unhealthy' : 'healthy'
        });
      });
       app.delete('/mcp', handleSessionRequest);
 
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

// Create server instance - Smithery will set SEARXNG_INSTANCE_URL as environment variable
const server = new SearxngBridgeServer();
server.run().catch(console.error);