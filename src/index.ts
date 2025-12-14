#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { GongClient } from "./gong.js";
import {
  listCallsRequestSchema,
  getCallSummaryRequestSchema,
  getCallTranscriptRequestSchema,
  listUsersRequestSchema,
} from "./schemas.js";
import {
  formatCallsResponse,
  formatCallSummary,
  formatCallTranscript,
  formatUsersResponse,
} from "./formatters.js";

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
          "List Gong calls with optional date filtering. Returns minimal call metadata (ID, title, date, duration). Use get_call_summary for details or get_call_transcript for full transcript.",
        inputSchema: {
          type: "object",
          properties: {
            fromDateTime: {
              type: "string",
              description:
                "Start date/time filter in ISO 8601 format (e.g., 2024-01-01T00:00:00Z). Must be before toDateTime if both specified.",
              pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            },
            toDateTime: {
              type: "string",
              description:
                "End date/time filter in ISO 8601 format (e.g., 2024-01-31T23:59:59Z). Must be after fromDateTime if both specified.",
              pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            },
            workspaceId: {
              type: "string",
              description: "Filter calls by workspace ID (numeric string up to 20 digits)",
              pattern: "^\\d{1,20}$",
            },
            cursor: {
              type: "string",
              description: "Pagination cursor for fetching next page of results",
              minLength: 1,
            },
          },
        },
      },
      {
        name: "get_call_summary",
        description:
          "Get a summary of a single call including participants, topics, key points, and action items. Use this after list_calls to get details for a specific call.",
        inputSchema: {
          type: "object",
          properties: {
            callId: {
              type: "string",
              pattern: "^\\d{1,20}$",
              description: "Gong call ID (numeric string up to 20 digits)",
            },
          },
          required: ["callId"],
        },
      },
      {
        name: "get_call_transcript",
        description:
          "Get the full transcript for a single call. Returns speaker-attributed conversation text. Only fetch this when you specifically need the transcript content.",
        inputSchema: {
          type: "object",
          properties: {
            callId: {
              type: "string",
              pattern: "^\\d{1,20}$",
              description: "Gong call ID (numeric string up to 20 digits)",
            },
          },
          required: ["callId"],
        },
      },
      {
        name: "list_users",
        description:
          "List all Gong users in your workspace. Returns user details including name, email, and title.",
        inputSchema: {
          type: "object",
          properties: {
            cursor: {
              type: "string",
              description: "Pagination cursor for fetching next page of results",
              minLength: 1,
            },
            includeAvatars: {
              type: "boolean",
              description: "Whether to include user avatar URLs in the response",
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
        // Validate input with Zod schema (will throw ZodError if invalid)
        const validated = listCallsRequestSchema.parse(args ?? {});
        const result = await gong.listCalls(validated);
        return {
          content: [
            {
              type: "text",
              text: formatCallsResponse(result),
            },
          ],
        };
      }

      case "get_call_summary": {
        // Validate input with Zod schema (will throw ZodError if invalid)
        const validated = getCallSummaryRequestSchema.parse(args);
        const result = await gong.getCallDetails([validated.callId]);
        const call = result.calls[0];
        if (!call) {
          throw new Error(`Call not found: ${validated.callId}`);
        }
        return {
          content: [
            {
              type: "text",
              text: formatCallSummary(call),
            },
          ],
        };
      }

      case "get_call_transcript": {
        // Validate input with Zod schema (will throw ZodError if invalid)
        const validated = getCallTranscriptRequestSchema.parse(args);
        // Fetch both transcript and call details to get speaker names
        const [transcriptResult, detailsResult] = await Promise.all([
          gong.getTranscripts([validated.callId]),
          gong.getCallDetails([validated.callId]),
        ]);
        const transcript = transcriptResult.callTranscripts[0];
        const details = detailsResult.calls[0];
        if (!transcript) {
          throw new Error(`Transcript not found: ${validated.callId}`);
        }
        return {
          content: [
            {
              type: "text",
              text: formatCallTranscript(transcript, details?.parties),
            },
          ],
        };
      }

      case "list_users": {
        // Validate input with Zod schema (will throw ZodError if invalid)
        const validated = listUsersRequestSchema.parse(args ?? {});
        const result = await gong.listUsers(validated);
        return {
          content: [
            {
              type: "text",
              text: formatUsersResponse(result),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    let message: string;
    if (error instanceof ZodError) {
      // Format Zod validation errors nicely
      const issues = error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      });
      message = `Validation error: ${issues.join("; ")}`;
    } else if (error instanceof Error) {
      message = error.message;
    } else {
      message = String(error);
    }
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
        mimeType: "text/markdown",
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
          mimeType: "text/markdown",
          text: formatUsersResponse(result),
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
