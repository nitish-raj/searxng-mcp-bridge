# [0.9.0](https://github.com/nitish-raj/searxng-mcp-bridge/compare/v0.8.0...v0.9.0) (2025-08-02)


### Bug Fixes

* **workflow:** remove unnecessary secrets inheritance from release workflow call ([c6eee1a](https://github.com/nitish-raj/searxng-mcp-bridge/commit/c6eee1a35cd0e6ec7ded967aac557abb2ed24ac2))


### Features

* **release:** enhance auto-release workflow with version bumping and tagging ([4bd0e74](https://github.com/nitish-raj/searxng-mcp-bridge/commit/4bd0e745e54134e091b3cb9a5ee6aeac01d2868a))



# [0.8.0](https://github.com/nitish-raj/searxng-mcp-bridge/compare/v0.7.0...v0.8.0) (2025-08-02)


### Bug Fixes

* **deps:** update dependency @modelcontextprotocol/sdk to v1.17.1 ([#30](https://github.com/nitish-raj/searxng-mcp-bridge/issues/30)) ([e6e58d5](https://github.com/nitish-raj/searxng-mcp-bridge/commit/e6e58d5fd8e83cf73512869c961a453ef29243c2))



# [0.7.0](https://github.com/nitish-raj/searxng-mcp-bridge/compare/v0.6.1...v0.7.0) (2025-07-31)



## [0.6.1](https://github.com/nitish-raj/searxng-mcp-bridge/compare/v0.6.0...v0.6.1) (2025-07-27)


### Bug Fixes

* :green_heart: validate on every push ([b906787](https://github.com/nitish-raj/searxng-mcp-bridge/commit/b906787b14581550831a3304fba162a23c332bd9))
* simplify auto-release condition and allow manual triggering for package validation ([9bf30fe](https://github.com/nitish-raj/searxng-mcp-bridge/commit/9bf30fe39db3512bdae9c8fb66fb60999f1376ae))


### Features

* add version tag to GitHub release and update version script in package.json ([37af3d4](https://github.com/nitish-raj/searxng-mcp-bridge/commit/37af3d4764a7e3ba23a976ff23b6a9af106848a8))
* enhance release workflow with version extraction and validation ([a213f6d](https://github.com/nitish-raj/searxng-mcp-bridge/commit/a213f6d1686f9753442c3c4765f90bdb3bd0df1f))
* update CI/CD workflows for improved testing and release process ([8b243f1](https://github.com/nitish-raj/searxng-mcp-bridge/commit/8b243f15cdc2209d1f5e2b3c74ccaa7acb5baedb))



# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

# [0.5.0](https://github.com/nitish-raj/searxng-mcp-bridge/compare/v0.4.4...v0.5.0) (2025-06-27)


### Bug Fixes

* **ci:** update Node.js version matrix to 20.x and 22.x ([9110407](https://github.com/nitish-raj/searxng-mcp-bridge/commit/9110407791765eecb93949e483cbc592e5448297))
* **deps:** update dependency @modelcontextprotocol/sdk to v0.7.0 ([1828fc3](https://github.com/nitish-raj/searxng-mcp-bridge/commit/1828fc3183faf8d27263c9a7a8dcfbf581af8116))
* **deps:** update dependency @modelcontextprotocol/sdk to v1 ([17dc3ce](https://github.com/nitish-raj/searxng-mcp-bridge/commit/17dc3ce7529af4730f9653f96ce62ba8d8e9186d))
* **deps:** update dependency axios to v1.10.0 ([a14108c](https://github.com/nitish-raj/searxng-mcp-bridge/commit/a14108c315fd5f8af3075fa420fd706cabe32f5e))

## [0.4.4](https://github.com/nitish-raj/searxng-mcp-bridge/compare/v0.4.3...v0.4.4) (2025-04-16)

## [0.4.3](https://github.com/nitish-raj/searxng-mcp-bridge/compare/v0.4.2...v0.4.3) (2025-04-16)


### Bug Fixes

* Correctly insert generated changelog content ([4df63c1](https://github.com/nitish-raj/searxng-mcp-bridge/commit/4df63c111b06bb7336cb69f293d5191bb04d3697))


### Features

* Improve release process and public instance compatibility ([344fdce](https://github.com/nitish-raj/searxng-mcp-bridge/commit/344fdcebce9f819aefe339ce62db61308a9172e7))

### Added

### Changed

### Fixed

## [0.4.2] - 2025-04-16

### Added

### Changed

### Fixed
## [0.4.1] - 2025-04-14

### Added

### Changed

### Fixed

## [0.4.0] - 2025-04-13

### Added

### Changed

### Fixed

## [0.3.0] - 2025-04-13

### Added

### Changed

### Fixed

## [0.2.0] - 2025-04-13

### Added
- GitHub Actions workflows for CI and release management
- CHANGELOG.md for tracking changes

## [0.1.0] - 2025-04-13

### Added
- Initial release
- Basic MCP server implementation for SearxNG bridge
- Search tool for querying a SearxNG instance
- Configuration via environment variables
- Error handling for SearxNG requests