[![Release](https://github.com/nitish-raj/searxng-mcp-bridge/actions/workflows/release.yml/badge.svg)](https://github.com/nitish-raj/searxng-mcp-bridge/actions/workflows/release.yml)
[![smithery badge](https://smithery.ai/badge/@nitish-raj/searxng-mcp-bridge)](https://smithery.ai/server/@nitish-raj/searxng-mcp-bridge)

# SearXNG MCP Bridge Server

This is a Model Context Protocol (MCP) server that acts as a bridge to a [SearXNG](https://github.com/searxng/searxng) instance. It allows compatible clients to perform searches using a configured SearXNG instance via MCP tools.

## Quick Start (Using from npm)

1. **Set up a SearXNG instance**:
   ```bash
   # Using Docker
   docker run -d -p 8888:8080 --name searxng searxng/searxng
   ```

2. **Install and run the MCP bridge**:
   ```bash
   # Run directly with npx
   npx @nitish-raj/searxng-mcp-bridge
   ```

3. **Configure in your MCP settings file**:
   Add to your MCP settings file (e.g., `~/.vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`):
   ```json
   {
     "mcpServers": {
       "searxng-bridge": {
         "command": "npx",
         "args": ["@nitish-raj/searxng-mcp-bridge"],
         "env": {
           "SEARXNG_INSTANCE_URL": "YOUR_SEARXNG_INSTANCE_URL" # Replace with your instance URL (e.g., http://localhost:8888 or a public one)
         },
         "disabled": false
       }
     }
   }
   ```

## Features

*   Provides an MCP tool named `search`.
*   Connects to a SearXNG instance specified by an environment variable.
*   Returns search results from SearXNG in JSON format.

## Prerequisites

*   Node.js and npm installed.
*   A running SearXNG instance accessible from where this server will run.

## Installation & Configuration

### Installing via Smithery

To install searxng-mcp-bridge for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@nitish-raj/searxng-mcp-bridge):

```bash
npx -y @smithery/cli install @nitish-raj/searxng-mcp-bridge --client claude
```

### Option 1: Using npm (Recommended)

1. **Install the package globally:**
   ```bash
   npm install -g @nitish-raj/searxng-mcp-bridge
   ```

2. **Add to MCP Settings:**
   Add the following configuration to your MCP settings file (e.g., `~/.vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`):

   ```json
   {
     "mcpServers": {
       "searxng-bridge": {
         "command": "mcp-searxng-bridge",
         "env": {
           "SEARXNG_INSTANCE_URL": "YOUR_SEARXNG_INSTANCE_URL" # Replace with your instance URL (e.g., http://localhost:8888 or a public one)
         },
         "disabled": false,
         "alwaysAllow": ["search"] // Optional: Allow search without confirmation
       }
     }
   }
   ```
   * **Crucially**, set the `SEARXNG_INSTANCE_URL` environment variable in the `env` section to the URL of the SearXNG instance the bridge should connect to (e.g., `http://localhost:8888` or a public instance like `https://searx.space/`). **This variable is mandatory.**

### Option 2: From Source

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nitish-raj/searxng-mcp-bridge.git
   cd searxng-mcp-bridge
   npm install
   npm run build
   ```

2. **Add to MCP Settings:**
   Add the following configuration to your MCP settings file:
   ```json
   {
     "mcpServers": {
       "searxng-bridge": {
         "command": "node",
         "args": [
           "/path/to/searxng-mcp-bridge/build/index.js" // Adjust path if needed
         ],
         "env": {
           "SEARXNG_INSTANCE_URL": "YOUR_SEARXNG_INSTANCE_URL" # Replace with your instance URL (e.g., http://localhost:8888 or a public one)
         },
         "disabled": false
       }
     }
   }
   ```
   * Replace `/path/to/searxng-mcp-bridge/build/index.js` with the actual path to the built server file.

3. **Restart MCP Client:** Restart the application using MCP (e.g., VS Code with the Roo extension) to load the new server configuration.

## Setting up SearXNG

You need a running SearXNG instance to use this bridge. Here are some options:

1. **Using Docker (Recommended):**
   ```bash
   docker run -d -p 8888:8080 --name searxng searxng/searxng
   ```

2. **Using Docker Compose:**
   Create a `docker-compose.yml` file:
   ```yaml
   version: '3'
   services:
     searxng:
       image: searxng/searxng
       ports:
         - "8888:8080"
       restart: unless-stopped
   ```
   Then run:
   ```bash
   docker-compose up -d
   ```

3. **For more advanced configuration options**, refer to the [SearXNG documentation](https://github.com/searxng/searxng).

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

### Release Process

This project uses GitHub Actions for automated and manual releases.

#### Automated Releases (for Renovate)

When a pull request from Renovate is merged, the `release.yml` workflow is automatically triggered. This workflow handles the following:

-   **Bumps the `minor` version** of the package.
-   **Updates the `CHANGELOG.md`** with the latest changes.
-   **Publishes the new version** to the npm registry.
-   **Creates a GitHub release** with the corresponding tag and changelog.

This process is fully automated and requires no manual intervention for dependency updates.

#### Manual Releases

To create a manual release, follow these steps:

1.  **Update the version locally**:
    Use the `npm version` command to bump the package version and create a corresponding git tag. This will also update the `CHANGELOG.md` file.

    ```bash
    # For a patch release (e.g., 0.1.0 -> 0.1.1)
    npm version patch

    # For a minor release (e.g., 0.1.0 -> 0.2.0)
    npm version minor

    # For a major release (e.g., 0.1.0 -> 1.0.0)
    npm version major
    ```

2.  **Push the changes to GitHub**:
    Push the commit and the newly created tag to the `main` branch.

    ```bash
    git push && git push --tags
    ```

3.  **Trigger the release workflow**:
    Pushing the tag will trigger the `release.yml` workflow, which will build the package, publish it to npm, and create a GitHub release.


## Contributing

Contributions are welcome!

Please see the GitHub repository for contribution guidelines.
