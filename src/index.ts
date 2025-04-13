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

// Read package version from package.json to ensure consistency
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const PACKAGE_VERSION = packageJson.version;

// Define the structure of the arguments for the search tool with advanced options
interface SearchArgs {
	query: string;
	language?: string;
	categories?: string[];
	time_range?: string;
	safesearch?: number;
	format?: string;
	max_results?: number;
}

// Type guard to check if the arguments match the expected structure
const isValidSearchArgs = (args: any): args is SearchArgs => {
	if (typeof args !== 'object' || args === null || typeof args.query !== 'string') {
		return false;
	}
	
	// Optional parameters validation
	if (args.language !== undefined && typeof args.language !== 'string') return false;
	if (args.categories !== undefined && !Array.isArray(args.categories)) return false;
	if (args.time_range !== undefined && typeof args.time_range !== 'string') return false;
	if (args.safesearch !== undefined && typeof args.safesearch !== 'number') return false;
	if (args.format !== undefined && typeof args.format !== 'string') return false;
	if (args.max_results !== undefined && typeof args.max_results !== 'number') return false;
	
	return true;
};

// Read SearxNG URL from environment variable, default to localhost
const SEARXNG_URL = process.env.SEARXNG_INSTANCE_URL || 'http://localhost:8888';
const DEBUG_MODE = process.env.SEARXNG_BRIDGE_DEBUG === 'true';

// Log a warning if the default URL is being used
if (!process.env.SEARXNG_INSTANCE_URL) {
	console.warn(
		`[SearxNG Bridge] WARNING: SEARXNG_INSTANCE_URL environment variable not set. Defaulting to ${SEARXNG_URL}`
	);
} else {
    console.log(`[SearxNG Bridge] Using SearxNG instance URL: ${SEARXNG_URL}`);
}

// Simple in-memory cache for search results
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
		this.server = new Server(
			{
				name: 'searxng-bridge',
				version: PACKAGE_VERSION, // Use version from package.json
				description: 'MCP Server for SearxNG Bridge',
			},
			{
				capabilities: {
					// No static resources or templates needed for this bridge
					resources: {},
					tools: {},
				},
			}
		);

		// Configure axios for SearxNG requests using the determined URL
		this.axiosInstance = axios.create({
			baseURL: SEARXNG_URL,
			timeout: 15000, // 15 second timeout (increased from 10s)
		});

		this.setupToolHandlers();

		// Basic error handling
		this.server.onerror = (error) => console.error('[MCP Error]', error);
		process.on('SIGINT', async () => {
			await this.server.close();
			process.exit(0);
		});
		
		// Clean expired cache entries periodically
		setInterval(() => this.cleanCache(), 60 * 1000); // Clean every minute
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
		// Handler for listing available tools
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

		// Handler for executing the 'search' tool
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			// Ensure the correct tool is being called
			if (request.params.name !== 'search') {
				throw new McpError(
					ErrorCode.MethodNotFound,
					`Unknown tool: ${request.params.name}`
				);
			}

			// Validate the arguments provided for the tool
			if (!isValidSearchArgs(request.params.arguments)) {
				throw new McpError(
					ErrorCode.InvalidParams,
					'Invalid search arguments. Requires a "query" string.'
				);
			}

			const args = request.params.arguments;
			
			// Prepare search parameters
			const searchParams: Record<string, any> = {
				q: args.query,
				format: args.format || 'json',
			};
			
			// Add optional parameters if provided
			if (args.language) searchParams.language = args.language;
			if (args.categories) searchParams.categories = args.categories.join(',');
			if (args.time_range) searchParams.time_range = args.time_range;
			if (args.safesearch !== undefined) searchParams.safesearch = args.safesearch;
			
			// Check cache first
			const cacheKey = this.getCacheKey(searchParams);
			const cachedResult = this.cache.get(cacheKey);
			
			if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_TTL) {
				if (DEBUG_MODE) {
					console.log(`[SearxNG Bridge] Cache hit for query: ${args.query}`);
				}
				
				// Process cached results with max_results if specified
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

			// Not in cache or expired, make the request with retry logic
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
				
				// Make the GET request to SearxNG's search endpoint
				const response = await this.axiosInstance.get('/search', {
					params: searchParams,
				});
				
				let results = response.data;
				
				// Apply max_results filter if specified
				if (maxResults && results.results) {
					results = {
						...results,
						results: results.results.slice(0, maxResults)
					};
				}
				
				// Cache the results
				if (cacheKey) {
					this.cache.set(cacheKey, {
						timestamp: Date.now(),
						data: response.data // Cache the full response
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
					// Wait before retrying
					await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
				}
			}
		}
		
		// All retries failed, handle the error
		let errorMessage = `Failed to fetch search results from SearxNG instance at ${SEARXNG_URL} after ${this.MAX_RETRIES} attempts.`;
		
		if (axios.isAxiosError(lastError)) {
			errorMessage = `SearxNG request error (${SEARXNG_URL}): ${
				lastError.response?.data?.message || lastError.message
			}`;
			// Include status code if available
			if (lastError.response?.status) {
				errorMessage += ` (Status: ${lastError.response.status})`;
			}
		} else if (lastError instanceof Error) {
			errorMessage = `Unexpected error while contacting ${SEARXNG_URL}: ${lastError.message}`;
		}

		// Return an error response via MCP
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
		// Use Stdio transport for local server communication
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error(`SearxNG Bridge MCP server v${PACKAGE_VERSION} running on stdio`);
		if (DEBUG_MODE) {
			console.error('[SearxNG Bridge] Debug mode enabled');
		}
	}
}

// Create and run the server instance
const server = new SearxngBridgeServer();
server.run().catch(console.error);
