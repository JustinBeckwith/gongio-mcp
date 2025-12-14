# Gong MCP Server

<img src="gong.png" alt="A cute red panda hitting a gong" width="300" />

An MCP (Model Context Protocol) server that provides access to your Gong.io data. Query calls, retrieve transcripts, and list users directly from Claude or any MCP-compatible client.

## Features

- **List Calls** - Browse calls with date filtering and pagination
- **Get Call Details** - Retrieve comprehensive call information including participants, topics, trackers, and action items
- **Get Transcripts** - Access full speaker-attributed, timestamped transcripts
- **List Users** - View all users in your Gong workspace
- **Search Calls** - Find calls by date range, host, or specific IDs

## Prerequisites

- Node.js 24+ (or Bun)
- Gong API credentials (Access Key and Secret)

## Getting Gong API Credentials

1. Log into Gong as an admin
2. Go to **Company Settings** → **Ecosystem** → **API**
3. Click **Create API Key**
4. Save both the Access Key and Secret (the secret is only shown once)

## Installation

### From npm

```bash
npm install -g gongio-mcp
```

### From source

```bash
git clone https://github.com/your-username/gongio-mcp.git
cd gongio-mcp
npm install
npm run build
```

## Configuration

Set your Gong credentials as environment variables:

```bash
export GONG_ACCESS_KEY="your-access-key"
export GONG_ACCESS_KEY_SECRET="your-secret-key"
```

## Usage

### Running the Server

```bash
gongio-mcp
# or if installed locally:
npm start
```

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "gong": {
      "command": "npx",
      "args": ["gongio-mcp"],
      "env": {
        "GONG_ACCESS_KEY": "your-access-key",
        "GONG_ACCESS_KEY_SECRET": "your-secret-key"
      }
    }
  }
}
```

## Available Tools

### `list_calls`
List Gong calls with optional date filtering.

**Parameters:**
- `fromDateTime` (optional): Start date in ISO 8601 format
- `toDateTime` (optional): End date in ISO 8601 format
- `cursor` (optional): Pagination cursor

### `get_call_details`
Get detailed information about specific calls.

**Parameters:**
- `callIds` (required): Array of call IDs

### `get_transcripts`
Retrieve full transcripts for specified calls.

**Parameters:**
- `callIds` (required): Array of call IDs

### `list_users`
List all Gong users in your workspace.

**Parameters:**
- `cursor` (optional): Pagination cursor

### `search_calls`
Search for calls with various filters.

**Parameters:**
- `fromDateTime` (optional): Start date in ISO 8601 format
- `toDateTime` (optional): End date in ISO 8601 format
- `primaryUserIds` (optional): Array of user IDs to filter by host
- `callIds` (optional): Array of specific call IDs
- `cursor` (optional): Pagination cursor

## Available Resources

### `gong://users`
Returns a JSON list of all users in your Gong workspace.

## Example Prompts

Once connected to Claude, you can ask things like:

- "List my Gong calls from last week"
- "Get the transcript for call ID abc123"
- "Who are all the users in our Gong workspace?"
- "Show me details for the calls I had yesterday"
- "Find all calls hosted by user xyz"

## Development

```bash
# Run with hot reload (requires Bun)
bun run dev

# Type check
npm run typecheck

# Build for distribution
npm run build
```

## License

MIT
