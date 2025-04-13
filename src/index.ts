#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ErrorCode,
	ListToolsRequestSchema,
	McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// Define the structure of the arguments for the search tool
interface SearchArgs {
	query: string;
}

// Type guard to check if the arguments match the expected structure
const isValidSearchArgs = (args: any): args is SearchArgs =>
	typeof args === 'object' && args !== null && typeof args.query === 'string';

// Read SearxNG URL from environment variable, default to localhost
const SEARXNG_URL = process.env.SEARXNG_INSTANCE_URL || 'http://localhost:8888';

// Log a warning if the default URL is being used
if (!process.env.SEARXNG_INSTANCE_URL) {
	console.warn(
		`[SearxNG Bridge] WARNING: SEARXNG_INSTANCE_URL environment variable not set. Defaulting to ${SEARXNG_URL}`
	);
} else {
    console.log(`[SearxNG Bridge] Using SearxNG instance URL: ${SEARXNG_URL}`);
}


class SearxngBridgeServer {
	private server: Server;
	private axiosInstance;

	constructor() {
		this.server = new Server(
			{
				name: 'searxng-bridge',
				version: '0.1.0',
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
			baseURL: SEARXNG_URL, // Use the environment variable or default
			timeout: 10000, // 10 second timeout
		});

		this.setupToolHandlers();

		// Basic error handling
		this.server.onerror = (error) => console.error('[MCP Error]', error);
		process.on('SIGINT', async () => {
			await this.server.close();
			process.exit(0);
		});
	}

	private setupToolHandlers() {
		// Handler for listing available tools
		this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools: [
				{
					name: 'search', // Tool name
					description:
						'Perform a search using the configured SearxNG instance', // Updated description
					inputSchema: {
						// JSON Schema defining the expected input arguments
						type: 'object',
						properties: {
							query: {
								type: 'string',
								description: 'The search query string',
							},
						},
						required: ['query'], // 'query' is mandatory
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

			const query = request.params.arguments.query;

			try {
				// Make the GET request to SearxNG's search endpoint
				const response = await this.axiosInstance.get('/search', {
					params: {
						q: query,
						format: 'json', // Request results in JSON format
					},
				});

				// Return the SearxNG JSON response as text content
				return {
					content: [
						{
							type: 'text',
							// Pretty-print the JSON response for readability
							text: JSON.stringify(response.data, null, 2),
						},
					],
				};
			} catch (error) {
				let errorMessage = `Failed to fetch search results from SearxNG instance at ${SEARXNG_URL}.`; // Include URL in error
				if (axios.isAxiosError(error)) {
					errorMessage = `SearxNG request error (${SEARXNG_URL}): ${
						error.response?.data?.message || error.message
					}`;
					// Include status code if available
					if (error.response?.status) {
						errorMessage += ` (Status: ${error.response.status})`;
					}
				} else if (error instanceof Error) {
					errorMessage = `Unexpected error while contacting ${SEARXNG_URL}: ${error.message}`;
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
		});
	}

	async run() {
		// Use Stdio transport for local server communication
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error('SearxNG Bridge MCP server running on stdio');
	}
}

// Create and run the server instance
const server = new SearxngBridgeServer();
server.run().catch(console.error);
