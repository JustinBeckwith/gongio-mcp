/**
 * Gong API Client
 * https://gong.app.gong.io/settings/api/documentation
 */

import {
	type CallDetailsResponse,
	type CallsResponse,
	type ListCallsRequest,
	type ListUsersRequest,
	parseCallDetailsResponse,
	parseCallsResponse,
	parseTranscriptsResponse,
	parseUsersResponse,
	type TranscriptsResponse,
	type UsersResponse,
} from './schemas.js';

const GONG_API_BASE = 'https://api.gong.io/v2';

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
	TranscriptEntry,
	TranscriptsResponse,
	User,
	UsersResponse,
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
	 * Supports filtering by date range, workspace, primary users (hosts), and specific call IDs
	 * Returns minimal call metadata (same format as listCalls)
	 */
	async searchCalls(options: {
		fromDateTime?: string;
		toDateTime?: string;
		workspaceId?: string;
		primaryUserIds?: string[];
		callIds?: string[];
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

		// Build request body according to Gong API docs
		const body: Record<string, unknown> = {
			filter,
			// Omit contentSelector to get minimal fields (just metadata)
			// The API returns only metaData by default when contentSelector is not specified
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
}
