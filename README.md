# Gong MCP Server

<img src="gong.png" alt="A cute red panda hitting a gong" width="300" />

An MCP (Model Context Protocol) server that provides access to your Gong.io data. Query calls, retrieve transcripts, and list users directly from Claude or any MCP-compatible client.

## Features

- **List Calls** - Browse calls with date filtering and pagination
- **Get Call Summary** - Retrieve AI-generated summaries with key points, topics, and action items
- **Get Call Transcript** - Access full speaker-attributed, timestamped transcripts with pagination
- **List Users** - View all users in your Gong workspace
- **Search Calls** - Advanced search by date range, call hosts (primaryUserIds), specific call IDs, or workspace

## Prerequisites

- Node.js 18+ (or Bun)
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
git clone https://github.com/JustinBeckwith/gongio-mcp.git
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
List Gong calls with optional date filtering. Returns minimal call metadata (ID, title, date, duration).

**Parameters:**
- `fromDateTime` (optional): Start date in ISO 8601 format (e.g., `2024-01-01T00:00:00Z`)
- `toDateTime` (optional): End date in ISO 8601 format (e.g., `2024-01-31T23:59:59Z`)
- `workspaceId` (optional): Filter calls by workspace ID
- `cursor` (optional): Pagination cursor for fetching next page of results

### `get_call_summary`
Get an AI-generated summary of a single call including brief overview, key points, topics, action items, and detailed outline. This is the recommended way to understand a call.

**Parameters:**
- `callId` (required): Gong call ID (numeric string)

### `get_call_transcript`
Get the raw transcript for a single call with speaker-attributed text. Only use this when you need exact quotes - prefer `get_call_summary` for understanding call content.

**Parameters:**
- `callId` (required): Gong call ID (numeric string)
- `maxLength` (optional): Maximum characters to return (default: 10000, max: 100000)
- `offset` (optional): Character offset to start from for pagination (default: 0)

### `list_users`
List all Gong users in your workspace. Returns user details including name, email, and title.

**Parameters:**
- `cursor` (optional): Pagination cursor for fetching next page of results
- `includeAvatars` (optional): Whether to include user avatar URLs in the response

### `search_calls`
Search for calls with advanced filters including date range, call hosts, specific call IDs, and workspace. More flexible than `list_calls` for targeted queries.

**Parameters:**
- `fromDateTime` (optional): Start date in ISO 8601 format (e.g., `2024-01-01T00:00:00Z`)
- `toDateTime` (optional): End date in ISO 8601 format (e.g., `2024-01-31T23:59:59Z`)
- `workspaceId` (optional): Filter calls by workspace ID
- `primaryUserIds` (optional): Array of user IDs to filter by call host (e.g., `["123456789"]`)
- `callIds` (optional): Array of specific call IDs to retrieve (e.g., `["987654321", "123456789"]`)
- `cursor` (optional): Pagination cursor for fetching next page of results

## Available Resources

### `gong://users`
Returns a markdown-formatted list of all users in your Gong workspace.

## Example Prompts

Once connected to Claude, you can ask things like:

- "List my Gong calls from last week"
- "Show me a summary of call ID 123456"
- "Get the transcript for call ID 789012"
- "Who are all the users in our Gong workspace?"
- "Search for calls hosted by Justin (user ID 232255198215877499) in July 2025"
- "Find all calls from the last 7 days"
- "Search for specific calls by their IDs: 123456 and 789012"

## Contributing

Interested in contributing? Check out [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing instructions, and guidelines.

## License

MIT
