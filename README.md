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
| [`search_calls`](#search_calls) | Advanced call search by participant, customer, host, date range |
| [`search_calls_by_account`](#search_calls_by_account) | Find calls involving a specific account/company by email domain |
| [`search_calls_by_opportunity`](#search_calls_by_opportunity) | Find calls linked to specific CRM Opportunities |
| [`search_transcripts`](#search_transcripts) | Free-text keyword search across transcript sentences |
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

Search calls with advanced filters including participant lookup, customer name search, and rich content selection. Automatically paginates through all results and returns participant info, brief summary, and topics by default.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `fromDateTime` | No | Start date in ISO 8601 format |
| `toDateTime` | No | End date in ISO 8601 format |
| `workspaceId` | No | Filter by workspace ID (use `list_workspaces` to find IDs) |
| `primaryUserIds` | No | Array of user IDs to filter by call host (server-side) |
| `participantUserIds` | No | Array of user IDs — matches any participant (host, attendee, or invitee) |
| `participantEmails` | No | Array of email addresses — matches any participant (case-insensitive) |
| `customerName` | No | Customer/account name — fuzzy matches CRM account name, external email domains, and call titles |
| `callIds` | No | Array of specific call IDs to retrieve |
| `include` | No | Additional data to return: `keyPoints`, `trackers`, `highlights`, `speakers`, `comments`, `context`, `outline`, `media` |

**Notes:**
- `participantUserIds` and `participantEmails` find calls where the user was _any_ participant, not just the host. This requires fetching calls by date range and filtering client-side, so providing a date range is recommended for performance.
- `primaryUserIds` and `participantUserIds` can be combined: primary narrows the server query, participant post-filters the results.
- `customerName` is a case-insensitive substring match checked against three sources: CRM account name, external participant email domains, and the call title.

</details>

<a name="search_calls_by_account"></a>
<details>
<summary><code>search_calls_by_account</code> — Find calls by account/company (email domain)</summary>

Find calls involving a specific account or company by matching the email domains of external participants. The Gong API does not natively support filtering by account name (a [known gap](https://visioneers.gong.io/data-in-gong-71)) — this tool fetches calls in the date range and post-filters on `parties[].emailAddress`. Auto-paginates the underlying `/v2/calls/extensive` endpoint up to `maxCalls`.

**Use this when:**
- A prospect has multiple email domains (`acme.com`, `acme.io`, regional TLDs) and you need them all
- You need to join external enrichment data (e.g., "all prospects on Klaviyo" from BuiltWith / Clearbit / a vendor-stack graph) — resolve to a domain list upstream and pass it here
- Domain-based matching is more reliable than CRM Account names that drift across systems

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `domains` | **Yes** | Email domains, e.g. `["acme.com", "acme.io"]`. A call matches if any external participant has an email at one of these domains. |
| `fromDateTime` | No | Start date in ISO 8601 format |
| `toDateTime` | No | End date in ISO 8601 format |
| `workspaceId` | No | Filter by workspace ID |
| `primaryUserIds` | No | Pre-narrow by call host user IDs (faster, server-side) |
| `matchCrmAccount` | No | Also match where a CRM Account context object name contains a domain root (e.g. `"acme"` from `"acme.com"`). Requires CRM integration. Default `false`. |
| `maxCalls` | No | Max calls to fetch & filter (default: 500, max: 5000). Auto-paginates underlying API. |
| `cursor` | No | Pagination cursor (advanced) |

**Cost note:** This is fetch-then-filter. A 90-day window with no other narrowing typically pages through 1–5 API calls. Combine with `primaryUserIds` to bound cost on long ranges.

</details>

<a name="search_calls_by_opportunity"></a>
<details>
<summary><code>search_calls_by_opportunity</code> — Find calls linked to a CRM Opportunity</summary>

Find calls linked to specific CRM Opportunities by ID or name substring. Requires Gong-CRM integration (Salesforce / HubSpot) — calls without CRM linkage will not match.

**Use this when:**
- You want every call on a specific deal — `opportunityIds: ["006xxxxx"]` is the most precise option
- Opportunity names are descriptive (e.g. `"Acme Q4 Renewal"`) and you want fuzzy matching across renamed/duplicated opportunities

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `opportunityIds` | At least one of `opportunityIds` or `opportunityNames` is required | CRM Opportunity IDs (e.g., Salesforce 18-character IDs) |
| `opportunityNames` | At least one of `opportunityIds` or `opportunityNames` is required | Name substrings (case-insensitive) matched against the Name field of Opportunity context objects |
| `fromDateTime` | No | Start date in ISO 8601 format |
| `toDateTime` | No | End date in ISO 8601 format |
| `workspaceId` | No | Filter by workspace ID |
| `primaryUserIds` | No | Pre-narrow by call host user IDs |
| `maxCalls` | No | Max calls to fetch & filter (default: 500, max: 5000) |
| `cursor` | No | Pagination cursor (advanced) |

**Cost note:** Uses the same fetch-then-filter pattern as `search_calls_by_account`. CRM context lookup adds no extra API calls — it rides on the same `/v2/calls/extensive` request with `context: "Extended"`.

</details>

<a name="search_transcripts"></a>
<details>
<summary><code>search_transcripts</code> — Free-text keyword search across transcripts</summary>

Free-text keyword search across call transcript sentences within a bounded date range. Two-phase: (1) `/v2/calls/extensive` narrows the call set by date + optional `primaryUserIds` / `domains`, (2) `/v2/calls/transcript` fetches transcripts for the narrowed set and returns sentence-level matches with speaker attribution and timestamps.

**Prefer Gong Trackers for recurring terms.** For competitor names, ESP/tech terms (Klaviyo, Braze, Iterable, Postscript, Attentive, Sendgrid, Customer.io, etc.), and other terms you'll search for repeatedly — set them up as Gong Trackers in the UI (one-time, ~30 minutes for ~20 terms). Then use `get_trackers` + `search_calls` + `get_call_summary` instead. Trackers are server-side, the cost is dramatically lower, and they surface counts and timestamps natively. Use `search_transcripts` for ad-hoc one-offs.

**Cost guard:** Date ranges greater than 30 days require additional narrowing via `primaryUserIds` or `domains`. A 6-month unbounded scan would burn API quota and is rejected at the schema level.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `keywords` | **Yes** | Keywords to search for. Each must be at least 2 characters. |
| `fromDateTime` | **Yes** | Start of date window (ISO 8601). |
| `toDateTime` | **Yes** | End of date window (ISO 8601). |
| `primaryUserIds` | Required if window > 30 days and `domains` not set | Narrow to calls hosted by these users before scanning |
| `domains` | Required if window > 30 days and `primaryUserIds` not set | Narrow to calls with external parties from these domains before scanning |
| `workspaceId` | No | Filter by workspace ID |
| `caseSensitive` | No | Default `false`. |
| `wholeWord` | No | Default `true` — `"ai"` will not match `"said"` or `"again"`. Set `false` for substring matching. |
| `maxCalls` | No | Max calls to scan (default: 500). |
| `maxMatchesPerCall` | No | Max sentence matches returned per call (default: 10) — prevents context overflow on calls with many hits. |

**Returns:** Sentence-level matches grouped by call, including speaker name and affiliation (when available), keyword matched, timestamp (mm:ss), and the sentence snippet.

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
- "Show me all calls from the past 60 days with anyone at acme.com or acme.io"
- "Find every call attached to opportunity 006xxxxx"
- "Find Q3 calls where prospects mentioned Klaviyo or Braze, narrowed to John's calls"

## Contributing

Interested in contributing? Check out [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing instructions, and guidelines.

The repository includes `gong-openapi.json` — a local copy of the Gong API OpenAPI spec. It's useful as a reference when adding new tools: use it to look up endpoint paths, parameter names, and response shapes without leaving your editor. The latest spec can be downloaded from the [Gong API documentation](https://gong.app.gong.io/ajax/settings/api/documentation/specs?version=).
