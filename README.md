# Gong MCP Server

[![npm version](https://img.shields.io/npm/v/gongio-mcp)](https://www.npmjs.com/package/gongio-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<img src="gong.png" alt="A cute red panda hitting a gong" width="300" />

An MCP (Model Context Protocol) server that provides access to your Gong.io data. Query calls, transcripts, users, keyword trackers, and more directly from Claude or any MCP-compatible client.

## Tools Quick Reference

| Tool | Description |
|------|-------------|
| [`list_calls`](#list_calls) | List calls with date/workspace filtering |
| [`get_call`](#get_call) | Get metadata for a specific call |
| [`get_call_summary`](#get_call_summary) | AI summary: key points, topics, action items |
| [`get_call_transcript`](#get_call_transcript) | Full speaker-attributed transcript (paginated) |
| [`search_calls`](#search_calls) | Advanced call search by host, ID, date range |
| [`get_trackers`](#get_trackers) | List keyword trackers (competitors, topics, etc.) |
| [`list_workspaces`](#list_workspaces) | List workspaces and get IDs for use in other tools |
| [`list_library_folders`](#list_library_folders) | List public call library folders |
| [`get_library_folder_calls`](#get_library_folder_calls) | Get calls saved in a specific library folder |
| [`get_user`](#get_user) | Get a specific user's profile |
| [`search_users`](#search_users) | Search/filter users by IDs or creation date |
| [`list_users`](#list_users) | List all workspace users |

## Prerequisites

- Node.js 18+ **or** Docker
- Gong API credentials (Access Key and Secret)

<details>
<summary><strong>Getting API Credentials</strong></summary>

1. Log into Gong as an admin
2. Go to **Company Settings** → **Ecosystem** → **API**
3. Click **Create API Key**
4. Save both the Access Key and Secret (the secret is only shown once)

</details>

<details>
<summary><strong>Installation</strong></summary>

### Option 1: npx (no install required)

```bash
npx gongio-mcp
```

### Option 2: Global npm install

```bash
npm install -g gongio-mcp
gongio-mcp
```

### Option 3: From source

```bash
git clone https://github.com/JustinBeckwith/gongio-mcp.git
cd gongio-mcp
npm install
npm run build
node dist/index.js
```

### Option 4: Docker (build locally)

```bash
git clone https://github.com/JustinBeckwith/gongio-mcp.git
cd gongio-mcp
docker build -t gongio-mcp .
docker run --rm -i \
  -e GONG_ACCESS_KEY=your-access-key \
  -e GONG_ACCESS_KEY_SECRET=your-secret-key \
  gongio-mcp
```

</details>

<details>
<summary><strong>Configuration</strong></summary>

Set your Gong credentials as environment variables:

```bash
export GONG_ACCESS_KEY="your-access-key"
export GONG_ACCESS_KEY_SECRET="your-secret-key"
```

Or pass them inline:

```bash
GONG_ACCESS_KEY=your-key GONG_ACCESS_KEY_SECRET=your-secret npx gongio-mcp
```

</details>

<details>
<summary><strong>Client Setup</strong></summary>

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

**Using npx:**
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

**Using Docker:**
```json
{
  "mcpServers": {
    "gong": {
      "command": "docker",
      "args": ["run", "--rm", "-i",
               "-e", "GONG_ACCESS_KEY",
               "-e", "GONG_ACCESS_KEY_SECRET",
               "gongio-mcp"],
      "env": {
        "GONG_ACCESS_KEY": "your-access-key",
        "GONG_ACCESS_KEY_SECRET": "your-secret-key"
      }
    }
  }
}
```

### Claude Code

**Using npx:**
```bash
claude mcp add gong -e GONG_ACCESS_KEY=your-key -e GONG_ACCESS_KEY_SECRET=your-secret -- npx gongio-mcp
```

**Using Docker (after `docker build -t gongio-mcp .`):**
```bash
claude mcp add gong -e GONG_ACCESS_KEY=your-key -e GONG_ACCESS_KEY_SECRET=your-secret -- docker run --rm -i -e GONG_ACCESS_KEY -e GONG_ACCESS_KEY_SECRET gongio-mcp
```

</details>

## Available Tools

<a name="list_calls"></a>
<details>
<summary><code>list_calls</code> — List Gong calls with date filtering</summary>

List calls with optional date range and workspace filters. Returns minimal call metadata (ID, title, date, duration).

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `fromDateTime` | No | Start date in ISO 8601 format (e.g., `2024-01-01T00:00:00Z`) |
| `toDateTime` | No | End date in ISO 8601 format (e.g., `2024-01-31T23:59:59Z`) |
| `workspaceId` | No | Filter calls by workspace ID (use `list_workspaces` to find IDs) |
| `cursor` | No | Pagination cursor for next page |

</details>

<a name="get_call"></a>
<details>
<summary><code>get_call</code> — Get metadata for a specific call</summary>

Get the URL, timing, direction, scope, system, and other metadata for one call. Faster than `get_call_summary` when you only need call metadata.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `callId` | Yes | Gong call ID (numeric string) |

</details>

<a name="get_call_summary"></a>
<details>
<summary><code>get_call_summary</code> — AI-generated call summary</summary>

Get an AI-generated summary including brief overview, key points, topics, action items, and detailed outline. This is the recommended way to understand a call — use `get_call_transcript` only if you need exact quotes.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `callId` | Yes | Gong call ID (numeric string) |

</details>

<a name="get_call_transcript"></a>
<details>
<summary><code>get_call_transcript</code> — Full speaker-attributed transcript</summary>

Get the raw transcript with speaker attribution. Transcripts are paginated (default 10KB) to prevent context overflow — use `maxLength` and `offset` to navigate.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `callId` | Yes | Gong call ID (numeric string) |
| `maxLength` | No | Maximum characters to return (default: 10000, max: 100000) |
| `offset` | No | Character offset to start from for pagination (default: 0) |

</details>

<a name="search_calls"></a>
<details>
<summary><code>search_calls</code> — Advanced call search</summary>

Search calls with advanced filters. More flexible than `list_calls` for targeted queries.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `fromDateTime` | No | Start date in ISO 8601 format |
| `toDateTime` | No | End date in ISO 8601 format |
| `workspaceId` | No | Filter by workspace ID (use `list_workspaces` to find IDs) |
| `primaryUserIds` | No | Array of user IDs to filter by call host |
| `callIds` | No | Array of specific call IDs to retrieve |
| `cursor` | No | Pagination cursor |

</details>

<a name="get_trackers"></a>
<details>
<summary><code>get_trackers</code> — List keyword trackers</summary>

List all keyword tracker definitions including tracked phrases, affiliation (whose speech is tracked), and filter queries. Explains tracker hits visible in `get_call_summary` output.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `workspaceId` | No | Filter trackers by workspace ID (use `list_workspaces` to find IDs) |

</details>

<a name="list_workspaces"></a>
<details>
<summary><code>list_workspaces</code> — List all workspaces</summary>

List all Gong workspaces with their IDs and names. Use these IDs as filters in `list_calls`, `search_calls`, `get_trackers`, and other tools. Most companies have 1–3 workspaces (e.g., by region or product line).

**Parameters:** None

</details>

<a name="get_user"></a>
<details>
<summary><code>get_user</code> — Get a user's profile</summary>

Get a specific user's profile including name, email, title, phone, and settings. Useful for resolving user IDs returned from call data.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `userId` | Yes | Gong user ID (numeric string) |

</details>

<a name="search_users"></a>
<details>
<summary><code>search_users</code> — Search users by filter</summary>

Search and filter users by IDs or creation date. More flexible than `list_users` for resolving specific user IDs from call data in bulk.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `userIds` | No | Array of specific user IDs to look up |
| `createdFromDateTime` | No | Filter users created after this datetime (ISO 8601) |
| `createdToDateTime` | No | Filter users created before this datetime (ISO 8601) |
| `cursor` | No | Pagination cursor |

</details>

<a name="list_users"></a>
<details>
<summary><code>list_users</code> — List all workspace users</summary>

List all Gong users in your workspace. Returns name, email, and title for each user.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `cursor` | No | Pagination cursor |
| `includeAvatars` | No | Whether to include user avatar URLs |

</details>

<a name="list_library_folders"></a>
<details>
<summary><code>list_library_folders</code> — List public call library folders</summary>

List all public Gong call library folders for a workspace. Returns folder IDs and names used with `get_library_folder_calls`. Private and archived folders are not returned.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `workspaceId` | **Yes** | Workspace ID to list folders for (use `list_workspaces` to find IDs) |

</details>

<a name="get_library_folder_calls"></a>
<details>
<summary><code>get_library_folder_calls</code> — Get calls in a library folder</summary>

Get all calls saved in a specific Gong library folder. Returns call IDs, titles, curator notes, and snippet timing for clips. Call IDs can be passed directly to `get_call_summary` or `get_call_transcript`.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `folderId` | Yes | Library folder ID (numeric string, from `list_library_folders`) |

</details>

## Available Resources

<a name="gong-users"></a>
<details>
<summary><code>gong://users</code> — All workspace users</summary>

Returns a markdown-formatted list of all users in your Gong workspace. Useful for resolving user IDs found in call data.

**Parameters:** None

</details>

## Example Prompts

Once connected to Claude, you can ask:

- "List my Gong calls from last week"
- "Get the details for call 123456789"
- "Show me a summary of call 123456789"
- "Get the transcript for call 789012"
- "What workspaces do we have in Gong?"
- "What keywords is Gong tracking for competitors?"
- "What call library folders do we have in Gong?"
- "Show me the calls in the 'Best Discovery Calls' library folder"
- "Who are all the users in our Gong workspace?"
- "Search for calls hosted by Justin (user ID 232255198215877499) in July 2025"
- "Look up these user IDs: 111, 222, 333"

## Contributing

Interested in contributing? Check out [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing instructions, and guidelines.

The repository includes `gong-openapi.json` — a local copy of the Gong API OpenAPI spec. It's useful as a reference when adding new tools: use it to look up endpoint paths, parameter names, and response shapes without leaving your editor. The latest spec can be downloaded from the [Gong API documentation](https://gong.app.gong.io/ajax/settings/api/documentation/specs?version=).
