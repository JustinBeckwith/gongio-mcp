import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	GongClient,
	buildContentSelector,
	filterByCustomerName,
	filterByMinDuration,
	filterByParticipantEmails,
	filterByParticipantUserIds,
	filterByPrimaryUserEmails,
	filterByScope,
	filterByTrackers,
} from '../src/gong.js';
import type {
	CallDetails,
	CallDetailsResponse,
	LibraryFolderCallsResponse,
	LibraryFoldersResponse,
	SingleCallResponse,
	SingleUserResponse,
	TrackersSettingsResponse,
	UsersResponse,
	WorkspacesResponse,
} from '../src/schemas.js';

describe('GongClient', () => {
	let client: GongClient;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Create a mock for the global fetch
		fetchMock = vi.fn();
		global.fetch = fetchMock;

		client = new GongClient({
			accessKey: 'test-key',
			accessKeySecret: 'test-secret',
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('searchCalls', () => {
		it('sends POST request to /v2/calls/extensive', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 0,
					currentPageSize: 0,
					currentPageNumber: 1,
				},
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({});

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.gong.io/v2/calls/extensive',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
					}),
				}),
			);
		});

		it('includes date range filters in request body', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 1,
					currentPageSize: 1,
					currentPageNumber: 1,
				},
				calls: [
					{
						metaData: { id: '123', title: 'Test Call' },
					},
				],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({
				fromDateTime: '2024-01-01T00:00:00Z',
				toDateTime: '2024-01-31T23:59:59Z',
			});

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(callBody.filter.fromDateTime).toBe('2024-01-01T00:00:00Z');
			expect(callBody.filter.toDateTime).toBe('2024-01-31T23:59:59Z');
		});

		it('includes workspaceId in request body filter', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 0,
					currentPageSize: 0,
					currentPageNumber: 1,
				},
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({
				workspaceId: '12345',
			});

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(callBody.filter.workspaceId).toBe('12345');
		});

		it('includes primaryUserIds array in request body filter', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 0,
					currentPageSize: 0,
					currentPageNumber: 1,
				},
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({
				primaryUserIds: ['111', '222', '333'],
			});

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(callBody.filter.primaryUserIds).toEqual(['111', '222', '333']);
		});

		it('includes callIds array in request body filter', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 2,
					currentPageSize: 2,
					currentPageNumber: 1,
				},
				calls: [
					{ metaData: { id: '123', title: 'Call 1' } },
					{ metaData: { id: '456', title: 'Call 2' } },
				],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({
				callIds: ['123', '456'],
			});

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(callBody.filter.callIds).toEqual(['123', '456']);
		});

		it('includes cursor in request body (not in filter)', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 100,
					currentPageSize: 10,
					currentPageNumber: 2,
					cursor: 'next-page',
				},
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({
				cursor: 'page-2-cursor',
			});

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(callBody.cursor).toBe('page-2-cursor');
			expect(callBody.filter.cursor).toBeUndefined();
		});

		it('combines multiple filters in single request', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 5,
					currentPageSize: 5,
					currentPageNumber: 1,
				},
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({
				fromDateTime: '2024-01-01T00:00:00Z',
				toDateTime: '2024-01-31T23:59:59Z',
				workspaceId: '999',
				primaryUserIds: ['111', '222'],
				cursor: 'some-cursor',
			});

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(callBody.filter).toEqual({
				fromDateTime: '2024-01-01T00:00:00Z',
				toDateTime: '2024-01-31T23:59:59Z',
				workspaceId: '999',
				primaryUserIds: ['111', '222'],
			});
			expect(callBody.cursor).toBe('some-cursor');
		});

		it('does not include empty arrays in filter', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 0,
					currentPageSize: 0,
					currentPageNumber: 1,
				},
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({
				primaryUserIds: [],
				callIds: [],
			});

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(callBody.filter.primaryUserIds).toBeUndefined();
			expect(callBody.filter.callIds).toBeUndefined();
		});

		it('returns parsed CallDetailsResponse', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-456',
				records: {
					totalRecords: 1,
					currentPageSize: 1,
					currentPageNumber: 1,
				},
				calls: [
					{
						metaData: {
							id: '789',
							title: 'Important Call',
							started: '2024-01-15T10:00:00Z',
							duration: 1800,
							scope: 'External',
						},
					},
				],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await client.searchCalls({
				fromDateTime: '2024-01-01T00:00:00Z',
			});

			expect(result).toEqual(mockResponse);
			expect(result.calls).toHaveLength(1);
			expect(result.calls[0].metaData.id).toBe('789');
			expect(result.calls[0].metaData.title).toBe('Important Call');
		});

		it('includes default contentSelector with parties, brief, and topics', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 0,
					currentPageSize: 0,
					currentPageNumber: 1,
				},
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({});

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(callBody.contentSelector).toBeDefined();
			expect(callBody.contentSelector.exposedFields.parties).toBe(true);
			expect(callBody.contentSelector.exposedFields.content.brief).toBe(
				true,
			);
			expect(callBody.contentSelector.exposedFields.content.topics).toBe(
				true,
			);
			expect(callBody.filter).toBeDefined();
		});

		it('adds include fields to contentSelector', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'test-123',
				records: {
					totalRecords: 0,
					currentPageSize: 0,
					currentPageNumber: 1,
				},
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchCalls({
				include: ['keyPoints', 'trackers', 'speakers', 'context'],
			});

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			const cs = callBody.contentSelector;
			expect(cs.exposedFields.content.keyPoints).toBe(true);
			expect(cs.exposedFields.content.trackers).toBe(true);
			expect(cs.exposedFields.interaction.speakers).toBe(true);
			expect(cs.context).toBe('Extended');
		});

		it('returns empty response on 404 "No calls found"', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				text: async () =>
					'{"requestId":"x","errors":["No calls found corresponding to the provided filters"]}',
			});

			const result = await client.searchCalls({});
			expect(result.calls).toHaveLength(0);
			expect(result.records.totalRecords).toBe(0);
		});

		it('propagates real errors (400)', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				text: async () =>
					'{"requestId":"x","errors":["Json parse error"]}',
			});

			await expect(client.searchCalls({})).rejects.toThrow(
				/400.*Json parse error/,
			);
		});
	});

	describe('getCall', () => {
		it('sends GET request to /v2/calls/{id}', async () => {
			const mockResponse: SingleCallResponse = {
				requestId: 'test-123',
				call: { id: '123', title: 'Test Call' },
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.getCall('123');

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.gong.io/v2/calls/123',
				expect.objectContaining({ method: 'GET' }),
			);
		});

		it('returns parsed SingleCallResponse', async () => {
			const mockResponse: SingleCallResponse = {
				call: { id: '456', title: 'Demo Call', duration: 3600 },
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await client.getCall('456');
			expect(result.call.id).toBe('456');
			expect(result.call.title).toBe('Demo Call');
		});
	});

	describe('getUser', () => {
		it('sends GET request to /v2/users/{id}', async () => {
			const mockResponse: SingleUserResponse = {
				requestId: 'test-123',
				user: { id: '111', emailAddress: 'john@example.com' },
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.getUser('111');

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.gong.io/v2/users/111',
				expect.objectContaining({ method: 'GET' }),
			);
		});

		it('returns parsed SingleUserResponse', async () => {
			const mockResponse: SingleUserResponse = {
				user: {
					id: '222',
					firstName: 'Jane',
					lastName: 'Doe',
					emailAddress: 'jane@example.com',
				},
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await client.getUser('222');
			expect(result.user.id).toBe('222');
			expect(result.user.firstName).toBe('Jane');
		});
	});

	describe('searchUsers', () => {
		it('sends POST request to /v2/users/extensive', async () => {
			const mockResponse: UsersResponse = {
				requestId: 'test-123',
				records: { totalRecords: 0, currentPageSize: 0, currentPageNumber: 1 },
				users: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchUsers({});

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.gong.io/v2/users/extensive',
				expect.objectContaining({ method: 'POST' }),
			);
		});

		it('includes userIds in filter', async () => {
			const mockResponse: UsersResponse = {
				requestId: 'test-123',
				records: { totalRecords: 0, currentPageSize: 0, currentPageNumber: 1 },
				users: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchUsers({ userIds: ['111', '222'] });

			const body = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(body.filter.userIds).toEqual(['111', '222']);
		});

		it('does not include empty userIds array in filter', async () => {
			const mockResponse: UsersResponse = {
				requestId: 'test-123',
				records: { totalRecords: 0, currentPageSize: 0, currentPageNumber: 1 },
				users: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchUsers({ userIds: [] });

			const body = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(body.filter.userIds).toBeUndefined();
		});

		it('includes cursor at top level not in filter', async () => {
			const mockResponse: UsersResponse = {
				requestId: 'test-123',
				records: { totalRecords: 0, currentPageSize: 0, currentPageNumber: 1 },
				users: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.searchUsers({ cursor: 'page-2' });

			const body = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(body.cursor).toBe('page-2');
			expect(body.filter.cursor).toBeUndefined();
		});
	});

	describe('getTrackers', () => {
		it('sends GET request to /v2/settings/trackers', async () => {
			const mockResponse: TrackersSettingsResponse = {
				requestId: 'test-123',
				keywordTrackers: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.getTrackers();

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.gong.io/v2/settings/trackers',
				expect.objectContaining({ method: 'GET' }),
			);
		});

		it('includes workspaceId as query parameter', async () => {
			const mockResponse: TrackersSettingsResponse = { keywordTrackers: [] };

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.getTrackers({ workspaceId: '12345' });

			const calledUrl = fetchMock.mock.calls[0][0] as string;
			expect(calledUrl).toContain('workspaceId=12345');
		});
	});

	describe('listWorkspaces', () => {
		it('sends GET request to /v2/workspaces', async () => {
			const mockResponse: WorkspacesResponse = {
				requestId: 'test-123',
				workspaces: [{ id: '111', name: 'North America' }],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.listWorkspaces();

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.gong.io/v2/workspaces',
				expect.objectContaining({ method: 'GET' }),
			);
		});

		it('returns parsed WorkspacesResponse', async () => {
			const mockResponse: WorkspacesResponse = {
				workspaces: [
					{ id: '111', name: 'North America', description: 'NA region' },
					{ id: '222', name: 'EMEA' },
				],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await client.listWorkspaces();
			expect(result.workspaces).toHaveLength(2);
			expect(result.workspaces?.[0]?.id).toBe('111');
		});
	});

	describe('listLibraryFolders', () => {
		it('sends GET request to /v2/library/folders', async () => {
			const mockResponse: LibraryFoldersResponse = {
				requestId: 'test-123',
				folders: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.listLibraryFolders({ workspaceId: '123' });

			expect(fetchMock).toHaveBeenCalledWith(
				expect.stringContaining('/v2/library/folders'),
				expect.objectContaining({ method: 'GET' }),
			);
		});

		it('includes workspaceId as query parameter', async () => {
			const mockResponse: LibraryFoldersResponse = { folders: [] };

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.listLibraryFolders({ workspaceId: '999' });

			const calledUrl = fetchMock.mock.calls[0][0] as string;
			expect(calledUrl).toContain('workspaceId=999');
		});
	});

	describe('getLibraryFolderCalls', () => {
		it('sends GET request to /v2/library/folder-content', async () => {
			const mockResponse: LibraryFolderCallsResponse = {
				requestId: 'test-123',
				id: '555',
				name: 'Best Discovery Calls',
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.getLibraryFolderCalls({ folderId: '555' });

			expect(fetchMock).toHaveBeenCalledWith(
				expect.stringContaining('/v2/library/folder-content'),
				expect.objectContaining({ method: 'GET' }),
			);
		});

		it('passes folderId as query parameter', async () => {
			const mockResponse: LibraryFolderCallsResponse = {
				id: '3843152912968920037',
				name: 'Onboarding',
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			await client.getLibraryFolderCalls({
				folderId: '3843152912968920037',
			});

			const calledUrl = fetchMock.mock.calls[0][0] as string;
			expect(calledUrl).toContain('folderId=3843152912968920037');
		});

		it('returns parsed LibraryFolderCallsResponse', async () => {
			const mockResponse: LibraryFolderCallsResponse = {
				id: '555',
				name: 'Best Calls',
				calls: [
					{
						id: '111222333',
						title: 'Great discovery call',
						addedBy: 'user-1',
						created: '2024-03-01T10:00:00Z',
					},
				],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await client.getLibraryFolderCalls({ folderId: '555' });
			expect(result.name).toBe('Best Calls');
			expect(result.calls).toHaveLength(1);
			expect(result.calls?.[0]?.id).toBe('111222333');
		});
	});

	describe('searchCallsAll', () => {
		it('returns all calls from a single page', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'req-1',
				records: {
					totalRecords: 2,
					currentPageSize: 2,
					currentPageNumber: 0,
				},
				calls: [
					{ metaData: { id: '1', title: 'Call 1' } },
					{ metaData: { id: '2', title: 'Call 2' } },
				],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const { response, totalBeforeFilter } =
				await client.searchCallsAll({});
			expect(response.calls).toHaveLength(2);
			expect(totalBeforeFilter).toBe(2);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('accumulates calls across multiple pages', async () => {
			const page1: CallDetailsResponse = {
				requestId: 'req-1',
				records: {
					totalRecords: 3,
					currentPageSize: 2,
					currentPageNumber: 0,
					cursor: 'page-2',
				},
				calls: [
					{ metaData: { id: '1', title: 'Call 1' } },
					{ metaData: { id: '2', title: 'Call 2' } },
				],
			};
			const page2: CallDetailsResponse = {
				requestId: 'req-2',
				records: {
					totalRecords: 3,
					currentPageSize: 1,
					currentPageNumber: 1,
				},
				calls: [{ metaData: { id: '3', title: 'Call 3' } }],
			};

			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					json: async () => page1,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => page2,
				});

			const { response, totalBeforeFilter } =
				await client.searchCallsAll({});
			expect(response.calls).toHaveLength(3);
			expect(totalBeforeFilter).toBe(3);
			expect(fetchMock).toHaveBeenCalledTimes(2);

			// Verify cursor was passed on second call
			const secondCallBody = JSON.parse(
				fetchMock.mock.calls[1][1].body,
			);
			expect(secondCallBody.cursor).toBe('page-2');
		});

		it('returns empty results for no calls', async () => {
			const mockResponse: CallDetailsResponse = {
				requestId: 'req-1',
				records: {
					totalRecords: 0,
					currentPageSize: 0,
					currentPageNumber: 0,
				},
				calls: [],
			};

			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const { response, totalBeforeFilter } =
				await client.searchCallsAll({});
			expect(response.calls).toHaveLength(0);
			expect(totalBeforeFilter).toBe(0);
		});

		it('passes contentSelector through on every page request', async () => {
			const page1: CallDetailsResponse = {
				requestId: 'req-1',
				records: {
					totalRecords: 2,
					currentPageSize: 1,
					currentPageNumber: 0,
					cursor: 'page-2',
				},
				calls: [{ metaData: { id: '1', title: 'Call 1' } }],
			};
			const page2: CallDetailsResponse = {
				requestId: 'req-2',
				records: {
					totalRecords: 2,
					currentPageSize: 1,
					currentPageNumber: 1,
				},
				calls: [{ metaData: { id: '2', title: 'Call 2' } }],
			};

			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					json: async () => page1,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => page2,
				});

			await client.searchCallsAll({ include: ['keyPoints'] });

			for (const call of fetchMock.mock.calls) {
				const body = JSON.parse(call[1].body);
				expect(body.contentSelector).toBeDefined();
				expect(
					body.contentSelector.exposedFields.content.keyPoints,
				).toBe(true);
			}
		});
	});
});

describe('buildContentSelector', () => {
	it('returns default fields when no include is provided', () => {
		const selector = buildContentSelector();
		expect(selector.exposedFields).toEqual({
			parties: true,
			content: { brief: true, topics: true },
		});
	});

	it('returns default fields when include is undefined', () => {
		const selector = buildContentSelector(undefined);
		expect(selector.exposedFields).toEqual({
			parties: true,
			content: { brief: true, topics: true },
		});
	});

	it('adds keyPoints to content fields', () => {
		const selector = buildContentSelector(['keyPoints']);
		const content = (selector.exposedFields as Record<string, unknown>)
			.content as Record<string, boolean>;
		expect(content.keyPoints).toBe(true);
		expect(content.brief).toBe(true);
		expect(content.topics).toBe(true);
	});

	it('adds trackers to content fields', () => {
		const selector = buildContentSelector(['trackers']);
		const content = (selector.exposedFields as Record<string, unknown>)
			.content as Record<string, boolean>;
		expect(content.trackers).toBe(true);
	});

	it('adds highlights to content fields', () => {
		const selector = buildContentSelector(['highlights']);
		const content = (selector.exposedFields as Record<string, unknown>)
			.content as Record<string, boolean>;
		expect(content.highlights).toBe(true);
	});

	it('adds outline to content fields', () => {
		const selector = buildContentSelector(['outline']);
		const content = (selector.exposedFields as Record<string, unknown>)
			.content as Record<string, boolean>;
		expect(content.outline).toBe(true);
	});

	it('adds speakers to interaction fields', () => {
		const selector = buildContentSelector(['speakers']);
		const exposed = selector.exposedFields as Record<string, unknown>;
		expect(exposed.interaction).toEqual({ speakers: true });
	});

	it('adds publicComments to collaboration fields', () => {
		const selector = buildContentSelector(['comments']);
		const exposed = selector.exposedFields as Record<string, unknown>;
		expect(exposed.collaboration).toEqual({ publicComments: true });
	});

	it('sets context to Extended', () => {
		const selector = buildContentSelector(['context']);
		expect(selector.context).toBe('Extended');
	});

	it('sets media to true', () => {
		const selector = buildContentSelector(['media']);
		const exposed = selector.exposedFields as Record<string, unknown>;
		expect(exposed.media).toBe(true);
	});

	it('handles multiple include values', () => {
		const selector = buildContentSelector([
			'keyPoints',
			'speakers',
			'context',
			'media',
		]);
		const exposed = selector.exposedFields as Record<string, unknown>;
		const content = exposed.content as Record<string, boolean>;
		expect(content.keyPoints).toBe(true);
		expect(exposed.interaction).toEqual({ speakers: true });
		expect(selector.context).toBe('Extended');
		expect(exposed.media).toBe(true);
	});
});

describe('filterByParticipantUserIds', () => {
	const calls: CallDetails[] = [
		{
			metaData: { id: '1', title: 'Call 1' },
			parties: [
				{ userId: '100', name: 'Alice' },
				{ userId: '200', name: 'Bob' },
			],
		},
		{
			metaData: { id: '2', title: 'Call 2' },
			parties: [{ userId: '300', name: 'Charlie' }],
		},
		{
			metaData: { id: '3', title: 'Call 3' },
			parties: [],
		},
	];

	it('returns calls where a party has a matching userId', () => {
		const result = filterByParticipantUserIds(calls, ['200']);
		expect(result).toHaveLength(1);
		expect(result[0].metaData.id).toBe('1');
	});

	it('matches multiple user IDs', () => {
		const result = filterByParticipantUserIds(calls, ['100', '300']);
		expect(result).toHaveLength(2);
	});

	it('returns empty when no match', () => {
		const result = filterByParticipantUserIds(calls, ['999']);
		expect(result).toHaveLength(0);
	});

	it('handles calls with null parties', () => {
		const callsWithNull: CallDetails[] = [
			{ metaData: { id: '1', title: 'No parties' }, parties: null },
		];
		const result = filterByParticipantUserIds(callsWithNull, ['100']);
		expect(result).toHaveLength(0);
	});
});

describe('filterByParticipantEmails', () => {
	const calls: CallDetails[] = [
		{
			metaData: { id: '1', title: 'Call 1' },
			parties: [
				{ emailAddress: 'alice@example.com', name: 'Alice' },
				{ emailAddress: 'bob@example.com', name: 'Bob' },
			],
		},
		{
			metaData: { id: '2', title: 'Call 2' },
			parties: [{ name: 'No Email' }],
		},
	];

	it('matches email case-insensitively', () => {
		const result = filterByParticipantEmails(calls, ['ALICE@EXAMPLE.COM']);
		expect(result).toHaveLength(1);
		expect(result[0].metaData.id).toBe('1');
	});

	it('returns empty when no match', () => {
		const result = filterByParticipantEmails(calls, ['nobody@example.com']);
		expect(result).toHaveLength(0);
	});

	it('handles parties with null emailAddress', () => {
		const result = filterByParticipantEmails(calls, ['noemail@test.com']);
		expect(result).toHaveLength(0);
	});
});

describe('filterByCustomerName', () => {
	const calls: CallDetails[] = [
		{
			metaData: { id: '1', title: 'Vendor // Acme Corp Sync' },
			context: [
				{
					system: 'HubSpot',
					objects: [
						{
							objectType: 'Account',
							objectId: '123',
							fields: [{ name: 'Name', value: 'Acme Corporation' }],
						},
					],
				},
			],
			parties: [
				{
					emailAddress: 'john@acme.com',
					affiliation: 'External',
					name: 'John',
				},
			],
		},
		{
			metaData: { id: '2', title: 'Internal Standup' },
			parties: [
				{
					emailAddress: 'alice@example.com',
					affiliation: 'Internal',
					name: 'Alice',
				},
			],
		},
		{
			metaData: { id: '3', title: 'Globex Meeting' },
			parties: [
				{
					emailAddress: 'hank@globex.com',
					affiliation: 'External',
					name: 'Hank',
				},
			],
		},
	];

	it('matches CRM Account Name', () => {
		const result = filterByCustomerName(calls, 'Acme');
		expect(result.some((c) => c.metaData.id === '1')).toBe(true);
	});

	it('matches external participant email domain', () => {
		const result = filterByCustomerName(calls, 'globex');
		expect(result).toHaveLength(1);
		expect(result[0].metaData.id).toBe('3');
	});

	it('matches call title', () => {
		const result = filterByCustomerName(calls, 'Acme Corp');
		expect(result.some((c) => c.metaData.id === '1')).toBe(true);
	});

	it('is case-insensitive', () => {
		const result = filterByCustomerName(calls, 'acme');
		expect(result.some((c) => c.metaData.id === '1')).toBe(true);
	});

	it('does not match internal email domains', () => {
		const internalCalls: CallDetails[] = [
			{
				metaData: { id: '1', title: 'Team Standup' },
				parties: [
					{
						emailAddress: 'alice@internal.com',
						affiliation: 'Internal',
						name: 'Alice',
					},
				],
			},
		];
		const result = filterByCustomerName(internalCalls, 'internal');
		expect(result).toHaveLength(0);
	});

	it('returns empty when no match', () => {
		const result = filterByCustomerName(calls, 'Nonexistent');
		expect(result).toHaveLength(0);
	});

	it('handles calls with null context and parties', () => {
		const sparse: CallDetails[] = [
			{ metaData: { id: '1', title: null } },
		];
		const result = filterByCustomerName(sparse, 'anything');
		expect(result).toHaveLength(0);
	});
});

describe('filterByPrimaryUserEmails', () => {
	const calls: CallDetails[] = [
		{
			metaData: { id: '1', title: 'Hosted by Alice', primaryUserId: '100' },
			parties: [
				{
					userId: '100',
					emailAddress: 'alice@example.com',
					name: 'Alice',
				},
				{
					userId: '200',
					emailAddress: 'bob@example.com',
					name: 'Bob',
				},
			],
		},
		{
			metaData: { id: '2', title: 'Hosted by Bob', primaryUserId: '200' },
			parties: [
				{
					userId: '200',
					emailAddress: 'bob@example.com',
					name: 'Bob',
				},
			],
		},
		{
			metaData: { id: '3', title: 'No primary user' },
			parties: [
				{
					userId: '100',
					emailAddress: 'alice@example.com',
					name: 'Alice',
				},
			],
		},
		{
			metaData: {
				id: '4',
				title: 'Primary not in parties',
				primaryUserId: '999',
			},
			parties: [
				{
					userId: '100',
					emailAddress: 'alice@example.com',
					name: 'Alice',
				},
			],
		},
	];

	it('matches when primary user email is in list', () => {
		const result = filterByPrimaryUserEmails(calls, ['alice@example.com']);
		expect(result).toHaveLength(1);
		expect(result[0].metaData.id).toBe('1');
	});

	it('is case-insensitive', () => {
		const result = filterByPrimaryUserEmails(calls, ['ALICE@EXAMPLE.COM']);
		expect(result).toHaveLength(1);
	});

	it('excludes calls with no primaryUserId', () => {
		const result = filterByPrimaryUserEmails(calls, ['alice@example.com']);
		expect(result.every((c) => c.metaData.id !== '3')).toBe(true);
	});

	it('excludes calls where primary user is not in parties', () => {
		const result = filterByPrimaryUserEmails(calls, ['alice@example.com']);
		expect(result.every((c) => c.metaData.id !== '4')).toBe(true);
	});

	it('returns empty when no email matches', () => {
		const result = filterByPrimaryUserEmails(calls, ['nobody@example.com']);
		expect(result).toHaveLength(0);
	});
});

describe('filterByTrackers', () => {
	const calls: CallDetails[] = [
		{
			metaData: { id: '1', title: 'Call 1' },
			content: {
				trackers: [
					{ id: 't1', name: 'Competitors', count: 3 },
					{ id: 't2', name: 'Pricing', count: 0 },
				],
			},
		},
		{
			metaData: { id: '2', title: 'Call 2' },
			content: {
				trackers: [{ id: 't3', name: 'Pain points (tracker)', count: 2 }],
			},
		},
		{
			metaData: { id: '3', title: 'Call 3' },
			content: { trackers: [] },
		},
		{
			metaData: { id: '4', title: 'Call 4' },
		},
	];

	it('matches tracker name by case-insensitive substring', () => {
		const result = filterByTrackers(calls, ['competitor']);
		expect(result).toHaveLength(1);
		expect(result[0].metaData.id).toBe('1');
	});

	it('requires count > 0', () => {
		// Pricing exists on Call 1 but with count 0 — should not match
		const result = filterByTrackers(calls, ['pricing']);
		expect(result).toHaveLength(0);
	});

	it('matches any of multiple tracker names (OR)', () => {
		const result = filterByTrackers(calls, ['competitor', 'pain']);
		expect(result).toHaveLength(2);
	});

	it('returns empty when no match', () => {
		const result = filterByTrackers(calls, ['nonexistent']);
		expect(result).toHaveLength(0);
	});

	it('handles calls with no content or trackers', () => {
		const result = filterByTrackers(calls, ['competitor']);
		// Calls 3 and 4 have no/empty trackers — should be excluded
		expect(result.every((c) => c.metaData.id === '1')).toBe(true);
	});
});

describe('searchCallsAll with trackers filter', () => {
	let client: GongClient;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		global.fetch = fetchMock;
		client = new GongClient({
			accessKey: 'test-key',
			accessKeySecret: 'test-secret',
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('auto-enables trackers in contentSelector when trackers filter is set', async () => {
		const mockResponse: CallDetailsResponse = {
			requestId: 'test',
			records: {
				totalRecords: 0,
				currentPageSize: 0,
				currentPageNumber: 0,
			},
			calls: [],
		};

		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => mockResponse,
		});

		await client.searchCallsAll({ trackers: ['Competitors'] });

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.contentSelector.exposedFields.content.trackers).toBe(true);
	});

	it('does not duplicate trackers in include when already present', async () => {
		const mockResponse: CallDetailsResponse = {
			requestId: 'test',
			records: {
				totalRecords: 0,
				currentPageSize: 0,
				currentPageNumber: 0,
			},
			calls: [],
		};

		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => mockResponse,
		});

		await client.searchCallsAll({
			trackers: ['Competitors'],
			include: ['trackers', 'keyPoints'],
		});

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.contentSelector.exposedFields.content.trackers).toBe(true);
		expect(body.contentSelector.exposedFields.content.keyPoints).toBe(true);
	});
});

describe('filterByScope', () => {
	const calls: CallDetails[] = [
		{ metaData: { id: '1', title: 'External call', scope: 'External' } },
		{ metaData: { id: '2', title: 'Internal call', scope: 'Internal' } },
		{ metaData: { id: '3', title: 'Unknown scope', scope: 'Unknown' } },
		{ metaData: { id: '4', title: 'No scope' } },
	];

	it('matches External scope exactly', () => {
		const result = filterByScope(calls, 'External');
		expect(result).toHaveLength(1);
		expect(result[0].metaData.id).toBe('1');
	});

	it('matches Internal scope exactly', () => {
		const result = filterByScope(calls, 'Internal');
		expect(result).toHaveLength(1);
		expect(result[0].metaData.id).toBe('2');
	});

	it('excludes calls with null/missing scope', () => {
		const result = filterByScope(calls, 'External');
		expect(result.every((c) => c.metaData.id !== '4')).toBe(true);
	});
});

describe('filterByMinDuration', () => {
	const calls: CallDetails[] = [
		{ metaData: { id: '1', title: 'Short', duration: 120 } },
		{ metaData: { id: '2', title: 'Medium', duration: 600 } },
		{ metaData: { id: '3', title: 'Long', duration: 3600 } },
		{ metaData: { id: '4', title: 'No duration' } },
	];

	it('includes calls meeting or exceeding the minimum', () => {
		const result = filterByMinDuration(calls, 600);
		expect(result).toHaveLength(2);
		expect(result.map((c) => c.metaData.id).sort()).toEqual(['2', '3']);
	});

	it('excludes shorter calls', () => {
		const result = filterByMinDuration(calls, 600);
		expect(result.every((c) => c.metaData.id !== '1')).toBe(true);
	});

	it('excludes calls with null/missing duration', () => {
		const result = filterByMinDuration(calls, 0);
		expect(result.every((c) => c.metaData.id !== '4')).toBe(true);
	});

	it('handles zero minimum', () => {
		const result = filterByMinDuration(calls, 0);
		expect(result).toHaveLength(3);
	});
});
