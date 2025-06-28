[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/nitish-raj-searxng-mcp-bridge-badge.png)](https://mseep.ai/app/nitish-raj-searxng-mcp-bridge)

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

4. **Validate your package before publishing** (optional):
   - After pushing your code to GitHub, go to the "Actions" tab
   - Select the "Validate Package" workflow
   - Click "Run workflow"
   - This will build and pack your package without publishing it
   - You can download the packed package as an artifact to inspect it

### Release Process

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
   - Update the version in `package.json`.
   - **Automatically update `CHANGELOG.md`** based on commit messages since the last tag (using `conventional-changelog-cli`). Ensure `conventional-changelog-cli` is installed (`npm install --save-dev conventional-changelog-cli`) and use [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: ...`, `fix: ...`) for meaningful changelog entries.
   - Create a git commit and tag locally.
   
3. **Publishing**:
   ```bash
   # Push the commit and tag
   git push && git push --tags
   ```
   
   The GitHub Actions workflow will automatically:
   - Build the project
   - Publish to npm
   - Create a GitHub release

The `CHANGELOG.md` file is automatically updated by the release script based on conventional commit messages.


## Contributing

Contributions are welcome!

Please see the GitHub repository for contribution guidelines.
