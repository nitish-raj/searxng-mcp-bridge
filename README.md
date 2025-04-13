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
*   `npm run inspector`: Run the MCP inspector to test the server.

## Release Process

This project uses GitHub Actions for continuous integration and deployment:

### Initial Setup (First-time only)

1. **Push the code to GitHub**:
   ```bash
   # Initialize git if not already done
   git init
   git add .
   git commit -m "Initial commit"
   
   # Add your GitHub repository as remote
   git remote add origin https://github.com/nitish-raj/searxng-mcp-bridge.git
   git push -u origin main
   ```

2. **Set up npm access**:
   ```bash
   # Login to npm (you'll need an npm account)
   npm login
   
   # Generate an access token for GitHub Actions
   # Go to npmjs.com → User Settings → Access Tokens → Generate New Token
   ```

3. **Add the npm token to GitHub repository secrets**:
   - Go to your GitHub repository
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: [Your npm access token]
   - Click "Add secret"

4. **Validate your package before publishing**:
   - After pushing your code to GitHub, go to the "Actions" tab
   - Select the "Validate Package" workflow
   - Click "Run workflow"
   - This will build and pack your package without publishing it
   - You can download the packed package as an artifact to inspect it

### Regular Release Process

1. **Continuous Integration**: Every push to main and pull request is automatically built and tested.
2. **Release Management**: When a new version is ready to be released:

   ```bash
   # For a patch release (0.1.0 -> 0.1.1)
   npm run release:patch
   
   # For a minor release (0.1.0 -> 0.2.0)
   npm run release:minor
   
   # For a major release (0.1.0 -> 1.0.0)
   npm run release:major
   ```

   This will:
   - Update the version in package.json
   - Update the CHANGELOG.md
   - Create a git commit and tag
   
3. **Publishing**:
   ```bash
   # Push the commit and tag
   git push && git push --tags
   ```
   
4. **Create a GitHub Release**:
   - Go to the GitHub repository
   - Navigate to "Releases"
   - Click "Create a new release"
   - Select the tag you just pushed
   - GitHub Actions will automatically publish to npm

The CHANGELOG.md file is used to track all notable changes between versions.
