# SearxNG MCP Bridge Server

This is a Model Context Protocol (MCP) server that acts as a bridge to a SearxNG instance. It allows compatible clients (like Roo) to perform searches using a configured SearxNG instance via MCP tools.

## Features

*   Provides an MCP tool named `search`.
*   Connects to a SearxNG instance specified by an environment variable.
*   Returns search results from SearxNG in JSON format.

## Prerequisites

*   Node.js and npm installed.
*   A running SearxNG instance accessible from where this server will run.

## Installation & Configuration

1.  **Clone the repository (Optional - if not installing via npm later):**
    ```bash
    git clone <your-repo-url>
    cd searxng-mcp-bridge
    npm install
    npm run build
    ```

2.  **Add to MCP Settings:**
    Add the following configuration to your MCP settings file (e.g., `~/.vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`):

    ```json
    {
      "mcpServers": {
        "...": {},
        "searxng-bridge": {
          "command": "node",
          "args": [
            "/path/to/searxng-mcp-bridge/build/index.js" // Adjust path if needed
          ],
          "env": {
            // Required: URL of your accessible SearxNG instance
            "SEARXNG_INSTANCE_URL": "http://your-searxng-instance.example.com"
          },
          "disabled": false,
          "alwaysAllow": ["search"] // Optional: Allow search without confirmation
        }
      }
    }
    ```
    *   Replace `/path/to/searxng-mcp-bridge/build/index.js` with the actual path to the built server file.
    *   **Crucially**, set `SEARXNG_INSTANCE_URL` in the `env` section to the URL of the SearxNG instance the bridge should connect to. If not set, it defaults to `http://localhost:8888`.

3.  **Restart MCP Client:** Restart the application using MCP (e.g., VS Code with the Roo extension) to load the new server configuration.

## Usage

Once configured, you can instruct your MCP client (like Roo) to use the tool:

"Use the searxng-bridge search tool to search for 'your query'"

## Development

*   `npm install`: Install dependencies.
*   `npm run build`: Compile TypeScript to JavaScript.
*   `npm run watch`: Watch for changes and rebuild automatically.
