import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
	iso8601DateTimeSchema,
	gongIdSchema,
	listCallsRequestSchema,
	searchCallsRequestSchema,
	getCallSummaryRequestSchema,
	getCallTranscriptRequestSchema,
	listUsersRequestSchema,
	validateListCallsRequest,
	validateSearchCallsRequest,
	validateGetCallSummaryRequest,
	validateGetCallTranscriptRequest,
	validateListUsersRequest,
} from '../src/schemas.js';

describe('iso8601DateTimeSchema', () => {
	it('accepts valid ISO 8601 datetime with Z timezone', () => {
		const result = iso8601DateTimeSchema.safeParse('2024-01-01T00:00:00Z');
		expect(result.success).toBe(true);
	});

	it('accepts valid ISO 8601 datetime with offset timezone', () => {
		const result = iso8601DateTimeSchema.safeParse('2024-01-01T00:00:00-07:00');
		expect(result.success).toBe(true);
	});

	it('accepts valid ISO 8601 datetime with positive offset', () => {
		const result = iso8601DateTimeSchema.safeParse('2024-01-01T00:00:00+05:30');
		expect(result.success).toBe(true);
	});

	it('accepts valid ISO 8601 datetime with milliseconds', () => {
		const result = iso8601DateTimeSchema.safeParse(
			'2024-01-01T00:00:00.123Z',
		);
		expect(result.success).toBe(true);
	});

	it('rejects date-only format', () => {
		const result = iso8601DateTimeSchema.safeParse('2024-01-01');
		expect(result.success).toBe(false);
	});

	it('rejects datetime without timezone', () => {
		const result = iso8601DateTimeSchema.safeParse('2024-01-01T00:00:00');
		expect(result.success).toBe(false);
	});

	it('rejects invalid format', () => {
		const result = iso8601DateTimeSchema.safeParse('January 1, 2024');
		expect(result.success).toBe(false);
	});
});

describe('gongIdSchema', () => {
	it('accepts single digit ID', () => {
		const result = gongIdSchema.safeParse('1');
		expect(result.success).toBe(true);
	});

	it('accepts 20-digit ID (maximum)', () => {
		const result = gongIdSchema.safeParse('12345678901234567890');
		expect(result.success).toBe(true);
	});

	it('rejects 21-digit ID (too long)', () => {
		const result = gongIdSchema.safeParse('123456789012345678901');
		expect(result.success).toBe(false);
	});

	it('rejects non-numeric characters', () => {
		const result = gongIdSchema.safeParse('abc123');
		expect(result.success).toBe(false);
	});

	it('rejects empty string', () => {
		const result = gongIdSchema.safeParse('');
		expect(result.success).toBe(false);
	});

	it('rejects ID with spaces', () => {
		const result = gongIdSchema.safeParse('123 456');
		expect(result.success).toBe(false);
	});
});

describe('listCallsRequestSchema', () => {
	it('accepts empty object', () => {
		const result = listCallsRequestSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it('accepts valid date range', () => {
		const result = listCallsRequestSchema.safeParse({
			fromDateTime: '2024-01-01T00:00:00Z',
			toDateTime: '2024-01-31T23:59:59Z',
		});
		expect(result.success).toBe(true);
	});

	it('rejects when fromDateTime is after toDateTime', () => {
		const result = listCallsRequestSchema.safeParse({
			fromDateTime: '2024-01-31T00:00:00Z',
			toDateTime: '2024-01-01T00:00:00Z',
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				'fromDateTime must be before toDateTime',
			);
		}
	});

	it('accepts valid workspaceId', () => {
		const result = listCallsRequestSchema.safeParse({
			workspaceId: '12345',
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid workspaceId format', () => {
		const result = listCallsRequestSchema.safeParse({
			workspaceId: 'not-a-number',
		});
		expect(result.success).toBe(false);
	});
});

describe('searchCallsRequestSchema', () => {
	it('accepts empty object', () => {
		const result = searchCallsRequestSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it('accepts valid primaryUserIds array', () => {
		const result = searchCallsRequestSchema.safeParse({
			primaryUserIds: ['123', '456', '789'],
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid primaryUserIds format', () => {
		const result = searchCallsRequestSchema.safeParse({
			primaryUserIds: ['abc'],
		});
		expect(result.success).toBe(false);
	});

	it('accepts valid callIds array', () => {
		const result = searchCallsRequestSchema.safeParse({
			callIds: ['123456789'],
		});
		expect(result.success).toBe(true);
	});
});

describe('getCallSummaryRequestSchema', () => {
	it('accepts valid callId', () => {
		const result = getCallSummaryRequestSchema.safeParse({
			callId: '123456789',
		});
		expect(result.success).toBe(true);
	});

	it('rejects missing callId', () => {
		const result = getCallSummaryRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects invalid callId format', () => {
		const result = getCallSummaryRequestSchema.safeParse({
			callId: 'invalid-id',
		});
		expect(result.success).toBe(false);
	});
});

describe('getCallTranscriptRequestSchema', () => {
	it('accepts valid callId', () => {
		const result = getCallTranscriptRequestSchema.safeParse({
			callId: '123456789',
		});
		expect(result.success).toBe(true);
	});

	it('rejects missing callId', () => {
		const result = getCallTranscriptRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects invalid callId format', () => {
		const result = getCallTranscriptRequestSchema.safeParse({
			callId: 'not-valid',
		});
		expect(result.success).toBe(false);
	});
});

describe('listUsersRequestSchema', () => {
	it('accepts empty object', () => {
		const result = listUsersRequestSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it('accepts valid cursor', () => {
		const result = listUsersRequestSchema.safeParse({
			cursor: 'abc123',
		});
		expect(result.success).toBe(true);
	});

	it('accepts includeAvatars boolean', () => {
		const result = listUsersRequestSchema.safeParse({
			includeAvatars: true,
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty cursor', () => {
		const result = listUsersRequestSchema.safeParse({
			cursor: '',
		});
		expect(result.success).toBe(false);
	});
});

describe('validate helper functions', () => {
	it('validateListCallsRequest returns validated object', () => {
		const result = validateListCallsRequest({
			fromDateTime: '2024-01-01T00:00:00Z',
		});
		expect(result.fromDateTime).toBe('2024-01-01T00:00:00Z');
	});

	it('validateListCallsRequest handles undefined', () => {
		const result = validateListCallsRequest(undefined);
		expect(result).toEqual({});
	});

	it('validateSearchCallsRequest throws on invalid input', () => {
		expect(() =>
			validateSearchCallsRequest({
				fromDateTime: 'invalid-date',
			}),
		).toThrow(ZodError);
	});

	it('validateGetCallSummaryRequest validates callId', () => {
		const result = validateGetCallSummaryRequest({
			callId: '123',
		});
		expect(result.callId).toBe('123');
	});

	it('validateGetCallSummaryRequest throws on missing callId', () => {
		expect(() =>
			validateGetCallSummaryRequest({}),
		).toThrow(ZodError);
	});

	it('validateGetCallTranscriptRequest validates callId', () => {
		const result = validateGetCallTranscriptRequest({
			callId: '456',
		});
		expect(result.callId).toBe('456');
	});

	it('validateListUsersRequest handles options', () => {
		const result = validateListUsersRequest({
			includeAvatars: true,
		});
		expect(result.includeAvatars).toBe(true);
	});
});
