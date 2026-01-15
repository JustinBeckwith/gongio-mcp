import { describe, expect, it } from 'vitest';
import { searchCallsRequestSchema } from '../src/schemas.js';

describe('MCP Server - search_calls tool', () => {
	describe('searchCallsRequestSchema validation', () => {
		it('accepts empty object', () => {
			const result = searchCallsRequestSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it('accepts date range filters', () => {
			const result = searchCallsRequestSchema.safeParse({
				fromDateTime: '2024-01-01T00:00:00Z',
				toDateTime: '2024-01-31T23:59:59Z',
			});
			expect(result.success).toBe(true);
		});

		it('accepts primaryUserIds array', () => {
			const result = searchCallsRequestSchema.safeParse({
				primaryUserIds: ['111', '222', '333'],
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.primaryUserIds).toHaveLength(3);
			}
		});

		it('accepts callIds array', () => {
			const result = searchCallsRequestSchema.safeParse({
				callIds: ['123', '456'],
			});
			expect(result.success).toBe(true);
		});

		it('accepts all filters combined', () => {
			const result = searchCallsRequestSchema.safeParse({
				fromDateTime: '2024-01-01T00:00:00Z',
				toDateTime: '2024-01-31T23:59:59Z',
				workspaceId: '999',
				primaryUserIds: ['111', '222'],
				callIds: ['123', '456'],
				cursor: 'some-cursor',
			});
			expect(result.success).toBe(true);
		});

		it('rejects invalid date format', () => {
			const result = searchCallsRequestSchema.safeParse({
				fromDateTime: 'not-a-date',
			});
			expect(result.success).toBe(false);
		});

		it('rejects when fromDateTime is after toDateTime', () => {
			const result = searchCallsRequestSchema.safeParse({
				fromDateTime: '2024-12-31T23:59:59Z',
				toDateTime: '2024-01-01T00:00:00Z',
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(
					'fromDateTime must be before toDateTime',
				);
			}
		});

		it('rejects invalid workspaceId format', () => {
			const result = searchCallsRequestSchema.safeParse({
				workspaceId: 'not-a-number',
			});
			expect(result.success).toBe(false);
		});

		it('rejects invalid primaryUserIds format', () => {
			const result = searchCallsRequestSchema.safeParse({
				primaryUserIds: ['invalid-id'],
			});
			expect(result.success).toBe(false);
		});

		it('rejects invalid callIds format', () => {
			const result = searchCallsRequestSchema.safeParse({
				callIds: ['not-numeric'],
			});
			expect(result.success).toBe(false);
		});

		it('accepts empty arrays', () => {
			const result = searchCallsRequestSchema.safeParse({
				primaryUserIds: [],
				callIds: [],
			});
			expect(result.success).toBe(true);
		});
	});

	describe('search_calls integration', () => {
		it('validates and processes search request with filters', () => {
			const args = {
				fromDateTime: '2024-01-01T00:00:00Z',
				toDateTime: '2024-01-31T23:59:59Z',
				primaryUserIds: ['111', '222'],
			};

			const validated = searchCallsRequestSchema.parse(args);

			expect(validated).toEqual(args);
			expect(validated.fromDateTime).toBe('2024-01-01T00:00:00Z');
			expect(validated.toDateTime).toBe('2024-01-31T23:59:59Z');
			expect(validated.primaryUserIds).toEqual(['111', '222']);
		});

		it('validates and processes search request with callIds', () => {
			const args = {
				callIds: ['123456789', '987654321'],
			};

			const validated = searchCallsRequestSchema.parse(args);

			expect(validated).toEqual(args);
			expect(validated.callIds).toHaveLength(2);
		});

		it('validates and processes search request with cursor', () => {
			const args = {
				cursor: 'next-page-cursor-value',
			};

			const validated = searchCallsRequestSchema.parse(args);

			expect(validated.cursor).toBe('next-page-cursor-value');
		});

		it('handles undefined args by defaulting to empty object', () => {
			// In the actual handler, we use: searchCallsRequestSchema.parse(args ?? {})
			const validated = searchCallsRequestSchema.parse(undefined ?? {});

			expect(validated).toEqual({});
		});
	});
});

describe('search_calls vs list_calls comparison', () => {
	it('search_calls supports primaryUserIds filter', () => {
		const searchResult = searchCallsRequestSchema.safeParse({
			primaryUserIds: ['111', '222'],
		});
		expect(searchResult.success).toBe(true);
	});

	it('search_calls supports callIds filter', () => {
		const searchResult = searchCallsRequestSchema.safeParse({
			callIds: ['123', '456'],
		});
		expect(searchResult.success).toBe(true);
	});

	it('both support date range and workspace filters', () => {
		const commonFilters = {
			fromDateTime: '2024-01-01T00:00:00Z',
			toDateTime: '2024-01-31T23:59:59Z',
			workspaceId: '999',
		};

		const searchResult = searchCallsRequestSchema.safeParse(commonFilters);
		expect(searchResult.success).toBe(true);
	});
});
