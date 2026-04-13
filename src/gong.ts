/**
 * Gong API Client
 * https://gong.app.gong.io/settings/api/documentation
 */

import {
	type CallDetailsResponse,
	type CallsResponse,
	type CallTranscriptMatches,
	type GetLibraryFolderCallsRequest,
	type GetTrackersRequest,
	type LibraryFolderCallsResponse,
	type LibraryFoldersResponse,
	type ListCallsRequest,
	type ListLibraryFoldersRequest,
	type ListUsersRequest,
	parseCallDetailsResponse,
	parseCallsResponse,
	parseLibraryFolderCallsResponse,
	parseLibraryFoldersResponse,
	parseSingleCallResponse,
	parseSingleUserResponse,
	parseTrackersSettingsResponse,
	parseTranscriptsResponse,
	parseUsersResponse,
	parseWorkspacesResponse,
	type SearchCallsByAccountRequest,
	type SearchCallsByOpportunityRequest,
	type SearchTranscriptsRequest,
	type SearchTranscriptsResult,
	type SearchUsersRequest,
	type SingleCallResponse,
	type SingleUserResponse,
	type TrackersSettingsResponse,
	type TranscriptMatch,
	type TranscriptsResponse,
	type UsersResponse,
	type WorkspacesResponse,
} from './schemas.js';

const GONG_API_BASE = 'https://api.gong.io/v2';

/**
 * Build a contentSelector object for the Gong API calls/extensive endpoint.
 * Always includes parties, brief, and topics as defaults.
 * The include array adds additional content fields.
 */
export function buildContentSelector(
	include?: string[],
): Record<string, unknown> {
	const content: Record<string, boolean> = { brief: true, topics: true };
	const exposedFields: Record<string, unknown> = { parties: true, content };
	const selector: Record<string, unknown> = { exposedFields };

	if (!include) return selector;

	for (const item of include) {
		switch (item) {
			case 'keyPoints':
				content.keyPoints = true;
				break;
			case 'trackers':
				content.trackers = true;
				break;
			case 'highlights':
				content.highlights = true;
				break;
			case 'outline':
				content.outline = true;
				break;
			case 'speakers': {
				const interaction =
					(exposedFields.interaction as Record<string, boolean>) ?? {};
				interaction.speakers = true;
				exposedFields.interaction = interaction;
				break;
			}
			case 'comments':
				exposedFields.collaboration = { publicComments: true };
				break;
			case 'context':
				selector.context = 'Extended';
				break;
			case 'media':
				exposedFields.media = true;
				break;
		}
	}
	return selector;
}

export interface GongConfig {
	accessKey: string;
	accessKeySecret: string;
}

// Re-export types from schemas
export type {
	Call,
	CallDetails,
	CallDetailsResponse,
	CallsResponse,
	CallTranscript,
	LibraryFolderCallsResponse,
	LibraryFoldersResponse,
	SingleCallResponse,
	SingleUserResponse,
	TrackersSettingsResponse,
	TranscriptEntry,
	TranscriptsResponse,
	User,
	UsersResponse,
	WorkspacesResponse,
} from './schemas.js';

export class GongClient {
	private authHeader: string;

	constructor(config: GongConfig) {
		const credentials = Buffer.from(
			`${config.accessKey}:${config.accessKeySecret}`,
		).toString('base64');
		this.authHeader = `Basic ${credentials}`;
	}

	private async request<T>(
		method: string,
		endpoint: string,
		body?: unknown,
	): Promise<T> {
		const url = `${GONG_API_BASE}${endpoint}`;
		const response = await fetch(url, {
			method,
			headers: {
				Authorization: this.authHeader,
				'Content-Type': 'application/json',
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Gong API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}

		return response.json() as Promise<T>;
	}

	private async get<T>(
		endpoint: string,
		params?: Record<string, string>,
	): Promise<T> {
		const url = new URL(`${GONG_API_BASE}${endpoint}`);
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					url.searchParams.set(key, value);
				}
			}
		}

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				Authorization: this.authHeader,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Gong API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * List calls with optional filtering (GET /v2/calls)
	 */
	async listCalls(options?: ListCallsRequest): Promise<CallsResponse> {
		const params: Record<string, string> = {};

		if (options?.fromDateTime) {
			params.fromDateTime = options.fromDateTime;
		}
		if (options?.toDateTime) {
			params.toDateTime = options.toDateTime;
		}
		if (options?.workspaceId) {
			params.workspaceId = options.workspaceId;
		}
		if (options?.cursor) {
			params.cursor = options.cursor;
		}

		const response = await this.get('/calls', params);
		return parseCallsResponse(response);
	}

	/**
	 * Get detailed information about specific calls (POST /v2/calls/extensive)
	 * Includes AI-generated summaries (brief, keyPoints, outline, topics, actionItems)
	 */
	async getCallDetails(callIds: string[]): Promise<CallDetailsResponse> {
		const body = {
			filter: {
				callIds,
			},
			contentSelector: {
				exposedFields: {
					content: {
						brief: true,
						outline: true,
						keyPoints: true,
						topics: true,
						pointsOfInterest: true,
						callOutcome: true,
						trackers: true,
					},
					parties: true,
					collaboration: {
						publicComments: true,
					},
					interaction: {
						speakers: true,
						questions: true,
					},
				},
			},
		};
		const response = await this.request('POST', '/calls/extensive', body);
		return parseCallDetailsResponse(response);
	}

	/**
	 * Get transcripts for specific calls (POST /v2/calls/transcript)
	 */
	async getTranscripts(callIds: string[]): Promise<TranscriptsResponse> {
		const body = {
			filter: {
				callIds,
			},
		};
		const response = await this.request('POST', '/calls/transcript', body);
		return parseTranscriptsResponse(response);
	}

	/**
	 * Search calls with advanced filters (POST /v2/calls/extensive)
	 * Supports filtering by date range, workspace, primary users (hosts), and specific call IDs.
	 * Always includes parties, brief, and topics in the response.
	 * Use the include parameter to request additional content fields.
	 */
	async searchCalls(options: {
		fromDateTime?: string;
		toDateTime?: string;
		workspaceId?: string;
		primaryUserIds?: string[];
		callIds?: string[];
		include?: string[];
		cursor?: string;
	}): Promise<CallDetailsResponse> {
		// Build filter object
		const filter: Record<string, unknown> = {};

		if (options.fromDateTime) {
			filter.fromDateTime = options.fromDateTime;
		}
		if (options.toDateTime) {
			filter.toDateTime = options.toDateTime;
		}
		if (options.workspaceId) {
			filter.workspaceId = options.workspaceId;
		}
		if (options.primaryUserIds && options.primaryUserIds.length > 0) {
			filter.primaryUserIds = options.primaryUserIds;
		}
		if (options.callIds && options.callIds.length > 0) {
			filter.callIds = options.callIds;
		}

		const body: Record<string, unknown> = {
			filter,
			contentSelector: buildContentSelector(options.include),
		};

		if (options.cursor) {
			body.cursor = options.cursor;
		}

		const response = await this.request('POST', '/calls/extensive', body);
		return parseCallDetailsResponse(response);
	}

	/**
	 * List all users (GET /v2/users)
	 */
	async listUsers(options?: ListUsersRequest): Promise<UsersResponse> {
		const params: Record<string, string> = {};

		if (options?.cursor) {
			params.cursor = options.cursor;
		}
		if (options?.includeAvatars !== undefined) {
			params.includeAvatars = String(options.includeAvatars);
		}

		const response = await this.get('/users', params);
		return parseUsersResponse(response);
	}

	/**
	 * Get a single call's metadata (GET /v2/calls/{id})
	 */
	async getCall(callId: string): Promise<SingleCallResponse> {
		const response = await this.get(`/calls/${callId}`);
		return parseSingleCallResponse(response);
	}

	/**
	 * Get a specific user's profile (GET /v2/users/{id})
	 */
	async getUser(userId: string): Promise<SingleUserResponse> {
		const response = await this.get(`/users/${userId}`);
		return parseSingleUserResponse(response);
	}

	/**
	 * Search users with filters (POST /v2/users/extensive)
	 */
	async searchUsers(options: SearchUsersRequest): Promise<UsersResponse> {
		const filter: Record<string, unknown> = {};

		if (options.userIds && options.userIds.length > 0) {
			filter.userIds = options.userIds;
		}
		if (options.createdFromDateTime) {
			filter.createdFromDateTime = options.createdFromDateTime;
		}
		if (options.createdToDateTime) {
			filter.createdToDateTime = options.createdToDateTime;
		}

		const body: Record<string, unknown> = { filter };
		if (options.cursor) {
			body.cursor = options.cursor;
		}

		const response = await this.request('POST', '/users/extensive', body);
		return parseUsersResponse(response);
	}

	/**
	 * List keyword trackers (GET /v2/settings/trackers)
	 */
	async getTrackers(
		options?: GetTrackersRequest,
	): Promise<TrackersSettingsResponse> {
		const params: Record<string, string> = {};
		if (options?.workspaceId) {
			params.workspaceId = options.workspaceId;
		}
		const response = await this.get('/settings/trackers', params);
		return parseTrackersSettingsResponse(response);
	}

	/**
	 * List all workspaces (GET /v2/workspaces)
	 */
	async listWorkspaces(): Promise<WorkspacesResponse> {
		const response = await this.get('/workspaces');
		return parseWorkspacesResponse(response);
	}

	/**
	 * List public library folders (GET /v2/library/folders)
	 */
	async listLibraryFolders(
		options?: ListLibraryFoldersRequest,
	): Promise<LibraryFoldersResponse> {
		const params: Record<string, string> = {};
		if (options?.workspaceId) {
			params.workspaceId = options.workspaceId;
		}
		const response = await this.get('/library/folders', params);
		return parseLibraryFoldersResponse(response);
	}

	/**
	 * Get calls in a specific library folder (GET /v2/library/folder-content)
	 */
	async getLibraryFolderCalls(
		options: GetLibraryFolderCallsRequest,
	): Promise<LibraryFolderCallsResponse> {
		const response = await this.get('/library/folder-content', {
			folderId: options.folderId,
		});
		return parseLibraryFolderCallsResponse(response);
	}

	// ========================================================================
	// Account / Opportunity / Keyword Search
	// ========================================================================
	//
	// These methods wrap POST /v2/calls/extensive with a richer contentSelector
	// (parties + Extended context) and post-filter the response, because the
	// Gong API does not expose server-side filters for account/company,
	// opportunity, or transcript keywords.

	/**
	 * Auto-paginating /v2/calls/extensive fetch with parties + Extended context.
	 * Stops at maxCalls or when the API returns no cursor.
	 */
	private async fetchCallsExtensiveWithContext(options: {
		fromDateTime?: string;
		toDateTime?: string;
		workspaceId?: string;
		primaryUserIds?: string[];
		callIds?: string[];
		maxCalls?: number;
		cursor?: string;
	}): Promise<{
		calls: CallDetailsResponse['calls'];
		totalRecords: number;
		nextCursor?: string;
		limitedByMaxCalls: boolean;
	}> {
		const filter: Record<string, unknown> = {};
		if (options.fromDateTime) filter.fromDateTime = options.fromDateTime;
		if (options.toDateTime) filter.toDateTime = options.toDateTime;
		if (options.workspaceId) filter.workspaceId = options.workspaceId;
		if (options.primaryUserIds?.length) {
			filter.primaryUserIds = options.primaryUserIds;
		}
		if (options.callIds?.length) filter.callIds = options.callIds;

		const contentSelector = {
			context: 'Extended',
			contextTiming: ['Now'],
			exposedFields: {
				parties: true,
			},
		};

		const cap = options.maxCalls ?? 500;
		const accumulated: CallDetailsResponse['calls'] = [];
		let cursor: string | undefined = options.cursor;
		let totalRecords = 0;
		let limitedByMaxCalls = false;

		// Hard ceiling on paginated requests per call (defense against runaway loops).
		// 50 pages × ~100 records/page = 5000 calls, matches maxCallsSchema ceiling.
		const MAX_PAGES = 50;
		for (let page = 0; page < MAX_PAGES; page++) {
			const body: Record<string, unknown> = { filter, contentSelector };
			if (cursor) body.cursor = cursor;

			const response = await this.request<unknown>(
				'POST',
				'/calls/extensive',
				body,
			);
			const parsed = parseCallDetailsResponse(response);
			totalRecords = parsed.records.totalRecords;

			for (const call of parsed.calls) {
				if (accumulated.length >= cap) {
					limitedByMaxCalls = true;
					break;
				}
				accumulated.push(call);
			}
			if (limitedByMaxCalls) break;

			cursor = parsed.records.cursor;
			if (!cursor) break;
		}

		return {
			calls: accumulated,
			totalRecords,
			nextCursor: cursor,
			limitedByMaxCalls,
		};
	}

	/**
	 * Search calls by account/company via email-domain match on parties.
	 * Optionally also matches on CRM Account context object names.
	 */
	async searchCallsByAccount(
		options: SearchCallsByAccountRequest,
	): Promise<{
		calls: CallDetailsResponse['calls'];
		totalScanned: number;
		matched: number;
		limitedByMaxCalls: boolean;
	}> {
		const fetched = await this.fetchCallsExtensiveWithContext({
			fromDateTime: options.fromDateTime,
			toDateTime: options.toDateTime,
			workspaceId: options.workspaceId,
			primaryUserIds: options.primaryUserIds,
			maxCalls: options.maxCalls,
			cursor: options.cursor,
		});

		const lowerDomains = options.domains.map((d) => d.toLowerCase());
		const lowerDomainRoots = lowerDomains
			.map((d) => d.split('.')[0])
			.filter((r): r is string => Boolean(r));

		const matched = fetched.calls.filter((call) => {
			// Match 1: any external party emailAddress ends with @<domain>
			const partyMatch = call.parties?.some((p) => {
				if ((p.affiliation ?? '').toLowerCase() !== 'external') return false;
				const email = p.emailAddress?.toLowerCase();
				if (!email) return false;
				return lowerDomains.some((d) => email.endsWith(`@${d}`));
			});
			if (partyMatch) return true;

			// Match 2 (opt-in): any CRM Account context object whose name
			// contains the domain root (e.g. "acme" from "acme.com").
			if (options.matchCrmAccount && call.context) {
				for (const ctx of call.context) {
					if (!ctx.objects) continue;
					for (const obj of ctx.objects) {
						if (obj.objectType !== 'Account') continue;
						const nameField = obj.fields?.find(
							(f) => f.name?.toLowerCase() === 'name',
						);
						const name =
							typeof nameField?.value === 'string'
								? nameField.value.toLowerCase()
								: undefined;
						if (!name) continue;
						if (lowerDomainRoots.some((root) => name.includes(root))) {
							return true;
						}
					}
				}
			}
			return false;
		});

		return {
			calls: matched,
			totalScanned: fetched.calls.length,
			matched: matched.length,
			limitedByMaxCalls: fetched.limitedByMaxCalls,
		};
	}

	/**
	 * Search calls linked to specific CRM Opportunities.
	 * Requires Gong-CRM integration; calls without CRM linkage will not match.
	 */
	async searchCallsByOpportunity(
		options: SearchCallsByOpportunityRequest,
	): Promise<{
		calls: CallDetailsResponse['calls'];
		totalScanned: number;
		matched: number;
		limitedByMaxCalls: boolean;
	}> {
		const fetched = await this.fetchCallsExtensiveWithContext({
			fromDateTime: options.fromDateTime,
			toDateTime: options.toDateTime,
			workspaceId: options.workspaceId,
			primaryUserIds: options.primaryUserIds,
			maxCalls: options.maxCalls,
			cursor: options.cursor,
		});

		const idSet = new Set(options.opportunityIds ?? []);
		const lowerNames = (options.opportunityNames ?? []).map((n) =>
			n.toLowerCase(),
		);

		const matched = fetched.calls.filter((call) => {
			if (!call.context) return false;
			for (const ctx of call.context) {
				if (!ctx.objects) continue;
				for (const obj of ctx.objects) {
					if (obj.objectType !== 'Opportunity') continue;
					if (obj.objectId && idSet.has(obj.objectId)) return true;
					if (lowerNames.length > 0) {
						const nameField = obj.fields?.find(
							(f) => f.name?.toLowerCase() === 'name',
						);
						const name =
							typeof nameField?.value === 'string'
								? nameField.value.toLowerCase()
								: undefined;
						if (
							name &&
							lowerNames.some((needle) => name.includes(needle))
						) {
							return true;
						}
					}
				}
			}
			return false;
		});

		return {
			calls: matched,
			totalScanned: fetched.calls.length,
			matched: matched.length,
			limitedByMaxCalls: fetched.limitedByMaxCalls,
		};
	}

	/**
	 * Free-text keyword search across transcripts within a bounded date range.
	 * Two phases: (1) narrow call set with extensive, (2) fetch transcripts and
	 * post-filter sentences. Use Gong Trackers for known recurring terms instead.
	 */
	async searchTranscripts(
		options: SearchTranscriptsRequest,
	): Promise<SearchTranscriptsResult> {
		// Phase 1: narrow call set
		const fetched = await this.fetchCallsExtensiveWithContext({
			fromDateTime: options.fromDateTime,
			toDateTime: options.toDateTime,
			workspaceId: options.workspaceId,
			primaryUserIds: options.primaryUserIds,
			maxCalls: options.maxCalls,
		});

		// Apply domain filter if present
		let candidateCalls = fetched.calls;
		if (options.domains && options.domains.length > 0) {
			const lowerDomains = options.domains.map((d) => d.toLowerCase());
			candidateCalls = candidateCalls.filter((call) =>
				call.parties?.some((p) => {
					if ((p.affiliation ?? '').toLowerCase() !== 'external') return false;
					const email = p.emailAddress?.toLowerCase();
					if (!email) return false;
					return lowerDomains.some((d) => email.endsWith(`@${d}`));
				}),
			);
		}

		if (candidateCalls.length === 0) {
			return {
				keywords: options.keywords,
				callsScanned: 0,
				callsWithMatches: 0,
				totalMatches: 0,
				results: [],
				limitedByMaxCalls: fetched.limitedByMaxCalls,
			};
		}

		// Phase 2: fetch transcripts in batches
		const callIdToCall = new Map(candidateCalls.map((c) => [c.metaData.id, c]));
		const callIds = Array.from(callIdToCall.keys());

		// /v2/calls/transcript accepts arrays; Gong recommends modest batch sizes.
		const TRANSCRIPT_BATCH = 100;
		const transcripts: TranscriptsResponse['callTranscripts'] = [];
		for (let i = 0; i < callIds.length; i += TRANSCRIPT_BATCH) {
			const batch = callIds.slice(i, i + TRANSCRIPT_BATCH);
			const result = await this.getTranscripts(batch);
			transcripts.push(...result.callTranscripts);
		}

		// Build keyword matchers
		const matchers = options.keywords.map((kw) => {
			const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const flags = options.caseSensitive ? 'g' : 'gi';
			const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
			return { keyword: kw, regex: new RegExp(pattern, flags) };
		});

		const results: CallTranscriptMatches[] = [];
		let totalMatches = 0;
		const maxPerCall = options.maxMatchesPerCall ?? 10;

		for (const transcript of transcripts) {
			const call = callIdToCall.get(transcript.callId);
			if (!call) continue;

			// Build speaker resolution map from parties
			const speakerInfo = new Map<
				string,
				{ name?: string; affiliation?: string }
			>();
			for (const p of call.parties ?? []) {
				if (p.speakerId) {
					speakerInfo.set(p.speakerId, {
						name: p.name ?? p.emailAddress ?? undefined,
						affiliation: p.affiliation ?? undefined,
					});
				}
			}

			const callMatches: TranscriptMatch[] = [];
			let truncated = false;

			outer: for (const entry of transcript.transcript) {
				for (const sentence of entry.sentences) {
					for (const { keyword, regex } of matchers) {
						regex.lastIndex = 0; // reset because we use /g
						if (regex.test(sentence.text)) {
							const info = speakerInfo.get(entry.speakerId);
							callMatches.push({
								keyword,
								speakerId: entry.speakerId,
								speakerName: info?.name,
								speakerAffiliation: info?.affiliation,
								startTime: sentence.start,
								snippet: sentence.text,
							});
							if (callMatches.length >= maxPerCall) {
								truncated = true;
								break outer;
							}
							break; // one keyword match per sentence is enough
						}
					}
				}
			}

			if (callMatches.length > 0) {
				totalMatches += callMatches.length;
				results.push({
					callId: transcript.callId,
					callTitle: call.metaData.title ?? undefined,
					callStarted: call.metaData.started ?? undefined,
					callUrl: call.metaData.url ?? undefined,
					totalMatches: callMatches.length,
					matches: callMatches,
					truncated,
				});
			}
		}

		return {
			keywords: options.keywords,
			callsScanned: candidateCalls.length,
			callsWithMatches: results.length,
			totalMatches,
			results,
			limitedByMaxCalls: fetched.limitedByMaxCalls,
		};
	}
}
