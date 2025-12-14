# Agent Guidelines

This document provides guidance for AI agents working on this codebase.

## Project Overview

**gongio-mcp** is an MCP (Model Context Protocol) server that provides access to Gong.io data. It allows MCP-compatible clients like Claude Desktop to query calls, retrieve transcripts, and list users from Gong.

## Tech Stack

- **Runtime**: Node.js 24+
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm (enforced via corepack)
- **Linting/Formatting**: Biome
- **Testing**: Vitest
- **CI/CD**: GitHub Actions
- **Releases**: release-please (conventional commits)

## Project Structure

```
src/
  index.ts      # MCP server entry point, tool handlers
  gong.ts       # Gong API client
test/
  *.test.ts     # Vitest tests
scripts/
  validate-mcp.js  # Validates server.json and package.json consistency
.github/workflows/
  ci.yaml          # Tests, lint, MCP validation
  release.yaml     # Automated releases via release-please
  publish-mcp.yaml # Manual MCP registry publishing
```

## Git Workflow

**IMPORTANT: Do not commit directly to main.**

All changes must go through pull requests:

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes and commit using conventional commits
3. Push and open a PR: `gh pr create`
4. Wait for CI to pass
5. Merge via GitHub

### Commit Message Format

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests

Examples:
```
feat: add support for call recordings
fix: handle pagination cursor correctly
docs: update API usage examples
```

## Development Commands

```bash
# Install dependencies (npm is blocked, use pnpm)
corepack enable
pnpm install

# Development with watch mode
pnpm run dev

# Build
pnpm run build

# Run tests
pnpm test
pnpm run test:coverage

# Lint and format
pnpm run lint
pnpm run fix
pnpm run format

# Validate MCP configuration
pnpm run validate:mcp

# Type check
pnpm run typecheck
```

## Pre-commit Hooks

Husky runs these checks before each commit:
1. `pnpm run validate:mcp` - Ensures server.json is valid
2. `pnpm test` - Runs the test suite

## Key Files to Keep in Sync

When updating versions, these files must stay synchronized:
- `package.json` (version field)
- `server.json` (version and packages[0].version)
- `.release-please-manifest.json`

The `scripts/validate-mcp.js` script validates this consistency.

## Environment Variables

The server requires these environment variables:
- `GONG_ACCESS_KEY` - Gong API access key
- `GONG_ACCESS_KEY_SECRET` - Gong API secret key

Use `.env` file locally (never commit it). Node 24's native `--env-file` flag loads it automatically.

## MCP Tools Provided

| Tool | Description |
|------|-------------|
| `list_calls` | List calls with date filtering and pagination |
| `get_call_details` | Get detailed call info (participants, topics, action items) |
| `get_transcripts` | Retrieve speaker-attributed transcripts |
| `list_users` | List all Gong workspace users |
| `search_calls` | Search calls by various filters |

## CI Pipeline

The CI workflow runs on all PRs and pushes to main:
- **test**: Runs on Node 20, 22, 24 with coverage
- **lint**: Biome linting
- **validate-mcp**: MCP configuration validation

## Release Process

Releases are automated via release-please:
1. Merge PRs with conventional commits to main
2. release-please creates/updates a release PR
3. Merging the release PR triggers npm publish and MCP registry publish
