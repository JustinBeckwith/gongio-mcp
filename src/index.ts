#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GongClient } from "./gong.js";

// Get credentials from environment
const accessKey = process.env.GONG_ACCESS_KEY;
const accessKeySecret = process.env.GONG_ACCESS_KEY_SECRET;

if (!accessKey || !accessKeySecret) {
  console.error(
    "Missing required environment variables: GONG_ACCESS_KEY and GONG_ACCESS_KEY_SECRET"
  );
  process.exit(1);
}

const gong = new GongClient({
  accessKey,
  accessKeySecret,
});

const server = new Server(
  {
    name: "gongio-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_calls",
        description:
          "List Gong calls with optional date filtering. Returns call metadata including ID, title, duration, and participants.",
        inputSchema: {
          type: "object",
          properties: {
            fromDateTime: {
              type: "string",
              description:
                "Start date/time filter in ISO 8601 format (e.g., 2024-01-01T00:00:00Z)",
            },
            toDateTime: {
              type: "string",
              description:
                "End date/time filter in ISO 8601 format (e.g., 2024-01-31T23:59:59Z)",
            },
            cursor: {
              type: "string",
              description: "Pagination cursor for fetching next page of results",
            },
          },
        },
      },
      {
        name: "get_call_details",
        description:
          "Get detailed information about specific calls including participants, topics, trackers, action items, and more.",
        inputSchema: {
          type: "object",
          properties: {
            callIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of call IDs to retrieve details for",
            },
          },
          required: ["callIds"],
        },
      },
      {
        name: "get_transcripts",
        description:
          "Retrieve full transcripts for specified calls. Returns speaker-attributed, timestamped transcript text.",
        inputSchema: {
          type: "object",
          properties: {
            callIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of call IDs to retrieve transcripts for",
            },
          },
          required: ["callIds"],
        },
      },
      {
        name: "list_users",
        description:
          "List all Gong users in your workspace. Returns user details including name, email, and settings.",
        inputSchema: {
          type: "object",
          properties: {
            cursor: {
              type: "string",
              description: "Pagination cursor for fetching next page of results",
            },
          },
        },
      },
      {
        name: "search_calls",
        description:
          "Search for calls with various filters including date range, user IDs, and specific call IDs.",
        inputSchema: {
          type: "object",
          properties: {
            fromDateTime: {
              type: "string",
              description: "Start date/time filter in ISO 8601 format",
            },
            toDateTime: {
              type: "string",
              description: "End date/time filter in ISO 8601 format",
            },
            primaryUserIds: {
              type: "array",
              items: { type: "string" },
              description: "Filter by primary user IDs (the call hosts)",
            },
            callIds: {
              type: "array",
              items: { type: "string" },
              description: "Filter by specific call IDs",
            },
            cursor: {
              type: "string",
              description: "Pagination cursor for fetching next page of results",
            },
          },
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_calls": {
        const result = await gong.listCalls({
          fromDateTime: args?.fromDateTime as string | undefined,
          toDateTime: args?.toDateTime as string | undefined,
          cursor: args?.cursor as string | undefined,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_call_details": {
        const callIds = args?.callIds as string[];
        if (!callIds?.length) {
          throw new Error("callIds is required and must be a non-empty array");
        }
        const result = await gong.getCallDetails(callIds);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_transcripts": {
        const callIds = args?.callIds as string[];
        if (!callIds?.length) {
          throw new Error("callIds is required and must be a non-empty array");
        }
        const result = await gong.getTranscripts(callIds);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_users": {
        const result = await gong.listUsers({
          cursor: args?.cursor as string | undefined,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "search_calls": {
        const result = await gong.searchCalls({
          fromDateTime: args?.fromDateTime as string | undefined,
          toDateTime: args?.toDateTime as string | undefined,
          primaryUserIds: args?.primaryUserIds as string[] | undefined,
          callIds: args?.callIds as string[] | undefined,
          cursor: args?.cursor as string | undefined,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Define available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "gong://users",
        name: "Gong Users",
        description: "List of all users in your Gong workspace",
        mimeType: "application/json",
      },
    ],
  };
});

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "gong://users") {
    const result = await gong.listUsers();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Gong MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
