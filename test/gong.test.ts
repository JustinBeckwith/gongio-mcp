import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GongClient } from '../src/gong.js';
import type { CallDetailsResponse } from '../src/schemas.js';

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

		it('omits contentSelector for minimal response', async () => {
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
			expect(callBody.contentSelector).toBeUndefined();
			expect(callBody.filter).toBeDefined();
		});
	});
});
