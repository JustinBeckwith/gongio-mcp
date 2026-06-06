import { describe, expect, it } from 'vitest';
import {
	searchCallsByAccountRequestSchema,
	searchCallsByOpportunityRequestSchema,
	searchTranscriptsRequestSchema,
} from '../src/schemas.js';

describe('searchCallsByAccountRequestSchema', () => {
	it('accepts a single domain', () => {
		const result = searchCallsByAccountRequestSchema.safeParse({
			domains: ['acme.com'],
		});
		expect(result.success).toBe(true);
	});

	it('accepts multiple domains', () => {
		const result = searchCallsByAccountRequestSchema.safeParse({
			domains: ['acme.com', 'acme.io', 'sub.acme.com'],
		});
		expect(result.success).toBe(true);
	});

	it('requires at least one domain', () => {
		const result = searchCallsByAccountRequestSchema.safeParse({
			domains: [],
		});
		expect(result.success).toBe(false);
	});

	it('rejects domains with protocol', () => {
		const result = searchCallsByAccountRequestSchema.safeParse({
			domains: ['https://acme.com'],
		});
		expect(result.success).toBe(false);
	});

	it('rejects email-like input', () => {
		const result = searchCallsByAccountRequestSchema.safeParse({
			domains: ['user@acme.com'],
		});
		expect(result.success).toBe(false);
	});

	it('rejects bare hostnames without TLD', () => {
		const result = searchCallsByAccountRequestSchema.safeParse({
			domains: ['localhost'],
		});
		expect(result.success).toBe(false);
	});

	it('honors fromDateTime < toDateTime check', () => {
		const result = searchCallsByAccountRequestSchema.safeParse({
			domains: ['acme.com'],
			fromDateTime: '2024-12-31T23:59:59Z',
			toDateTime: '2024-01-01T00:00:00Z',
		});
		expect(result.success).toBe(false);
	});

	it('caps maxCalls at 5000', () => {
		const result = searchCallsByAccountRequestSchema.safeParse({
			domains: ['acme.com'],
			maxCalls: 9999,
		});
		expect(result.success).toBe(false);
	});

	it('accepts matchCrmAccount flag', () => {
		const result = searchCallsByAccountRequestSchema.safeParse({
			domains: ['acme.com'],
			matchCrmAccount: true,
		});
		expect(result.success).toBe(true);
	});
});

describe('searchCallsByOpportunityRequestSchema', () => {
	it('accepts opportunityIds only', () => {
		const result = searchCallsByOpportunityRequestSchema.safeParse({
			opportunityIds: ['006abc', '006def'],
		});
		expect(result.success).toBe(true);
	});

	it('accepts opportunityNames only', () => {
		const result = searchCallsByOpportunityRequestSchema.safeParse({
			opportunityNames: ['Acme Q4'],
		});
		expect(result.success).toBe(true);
	});

	it('accepts both', () => {
		const result = searchCallsByOpportunityRequestSchema.safeParse({
			opportunityIds: ['006abc'],
			opportunityNames: ['Acme'],
		});
		expect(result.success).toBe(true);
	});

	it('rejects when neither is provided', () => {
		const result = searchCallsByOpportunityRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects empty arrays', () => {
		const result = searchCallsByOpportunityRequestSchema.safeParse({
			opportunityIds: [],
			opportunityNames: [],
		});
		expect(result.success).toBe(false);
	});
});

describe('searchTranscriptsRequestSchema', () => {
	const baseInput = {
		keywords: ['braze'],
		fromDateTime: '2024-03-01T00:00:00Z',
		toDateTime: '2024-03-15T00:00:00Z',
	};

	it('accepts a minimal valid request (<30 day window)', () => {
		const result = searchTranscriptsRequestSchema.safeParse(baseInput);
		expect(result.success).toBe(true);
	});

	it('requires keywords', () => {
		const result = searchTranscriptsRequestSchema.safeParse({
			...baseInput,
			keywords: [],
		});
		expect(result.success).toBe(false);
	});

	it('rejects 1-character keywords', () => {
		const result = searchTranscriptsRequestSchema.safeParse({
			...baseInput,
			keywords: ['a'],
		});
		expect(result.success).toBe(false);
	});

	it('requires fromDateTime', () => {
		const { fromDateTime: _, ...rest } = baseInput;
		const result = searchTranscriptsRequestSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('requires toDateTime', () => {
		const { toDateTime: _, ...rest } = baseInput;
		const result = searchTranscriptsRequestSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('rejects >30-day window with no narrowing filters', () => {
		const result = searchTranscriptsRequestSchema.safeParse({
			keywords: ['braze'],
			fromDateTime: '2024-01-01T00:00:00Z',
			toDateTime: '2024-06-01T00:00:00Z',
		});
		expect(result.success).toBe(false);
	});

	it('accepts >30-day window when primaryUserIds is provided', () => {
		const result = searchTranscriptsRequestSchema.safeParse({
			keywords: ['braze'],
			fromDateTime: '2024-01-01T00:00:00Z',
			toDateTime: '2024-06-01T00:00:00Z',
			primaryUserIds: ['111'],
		});
		expect(result.success).toBe(true);
	});

	it('accepts >30-day window when domains is provided', () => {
		const result = searchTranscriptsRequestSchema.safeParse({
			keywords: ['braze'],
			fromDateTime: '2024-01-01T00:00:00Z',
			toDateTime: '2024-06-01T00:00:00Z',
			domains: ['acme.com'],
		});
		expect(result.success).toBe(true);
	});

	it('rejects >30-day window with empty narrowing arrays', () => {
		const result = searchTranscriptsRequestSchema.safeParse({
			keywords: ['braze'],
			fromDateTime: '2024-01-01T00:00:00Z',
			toDateTime: '2024-06-01T00:00:00Z',
			primaryUserIds: [],
			domains: [],
		});
		expect(result.success).toBe(false);
	});

	it('defaults wholeWord to true and caseSensitive to false', () => {
		const result = searchTranscriptsRequestSchema.safeParse(baseInput);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.wholeWord).toBe(true);
			expect(result.data.caseSensitive).toBe(false);
		}
	});
});
