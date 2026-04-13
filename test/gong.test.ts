import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GongClient, buildContentSelector } from '../src/gong.js';
import type {
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
