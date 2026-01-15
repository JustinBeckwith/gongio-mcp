# Contributing to Gong MCP Server

Thank you for your interest in contributing to the Gong MCP Server! This guide will help you get started with development.

## Development Setup

### Prerequisites

- Node.js 18+ (or Bun)
- pnpm (recommended) or npm
- Gong API credentials for testing

### Installation

```bash
git clone https://github.com/JustinBeckwith/gongio-mcp.git
cd gongio-mcp
npm install
```

### Development Commands

```bash
# Run with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint code
npm run lint

# Format code
npm run format

# Fix linting issues
npm run fix

# Build for distribution
npm run build
```

## Testing Locally with Claude Desktop

### 1. Build the project

```bash
npm run build
```

### 2. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "gong": {
      "command": "node",
      "args": ["/absolute/path/to/gong-mcp/dist/index.js"],
      "env": {
        "GONG_ACCESS_KEY": "your-access-key",
        "GONG_ACCESS_KEY_SECRET": "your-secret-key"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After making changes:
1. Run tests: `npm test`
2. Build: `npm run build`
3. Restart Claude Desktop (Cmd+Q then reopen)

### 4. Verify changes

Ask Claude: "What Gong tools do you have available?" to verify the MCP loaded correctly.

## Project Structure

```
gong-mcp/
├── src/
│   ├── index.ts          # MCP server setup and tool handlers
│   ├── gong.ts           # Gong API client
│   ├── schemas.ts        # Zod validation schemas
│   └── formatters.ts     # Response formatting functions
├── test/
│   ├── index.test.ts     # MCP handler tests
│   ├── gong.test.ts      # API client tests
│   ├── schemas.test.ts   # Schema validation tests
│   └── formatters.test.ts # Formatter tests
└── dist/                 # Compiled JavaScript (generated)
```

## Writing Tests

All new features should include comprehensive test coverage:

- **Unit tests** for API client methods (see `test/gong.test.ts`)
- **Schema tests** for validation logic (see `test/schemas.test.ts`)
- **Integration tests** for MCP handlers (see `test/index.test.ts`)
- **Formatter tests** for output formatting (see `test/formatters.test.ts`)

Run tests frequently during development:

```bash
npm test                    # Run all tests once
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run tests with coverage report
```

## Code Quality

Before submitting a PR:

1. **Tests pass**: `npm test`
2. **Type checking passes**: `npm run typecheck`
3. **Linting passes**: `npm run lint`
4. **Code is formatted**: `npm run format`
5. **Build succeeds**: `npm run build`

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add new feature`
- `fix: bug fix`
- `docs: documentation changes`
- `test: test updates`
- `chore: maintenance tasks`

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes with tests
4. Ensure all checks pass
5. Commit with conventional commit messages
6. Push to your fork
7. Open a Pull Request

## Questions?

Feel free to open an issue for questions or discussion!
