#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

// Get package version
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
	if (typeof args !== 'object' || args === null || typeof args.query !== 'string') {
		return false;
	}
	
	// Validate optional parameters
	if (args.language !== undefined && typeof args.language !== 'string') return false;
	if (args.categories !== undefined && !Array.isArray(args.categories)) return false;
	if (args.time_range !== undefined && typeof args.time_range !== 'string') return false;
	if (args.safesearch !== undefined && typeof args.safesearch !== 'number') return false;
	if (args.format !== undefined && typeof args.format !== 'string') return false;
	if (args.max_results !== undefined && typeof args.max_results !== 'number') return false;
	
	return true;
};

// Mandatory: SearxNG instance URL from environment variable
const SEARXNG_URL = process.env.SEARXNG_INSTANCE_URL;
const DEBUG_MODE = process.env.SEARXNG_BRIDGE_DEBUG === 'true';

if (!SEARXNG_URL) {
	console.error(
		'[SearxNG Bridge] ERROR: SEARXNG_INSTANCE_URL environment variable is not set. This is required.'
	);
	process.exit(1);
} else {
	   console.log(`[SearxNG Bridge] Using SearxNG instance URL: ${SEARXNG_URL}`);
}

interface CacheEntry {
	timestamp: number;
	data: any;
}

class SearxngBridgeServer {
	private server: Server;
	private axiosInstance: AxiosInstance;
	private cache: Map<string, CacheEntry> = new Map();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
	private readonly MAX_RETRIES = 3;
	private readonly RETRY_DELAY = 1000; // 1 second

	constructor() {
		// Handle unhandled promise rejections to prevent unexpected connection closures
		process.on('unhandledRejection', (reason, promise) => {
			console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
		});
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
			baseURL: SEARXNG_URL,
			timeout: 15000, // 15s timeout
			headers: {
				// Add a common browser User-Agent to potentially avoid bot detection
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
			}
		});

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
			if (now - entry.timestamp > this.CACHE_TTL) {
				this.cache.delete(key);
				if (DEBUG_MODE) {
					console.log(`[SearxNG Bridge] Removed expired cache entry for: ${key}`);
				}
			}
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
			],
		}));

		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			if (request.params.name !== 'search') {
				throw new McpError(
					ErrorCode.MethodNotFound,
					`Unknown tool: ${request.params.name}`
				);
			}

			if (!isValidSearchArgs(request.params.arguments)) {
				throw new McpError(
					ErrorCode.InvalidParams,
					'Invalid search arguments. Requires a "query" string.'
				);
			}

			const args = request.params.arguments;
			
			const searchParams: Record<string, any> = {
				q: args.query,
				format: args.format || 'json',
			};
			
			if (args.language) searchParams.language = args.language;
			if (args.categories) searchParams.categories = args.categories.join(',');
			if (args.time_range) searchParams.time_range = args.time_range;
			if (args.safesearch !== undefined) searchParams.safesearch = args.safesearch;
			
			const cacheKey = this.getCacheKey(searchParams);
			const cachedResult = this.cache.get(cacheKey);
			
			if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_TTL) {
				if (DEBUG_MODE) {
					console.log(`[SearxNG Bridge] Cache hit for query: ${args.query}`);
				}
				
				let results = cachedResult.data;
				if (args.max_results && results.results) {
					results = {
						...results,
						results: results.results.slice(0, args.max_results)
					};
				}
				
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(results, null, 2),
						},
					],
				};
			}

			// Not cached or expired, perform search
			return await this.performSearchWithRetry(searchParams, args.max_results, cacheKey);
		});
	}
	
	private async performSearchWithRetry(
		searchParams: Record<string, any>, 
		maxResults?: number,
		cacheKey?: string
	) {
		let lastError;
		
		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				if (DEBUG_MODE && attempt > 1) {
					console.log(`[SearxNG Bridge] Retry attempt ${attempt} for query: ${searchParams.q}`);
				}
				
				const response = await this.axiosInstance.get('/search', {
					params: searchParams,
				});
				
				let results = response.data;
				
				if (maxResults && results.results) {
					results = {
						...results,
						results: results.results.slice(0, maxResults)
					};
				}
				
				if (cacheKey) {
					this.cache.set(cacheKey, {
						timestamp: Date.now(),
						data: response.data // Cache the full original response
					});
					
					if (DEBUG_MODE) {
						console.log(`[SearxNG Bridge] Cached results for query: ${searchParams.q}`);
					}
				}

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(results, null, 2),
						},
					],
				};
			} catch (error) {
				lastError = error;
				
				if (attempt < this.MAX_RETRIES) {
					await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
				}
			}
		}
		
		// All retries failed
		let errorMessage = `Failed to fetch search results from SearxNG instance at ${SEARXNG_URL} after ${this.MAX_RETRIES} attempts.`;
		
		if (axios.isAxiosError(lastError)) {
			errorMessage = `SearxNG request error (${SEARXNG_URL}): ${
				lastError.response?.data?.message || lastError.message
			}`;
			if (lastError.response?.status) {
				errorMessage += ` (Status: ${lastError.response.status})`;
			}
		} else if (lastError instanceof Error) {
			errorMessage = `Unexpected error while contacting ${SEARXNG_URL}: ${lastError.message}`;
		}

		return {
			content: [
				{
					type: 'text',
					text: errorMessage,
				},
			],
			isError: true,
		};
	}

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error(`SearxNG Bridge MCP server v${PACKAGE_VERSION} running on stdio`);
		if (DEBUG_MODE) {
			console.error('[SearxNG Bridge] Debug mode enabled');
		}
	}
}

const server = new SearxngBridgeServer();
server.run().catch(console.error);
