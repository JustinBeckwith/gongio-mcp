#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';
import {
	formatCallDetailsResponse,
	formatCallSummary,
	formatCallsResponse,
	formatCallTranscript,
	formatLibraryFolderCallsResponse,
	formatLibraryFoldersResponse,
	formatMatchedCalls,
	formatSingleCall,
	formatSingleUser,
	formatTrackersResponse,
	formatTranscriptMatches,
	formatUsersResponse,
	formatWorkspacesResponse,
} from './formatters.js';
import { GongClient } from './gong.js';
import {
	getCallRequestSchema,
	getCallSummaryRequestSchema,
	getCallTranscriptRequestSchema,
	getLibraryFolderCallsRequestSchema,
	getTrackersRequestSchema,
	getUserRequestSchema,
	listCallsRequestSchema,
	listLibraryFoldersRequestSchema,
	listUsersRequestSchema,
	searchCallsByAccountRequestSchema,
	searchCallsByOpportunityRequestSchema,
	searchCallsRequestSchema,
	searchTranscriptsRequestSchema,
	searchUsersRequestSchema,
} from './schemas.js';

// Get credentials from environment
const accessKey = process.env.GONG_ACCESS_KEY;
const accessKeySecret = process.env.GONG_ACCESS_KEY_SECRET;

if (!accessKey || !accessKeySecret) {
	console.error(
		'Missing required environment variables: GONG_ACCESS_KEY and GONG_ACCESS_KEY_SECRET',
	);
	process.exit(1);
}

const gong = new GongClient({
	accessKey,
	accessKeySecret,
});

const server = new Server(
	{
		name: 'gongio-mcp',
		version: '1.0.0',
	},
	{
		capabilities: {
			tools: {},
			resources: {},
		},
	},
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: 'list_calls',
				description:
					'List Gong calls with optional date filtering. Returns minimal call metadata (ID, title, date, duration). Use get_call_summary for details or get_call_transcript for full transcript.',
				inputSchema: {
					type: 'object',
					properties: {
						fromDateTime: {
							type: 'string',
							description:
								'Start date/time filter in ISO 8601 format (e.g., 2024-01-01T00:00:00Z). Must be before toDateTime if both specified.',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
						},
						toDateTime: {
							type: 'string',
							description:
								'End date/time filter in ISO 8601 format (e.g., 2024-01-31T23:59:59Z). Must be after fromDateTime if both specified.',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
						},
						workspaceId: {
							type: 'string',
							description:
								'Filter calls by workspace ID (numeric string up to 20 digits)',
							pattern: '^\\d{1,20}$',
						},
						cursor: {
							type: 'string',
							description:
								'Pagination cursor for fetching next page of results',
							minLength: 1,
						},
					},
				},
			},
			{
				name: 'get_call_summary',
				description:
					'Get an AI-generated summary of a single call including brief overview, key points, topics, action items, and detailed outline. This is the recommended way to understand a call - use get_call_transcript only if you need exact quotes.',
				inputSchema: {
					type: 'object',
					properties: {
						callId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
							description: 'Gong call ID (numeric string up to 20 digits)',
						},
					},
					required: ['callId'],
				},
			},
			{
				name: 'get_call_transcript',
				description:
					'Get the raw transcript for a single call with speaker-attributed text. Only use this when you need exact quotes - prefer get_call_summary for understanding call content. Transcripts are truncated by default (10KB) to prevent context overflow - use maxLength and offset to paginate.',
				inputSchema: {
					type: 'object',
					properties: {
						callId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
							description: 'Gong call ID (numeric string up to 20 digits)',
						},
						maxLength: {
							type: 'number',
							minimum: 1000,
							maximum: 100000,
							default: 10000,
							description:
								'Maximum characters to return (default: 10000, ~10KB). Longer transcripts are truncated with pagination info.',
						},
						offset: {
							type: 'number',
							minimum: 0,
							default: 0,
							description:
								'Character offset to start from (default: 0). Use to paginate through long transcripts.',
						},
					},
					required: ['callId'],
				},
			},
			{
				name: 'list_users',
				description:
					'List all Gong users in the organization. Returns name, email, title, and user IDs. Useful when you need a Gong user ID for search_calls filters like primaryUserIds, though for most "find calls by this person" cases you can pass their email directly to primaryUserEmails or participantEmails instead.',
				inputSchema: {
					type: 'object',
					properties: {
						cursor: {
							type: 'string',
							description:
								'Pagination cursor for fetching next page of results',
							minLength: 1,
						},
						includeAvatars: {
							type: 'boolean',
							description:
								'Whether to include user avatar URLs in the response',
						},
					},
				},
			},
			{
				name: 'search_calls',
				description:
					`Search Gong calls with rich filters. The primary tool for narrowing down calls before drilling in with get_call_summary or get_call_transcript.

Supported filters:
- When: fromDateTime, toDateTime (ISO 8601). Always prefer a date range — unbounded queries pull every call in the workspace.
- Who hosted: primaryUserIds, primaryUserEmails, excludePrimaryUserIds.
- Who participated (host OR attendee OR invitee): participantUserIds, participantEmails, excludeParticipantUserIds, excludeParticipantEmails.
- Customer/topic: customerName (CRM account name, email domain, or title substring), titleContains, trackers (see note below).
- Metadata: scope (External/Internal), direction, system (Zoom/Meet/…), language (eng/jpn/…), minDuration and maxDuration in seconds.
- Output shape: include (array of keyPoints, trackers, highlights, speakers, comments, context, outline, media). Parties + brief + topics are always returned.

Behavior:
- Auto-paginates up to ~5000 calls. If a user asks for a broad question, guide them to narrow with a date range, scope, minDuration, or customerName first.
- trackers filter does case-insensitive substring match on tracker names. Names are workspace-specific — call get_trackers first to see what's configured before guessing.
- When the rich output would exceed the output cap, the tool auto-falls back to a compact table showing all IDs/titles. Use get_call_summary on specific IDs to go deeper.
- Filters compose with AND logic (primaryUserIds + customerName = hosted by user X on customer Y calls).

Usage pattern: narrow with search_calls → drill into specific calls with get_call_summary (AI summary) or get_call_transcript (exact quotes).`,
				inputSchema: {
					type: 'object',
					properties: {
						fromDateTime: {
							type: 'string',
							description:
								'Start date/time filter in ISO 8601 format (e.g., 2024-01-01T00:00:00Z). Strongly recommended — without a date range, the tool pulls every call in the workspace. Must be before toDateTime if both specified.',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
						},
						toDateTime: {
							type: 'string',
							description:
								'End date/time filter in ISO 8601 format (e.g., 2024-01-31T23:59:59Z). Strongly recommended alongside fromDateTime. Must be after fromDateTime if both specified.',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
						},
						workspaceId: {
							type: 'string',
							description:
								'Filter calls by workspace ID (numeric string up to 20 digits)',
							pattern: '^\\d{1,20}$',
						},
						primaryUserIds: {
							type: 'array',
							description:
								'Filter by primary user IDs (call hosts only, server-side). Use participantUserIds to find calls where a user was any participant.',
							items: {
								type: 'string',
								pattern: '^\\d{1,20}$',
							},
						},
						primaryUserEmails: {
							type: 'array',
							description:
								'Filter by host email (case-insensitive). Alternative to primaryUserIds when you have emails instead of user IDs.',
							items: {
								type: 'string',
								format: 'email',
							},
						},
						excludePrimaryUserIds: {
							type: 'array',
							description:
								'Exclude calls hosted by these user IDs.',
							items: {
								type: 'string',
								pattern: '^\\d{1,20}$',
							},
						},
						participantUserIds: {
							type: 'array',
							description:
								'Filter by participant user IDs. Matches calls where any participant (host, attendee, or invitee) has a matching Gong user ID. Requires a date range for optimal performance.',
							items: {
								type: 'string',
								pattern: '^\\d{1,20}$',
							},
						},
						excludeParticipantUserIds: {
							type: 'array',
							description:
								'Exclude calls where any participant has a matching user ID.',
							items: {
								type: 'string',
								pattern: '^\\d{1,20}$',
							},
						},
						participantEmails: {
							type: 'array',
							description:
								'Filter by participant email addresses (case-insensitive). Matches calls where any participant has a matching email.',
							items: {
								type: 'string',
								format: 'email',
							},
						},
						excludeParticipantEmails: {
							type: 'array',
							description:
								'Exclude calls where any participant has a matching email (case-insensitive).',
							items: {
								type: 'string',
								format: 'email',
							},
						},
						customerName: {
							type: 'string',
							description:
								'Filter by customer/account name (case-insensitive substring match). Searches CRM account name, external participant email domains, and call titles.',
							minLength: 1,
						},
						titleContains: {
							type: 'string',
							description:
								'Filter calls whose title contains this substring (case-insensitive).',
							minLength: 1,
						},
						trackers: {
							type: 'array',
							description:
								'Filter calls where at least one matching tracker fired (count > 0). Tracker names are matched case-insensitive substring and vary by workspace — call get_trackers first to discover what is configured.',
							items: {
								type: 'string',
								minLength: 1,
							},
						},
						scope: {
							type: 'string',
							description:
								'Filter by call scope: External (customer-facing), Internal (team), or Unknown.',
							enum: ['External', 'Internal', 'Unknown'],
						},
						direction: {
							type: 'string',
							description:
								'Filter by call direction: Inbound, Outbound, Conference, or Unknown.',
							enum: ['Inbound', 'Outbound', 'Conference', 'Unknown'],
						},
						system: {
							type: 'string',
							description:
								'Filter by conferencing system (e.g., "Zoom", "Google Meet"). Case-insensitive substring match.',
							minLength: 1,
						},
						language: {
							type: 'string',
							description:
								'Filter by language code (e.g., "eng", "jpn"). Case-insensitive exact match.',
							minLength: 1,
						},
						minDuration: {
							type: 'integer',
							description:
								'Minimum call duration in seconds. Useful for filtering out no-shows or misfired meetings.',
							minimum: 0,
						},
						maxDuration: {
							type: 'integer',
							description:
								'Maximum call duration in seconds.',
							minimum: 0,
						},
						callIds: {
							type: 'array',
							description:
								'Filter by specific call IDs. Array of numeric strings.',
							items: {
								type: 'string',
								pattern: '^\\d{1,20}$',
							},
						},
						include: {
							type: 'array',
							description:
								'Additional per-call data beyond the defaults (parties, brief, topics). Start lean and add fields as needed — each extra field multiplies response size by number of calls. Options: keyPoints (~5KB/call), trackers (~3KB/call, auto-added when trackers filter is used), highlights (~3KB/call), speakers (talk time, ~1KB/call), comments (varies), context (CRM links, ~1KB/call), outline (~80KB/call, AVOID unless you need full structure of one call), media (audio/video URLs).',
							items: {
								type: 'string',
								enum: [
									'keyPoints',
									'trackers',
									'highlights',
									'speakers',
									'comments',
									'context',
									'outline',
									'media',
								],
							},
						},
					},
				},
			},
			{
				name: 'search_calls_by_account',
				description:
					'Find calls involving a specific account/company by matching email domains of external participants. The Gong API does not natively support filtering by account name — this tool fetches calls in the date range and post-filters on parties[].emailAddress. Auto-paginates up to maxCalls. For external tech-stack joins (e.g., "all calls with prospects on Klaviyo"), resolve domains upstream and pass them here.',
				inputSchema: {
					type: 'object',
					properties: {
						domains: {
							type: 'array',
							description:
								'Email domains (e.g., ["acme.com", "acme.io"]). A call matches if any external participant has an email at one of these domains.',
							items: { type: 'string' },
							minItems: 1,
						},
						fromDateTime: {
							type: 'string',
							description: 'Start date/time in ISO 8601 format.',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
						},
						toDateTime: {
							type: 'string',
							description: 'End date/time in ISO 8601 format.',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
						},
						workspaceId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
							description: 'Filter by workspace ID.',
						},
						primaryUserIds: {
							type: 'array',
							description:
								'Pre-narrow by call host user IDs (faster, server-side).',
							items: { type: 'string', pattern: '^\\d{1,20}$' },
						},
						matchCrmAccount: {
							type: 'boolean',
							description:
								'Also match calls where a CRM Account context object name contains a domain root (e.g., "acme" from "acme.com"). Requires CRM integration. Default false.',
						},
						maxCalls: {
							type: 'number',
							minimum: 1,
							maximum: 5000,
							description:
								'Maximum calls to fetch and filter (default: 500). Auto-paginates underlying API.',
						},
						cursor: {
							type: 'string',
							description: 'Pagination cursor (advanced).',
							minLength: 1,
						},
					},
					required: ['domains'],
				},
			},
			{
				name: 'search_calls_by_opportunity',
				description:
					'Find calls linked to specific CRM Opportunities by ID or name substring. Requires Gong-CRM integration (Salesforce/HubSpot) — calls without CRM linkage will not match. Provide opportunityIds OR opportunityNames (or both).',
				inputSchema: {
					type: 'object',
					properties: {
						opportunityIds: {
							type: 'array',
							description:
								'CRM Opportunity IDs (e.g., Salesforce 18-character IDs).',
							items: { type: 'string', minLength: 1 },
						},
						opportunityNames: {
							type: 'array',
							description:
								'Opportunity name substrings (case-insensitive). Matches if the Opportunity Name field contains any of these.',
							items: { type: 'string', minLength: 1 },
						},
						fromDateTime: {
							type: 'string',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
							description: 'Start date/time in ISO 8601 format.',
						},
						toDateTime: {
							type: 'string',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
							description: 'End date/time in ISO 8601 format.',
						},
						workspaceId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
							description: 'Filter by workspace ID.',
						},
						primaryUserIds: {
							type: 'array',
							description: 'Pre-narrow by call host user IDs.',
							items: { type: 'string', pattern: '^\\d{1,20}$' },
						},
						maxCalls: {
							type: 'number',
							minimum: 1,
							maximum: 5000,
							description: 'Max calls to fetch and filter (default: 500).',
						},
						cursor: { type: 'string', minLength: 1 },
					},
				},
			},
			{
				name: 'search_transcripts',
				description:
					'Free-text keyword search across call transcripts within a bounded date range. Use for ad-hoc searches like "calls mentioning competitor X". For recurring terms, prefer setting up Gong Trackers in the UI and using search_calls + get_call_summary — Trackers are server-side and dramatically cheaper. Date ranges > 30 days require additional narrowing via primaryUserIds or domains. Returns sentence-level matches with speaker attribution and timestamps.',
				inputSchema: {
					type: 'object',
					properties: {
						keywords: {
							type: 'array',
							description:
								'Keywords to search for. Whole-word, case-insensitive by default.',
							items: { type: 'string', minLength: 2 },
							minItems: 1,
						},
						fromDateTime: {
							type: 'string',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
							description: 'REQUIRED. Start of date window (ISO 8601).',
						},
						toDateTime: {
							type: 'string',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
							description: 'REQUIRED. End of date window (ISO 8601).',
						},
						primaryUserIds: {
							type: 'array',
							description:
								'Narrow to calls hosted by these users before scanning.',
							items: { type: 'string', pattern: '^\\d{1,20}$' },
						},
						domains: {
							type: 'array',
							description:
								'Narrow to calls with external parties from these email domains before scanning.',
							items: { type: 'string' },
						},
						workspaceId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
						},
						caseSensitive: {
							type: 'boolean',
							description: 'Match keywords case-sensitively. Default false.',
						},
						wholeWord: {
							type: 'boolean',
							description:
								'Match whole words only. Default true (recommended).',
						},
						maxCalls: {
							type: 'number',
							minimum: 1,
							maximum: 5000,
							description: 'Max calls to scan (default: 500).',
						},
						maxMatchesPerCall: {
							type: 'number',
							minimum: 1,
							maximum: 50,
							description:
								'Max sentence matches returned per call (default: 10).',
						},
					},
					required: ['keywords', 'fromDateTime', 'toDateTime'],
				},
			},
			{
				name: 'get_call',
				description:
					'Get metadata for a specific Gong call including URL, direction, scope, system, and duration. Faster than get_call_summary when you only need call metadata.',
				inputSchema: {
					type: 'object',
					properties: {
						callId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
							description: 'Gong call ID (numeric string up to 20 digits)',
						},
					},
					required: ['callId'],
				},
			},
			{
				name: 'get_trackers',
				description:
					'List keyword tracker definitions configured in a workspace, including every tracked phrase and which side is tracked (company/customer). Call this before using the trackers filter on search_calls so you know what names exist — workspace admins set these up and naming varies (e.g., "Competitors" vs "Competitor Mentions"). Also useful to explain tracker hits that appear in call summaries.',
				inputSchema: {
					type: 'object',
					properties: {
						workspaceId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
							description: 'Filter trackers by workspace ID',
						},
					},
				},
			},
			{
				name: 'get_user',
				description:
					'Get a specific user profile including name, email, title, phone, and settings. Use to resolve user IDs returned from call data.',
				inputSchema: {
					type: 'object',
					properties: {
						userId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
							description: 'Gong user ID (numeric string up to 20 digits)',
						},
					},
					required: ['userId'],
				},
			},
			{
				name: 'search_users',
				description:
					'Search and filter users by IDs or creation date. More flexible than list_users for resolving specific user IDs from call data.',
				inputSchema: {
					type: 'object',
					properties: {
						userIds: {
							type: 'array',
							description: 'Specific user IDs to look up',
							items: {
								type: 'string',
								pattern: '^\\d{1,20}$',
							},
						},
						createdFromDateTime: {
							type: 'string',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
							description:
								'Filter users created after this datetime (ISO 8601)',
						},
						createdToDateTime: {
							type: 'string',
							pattern:
								'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
							description:
								'Filter users created before this datetime (ISO 8601)',
						},
						cursor: {
							type: 'string',
							description: 'Pagination cursor for fetching next page',
							minLength: 1,
						},
					},
				},
			},
			{
				name: 'list_workspaces',
				description:
					'List all Gong workspaces with their IDs and names. Use workspace IDs as filters in list_calls, search_calls, get_trackers, and other tools.',
				inputSchema: {
					type: 'object',
					properties: {},
				},
			},
			{
				name: 'list_library_folders',
				description:
					'List all public Gong call library folders for a workspace. Returns folder IDs and names to use with get_library_folder_calls. Use list_workspaces to find workspace IDs.',
				inputSchema: {
					type: 'object',
					properties: {
						workspaceId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
							description:
								'Workspace ID to list folders for (use list_workspaces to find IDs)',
						},
					},
					required: ['workspaceId'],
				},
			},
			{
				name: 'get_library_folder_calls',
				description:
					'Get all calls saved in a specific Gong library folder. Returns call IDs, titles, curator notes, and snippet timing. Use list_library_folders to find folder IDs. Call IDs can be passed to get_call_summary or get_call_transcript.',
				inputSchema: {
					type: 'object',
					properties: {
						folderId: {
							type: 'string',
							pattern: '^\\d{1,20}$',
							description:
								'Library folder ID (numeric string, from list_library_folders)',
						},
					},
					required: ['folderId'],
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
			case 'list_calls': {
				// Validate input with Zod schema (will throw ZodError if invalid)
				const validated = listCallsRequestSchema.parse(args ?? {});
				const result = await gong.listCalls(validated);
				return {
					content: [
						{
							type: 'text',
							text: formatCallsResponse(result),
						},
					],
				};
			}

			case 'get_call_summary': {
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
							type: 'text',
							text: formatCallSummary(call),
						},
					],
				};
			}

			case 'get_call_transcript': {
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
							type: 'text',
							text: formatCallTranscript(transcript, details?.parties, {
								maxLength: validated.maxLength,
								offset: validated.offset,
							}),
						},
					],
				};
			}

			case 'list_users': {
				// Validate input with Zod schema (will throw ZodError if invalid)
				const validated = listUsersRequestSchema.parse(args ?? {});
				const result = await gong.listUsers(validated);
				return {
					content: [
						{
							type: 'text',
							text: formatUsersResponse(result),
						},
					],
				};
			}

			case 'search_calls': {
				// Validate input with Zod schema (will throw ZodError if invalid)
				const validated = searchCallsRequestSchema.parse(args ?? {});
				const { response, totalBeforeFilter } =
					await gong.searchCallsAll(validated);
				return {
					content: [
						{
							type: 'text',
							text: formatCallDetailsResponse(
								response,
								totalBeforeFilter,
								validated.trackers,
							),
						},
					],
				};
			}

			case 'search_calls_by_account': {
				const validated = searchCallsByAccountRequestSchema.parse(args);
				const result = await gong.searchCallsByAccount(validated);
				return {
					content: [
						{
							type: 'text',
							text: formatMatchedCalls(result.calls, {
								header: `Calls for domain${validated.domains.length === 1 ? '' : 's'}: ${validated.domains.join(', ')}`,
								totalScanned: result.totalScanned,
								matched: result.matched,
								limitedByMaxCalls: result.limitedByMaxCalls,
							}),
						},
					],
				};
			}

			case 'search_calls_by_opportunity': {
				const validated =
					searchCallsByOpportunityRequestSchema.parse(args);
				const result = await gong.searchCallsByOpportunity(validated);
				const labels: string[] = [];
				if (validated.opportunityIds?.length) {
					labels.push(`IDs: ${validated.opportunityIds.join(', ')}`);
				}
				if (validated.opportunityNames?.length) {
					labels.push(
						`names: ${validated.opportunityNames.join(', ')}`,
					);
				}
				return {
					content: [
						{
							type: 'text',
							text: formatMatchedCalls(result.calls, {
								header: `Calls for opportunity (${labels.join(' / ')})`,
								totalScanned: result.totalScanned,
								matched: result.matched,
								limitedByMaxCalls: result.limitedByMaxCalls,
							}),
						},
					],
				};
			}

			case 'search_transcripts': {
				const validated = searchTranscriptsRequestSchema.parse(args);
				const result = await gong.searchTranscripts(validated);
				return {
					content: [
						{ type: 'text', text: formatTranscriptMatches(result) },
					],
				};
			}

			case 'get_call': {
				const validated = getCallRequestSchema.parse(args);
				const result = await gong.getCall(validated.callId);
				return {
					content: [{ type: 'text', text: formatSingleCall(result) }],
				};
			}

			case 'get_trackers': {
				const validated = getTrackersRequestSchema.parse(args ?? {});
				const result = await gong.getTrackers(validated);
				return {
					content: [{ type: 'text', text: formatTrackersResponse(result) }],
				};
			}

			case 'get_user': {
				const validated = getUserRequestSchema.parse(args);
				const result = await gong.getUser(validated.userId);
				return {
					content: [{ type: 'text', text: formatSingleUser(result) }],
				};
			}

			case 'search_users': {
				const validated = searchUsersRequestSchema.parse(args ?? {});
				const result = await gong.searchUsers(validated);
				return {
					content: [{ type: 'text', text: formatUsersResponse(result) }],
				};
			}

			case 'list_workspaces': {
				const result = await gong.listWorkspaces();
				return {
					content: [{ type: 'text', text: formatWorkspacesResponse(result) }],
				};
			}

			case 'list_library_folders': {
				const validated = listLibraryFoldersRequestSchema.parse(args);
				const result = await gong.listLibraryFolders(validated);
				return {
					content: [
						{ type: 'text', text: formatLibraryFoldersResponse(result) },
					],
				};
			}

			case 'get_library_folder_calls': {
				const validated = getLibraryFolderCallsRequestSchema.parse(args);
				const result = await gong.getLibraryFolderCalls(validated);
				return {
					content: [
						{
							type: 'text',
							text: formatLibraryFolderCallsResponse(result),
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
				const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
				return `${path}${issue.message}`;
			});
			message = `Validation error: ${issues.join('; ')}`;
		} else if (error instanceof Error) {
			message = error.message;
		} else {
			message = String(error);
		}
		return {
			content: [
				{
					type: 'text',
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
				uri: 'gong://users',
				name: 'Gong Users',
				description: 'List of all users in your Gong workspace',
				mimeType: 'text/markdown',
			},
		],
	};
});

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
	const { uri } = request.params;

	if (uri === 'gong://users') {
		const result = await gong.listUsers();
		return {
			contents: [
				{
					uri,
					mimeType: 'text/markdown',
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
	console.error('Gong MCP server running on stdio');
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
