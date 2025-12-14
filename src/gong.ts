/**
 * Gong API Client
 * https://gong.app.gong.io/settings/api/documentation
 */

import {
	type CallsResponse,
	type CallDetailsResponse,
	type TranscriptsResponse,
	type UsersResponse,
	type ListCallsRequest,
	type ListUsersRequest,
	parseCallsResponse,
	parseCallDetailsResponse,
	parseTranscriptsResponse,
	parseUsersResponse,
} from './schemas.js';

const GONG_API_BASE = 'https://api.gong.io/v2';

export interface GongConfig {
	accessKey: string;
	accessKeySecret: string;
}

// Re-export types from schemas
export type {
	Call,
	CallsResponse,
	CallDetails,
	CallDetailsResponse,
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
	 */
	async getCallDetails(callIds: string[]): Promise<CallDetailsResponse> {
		const body = {
			filter: {
				callIds,
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
