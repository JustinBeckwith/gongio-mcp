import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GongClient } from '../src/gong.js';

/**
 * Helpers for building the mocked /v2/calls/extensive response.
 */
function makeCall(opts: {
	id: string;
	title?: string;
	started?: string;
	parties?: Array<{
		emailAddress?: string;
		affiliation?: string;
		name?: string;
		speakerId?: string;
	}>;
	context?: Array<{
		objects?: Array<{
			objectType: string;
			objectId?: string;
			fields?: Array<{ name: string; value: unknown }>;
		}>;
	}>;
}) {
	return {
		metaData: {
			id: opts.id,
			title: opts.title ?? `Call ${opts.id}`,
			started: opts.started ?? '2024-03-15T15:00:00Z',
			duration: 1800,
			scope: 'External',
		},
		parties: opts.parties ?? null,
		context: opts.context ?? null,
	};
}

function makeExtensiveResponse(
	calls: ReturnType<typeof makeCall>[],
	cursor?: string,
) {
	return {
		requestId: 'test-req',
		records: {
			totalRecords: calls.length,
			currentPageSize: calls.length,
			currentPageNumber: 1,
			...(cursor ? { cursor } : {}),
		},
		calls,
	};
}

describe('GongClient — search_calls_by_account', () => {
	let client: GongClient;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		global.fetch = fetchMock;
		client = new GongClient({
			accessKey: 'k',
			accessKeySecret: 's',
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('matches calls where any external party email is at the target domain', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						parties: [
							{ emailAddress: 'rep@gong.io', affiliation: 'Internal' },
						],
					}),
					makeCall({
						id: '2',
						parties: [
							{ emailAddress: 'rep@gong.io', affiliation: 'Internal' },
							{ emailAddress: 'buyer@acme.com', affiliation: 'External' },
						],
					}),
					makeCall({
						id: '3',
						parties: [
							{ emailAddress: 'noone@other.com', affiliation: 'External' },
						],
					}),
				]),
		});

		const result = await client.searchCallsByAccount({
			domains: ['acme.com'],
		});

		expect(result.matched).toBe(1);
		expect(result.calls[0]?.metaData.id).toBe('2');
		expect(result.totalScanned).toBe(3);
		expect(result.limitedByMaxCalls).toBe(false);
	});

	it('does not match internal participants at the target domain', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						parties: [
							{ emailAddress: 'rep@acme.com', affiliation: 'Internal' },
							{ emailAddress: 'buyer@other.com', affiliation: 'External' },
						],
					}),
				]),
		});

		const result = await client.searchCallsByAccount({
			domains: ['acme.com'],
		});

		expect(result.matched).toBe(0);
	});

	it('matches case-insensitively and handles multiple domains', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						parties: [
							{ emailAddress: 'BUYER@ACME.COM', affiliation: 'External' },
						],
					}),
					makeCall({
						id: '2',
						parties: [
							{ emailAddress: 'lead@acme.io', affiliation: 'External' },
						],
					}),
					makeCall({
						id: '3',
						parties: [
							{ emailAddress: 'noone@beta.com', affiliation: 'External' },
						],
					}),
				]),
		});

		const result = await client.searchCallsByAccount({
			domains: ['acme.com', 'acme.io'],
		});

		expect(result.matched).toBe(2);
		const ids = result.calls.map((c) => c.metaData.id).sort();
		expect(ids).toEqual(['1', '2']);
	});

	it('does not match a domain that is a substring of another (no false positives)', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					// "macme.com" should NOT match "acme.com"
					makeCall({
						id: '1',
						parties: [
							{ emailAddress: 'rep@macme.com', affiliation: 'External' },
						],
					}),
				]),
		});

		const result = await client.searchCallsByAccount({
			domains: ['acme.com'],
		});

		expect(result.matched).toBe(0);
	});

	it('only consults CRM Account context when matchCrmAccount=true', async () => {
		const callWithCrm = makeCall({
			id: '1',
			parties: [{ emailAddress: 'rep@vendor.com' }],
			context: [
				{
					objects: [
						{
							objectType: 'Account',
							fields: [{ name: 'Name', value: 'Acme Industries' }],
						},
					],
				},
			],
		});

		// First call: matchCrmAccount=false → no match
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => makeExtensiveResponse([callWithCrm]),
		});
		const off = await client.searchCallsByAccount({
			domains: ['acme.com'],
		});
		expect(off.matched).toBe(0);

		// Second call: matchCrmAccount=true → matches via "Acme Industries" name
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => makeExtensiveResponse([callWithCrm]),
		});
		const on = await client.searchCallsByAccount({
			domains: ['acme.com'],
			matchCrmAccount: true,
		});
		expect(on.matched).toBe(1);
	});

	it('auto-paginates until maxCalls is reached', async () => {
		const page1 = makeExtensiveResponse(
			Array.from({ length: 3 }, (_, i) =>
				makeCall({
					id: `${i + 1}`,
					parties: [
						{ emailAddress: `b${i}@acme.com`, affiliation: 'External' },
					],
				}),
			),
			'cursor-2',
		);
		const page2 = makeExtensiveResponse(
			Array.from({ length: 3 }, (_, i) =>
				makeCall({
					id: `${i + 4}`,
					parties: [
						{
							emailAddress: `b${i + 3}@acme.com`,
							affiliation: 'External',
						},
					],
				}),
			),
		);

		fetchMock
			.mockResolvedValueOnce({ ok: true, json: async () => page1 })
			.mockResolvedValueOnce({ ok: true, json: async () => page2 });

		const result = await client.searchCallsByAccount({
			domains: ['acme.com'],
			maxCalls: 10,
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.matched).toBe(6);
		expect(result.limitedByMaxCalls).toBe(false);
	});

	it('flags limitedByMaxCalls when cap is hit', async () => {
		const page = makeExtensiveResponse(
			Array.from({ length: 3 }, (_, i) =>
				makeCall({
					id: `${i + 1}`,
					parties: [
						{ emailAddress: `b${i}@acme.com`, affiliation: 'External' },
					],
				}),
			),
			'cursor-2',
		);
		fetchMock.mockResolvedValueOnce({ ok: true, json: async () => page });

		const result = await client.searchCallsByAccount({
			domains: ['acme.com'],
			maxCalls: 2,
		});

		expect(result.limitedByMaxCalls).toBe(true);
		expect(result.calls).toHaveLength(2);
	});
});

describe('GongClient — search_calls_by_opportunity', () => {
	let client: GongClient;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		global.fetch = fetchMock;
		client = new GongClient({ accessKey: 'k', accessKeySecret: 's' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('matches by opportunityId in CRM context', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						context: [
							{
								objects: [
									{ objectType: 'Account', objectId: 'A1' },
									{ objectType: 'Opportunity', objectId: 'OPP-100' },
								],
							},
						],
					}),
					makeCall({
						id: '2',
						context: [
							{
								objects: [
									{ objectType: 'Opportunity', objectId: 'OPP-999' },
								],
							},
						],
					}),
				]),
		});

		const result = await client.searchCallsByOpportunity({
			opportunityIds: ['OPP-100'],
		});
		expect(result.matched).toBe(1);
		expect(result.calls[0]?.metaData.id).toBe('1');
	});

	it('matches by opportunityName substring (case-insensitive)', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						context: [
							{
								objects: [
									{
										objectType: 'Opportunity',
										fields: [{ name: 'Name', value: 'Acme Q4 Renewal' }],
									},
								],
							},
						],
					}),
					makeCall({
						id: '2',
						context: [
							{
								objects: [
									{
										objectType: 'Opportunity',
										fields: [{ name: 'Name', value: 'Beta Expansion' }],
									},
								],
							},
						],
					}),
				]),
		});

		const result = await client.searchCallsByOpportunity({
			opportunityNames: ['acme'],
		});
		expect(result.matched).toBe(1);
		expect(result.calls[0]?.metaData.id).toBe('1');
	});

	it('ignores non-string CRM fields while matching opportunity names', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						context: [
							{
								objects: [
									{
										objectType: 'Opportunity',
										fields: [
											{ name: 'Name', value: 'Acme Q4 Renewal' },
											{ name: 'Amount', value: 250000 },
											{ name: 'Probability', value: 0.8 },
										],
									},
								],
							},
						],
					}),
					makeCall({
						id: '2',
						context: [
							{
								objects: [
									{
										objectType: 'Opportunity',
										fields: [
											{ name: 'Name', value: 12345 },
											{ name: 'Amount', value: 50000 },
										],
									},
								],
							},
						],
					}),
				]),
		});

		const result = await client.searchCallsByOpportunity({
			opportunityNames: ['acme'],
		});
		expect(result.matched).toBe(1);
		expect(result.calls[0]?.metaData.id).toBe('1');
	});

	it('does not match Account context objects (only Opportunity)', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						context: [
							{
								objects: [
									{
										objectType: 'Account',
										fields: [{ name: 'Name', value: 'Acme Inc.' }],
									},
								],
							},
						],
					}),
				]),
		});

		const result = await client.searchCallsByOpportunity({
			opportunityNames: ['acme'],
		});
		expect(result.matched).toBe(0);
	});
});

describe('GongClient — search_transcripts', () => {
	let client: GongClient;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		global.fetch = fetchMock;
		client = new GongClient({ accessKey: 'k', accessKeySecret: 's' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function transcriptsResponse(
		entries: Array<{
			callId: string;
			speakerId: string;
			sentences: Array<{ start: number; end: number; text: string }>;
		}>,
	) {
		// group by callId
		const byCall = new Map<
			string,
			Array<{
				speakerId: string;
				sentences: Array<{ start: number; end: number; text: string }>;
			}>
		>();
		for (const e of entries) {
			const arr = byCall.get(e.callId) ?? [];
			arr.push({ speakerId: e.speakerId, sentences: e.sentences });
			byCall.set(e.callId, arr);
		}
		return {
			requestId: 't',
			records: {
				totalRecords: byCall.size,
				currentPageSize: byCall.size,
				currentPageNumber: 1,
			},
			callTranscripts: Array.from(byCall.entries()).map(
				([callId, transcript]) => ({ callId, transcript }),
			),
		};
	}

	it('finds whole-word case-insensitive matches by default', async () => {
		// Phase 1: extensive
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						parties: [
							{
								speakerId: 'spk-a',
								name: 'Rep A',
								affiliation: 'Internal',
							},
							{
								speakerId: 'spk-b',
								name: 'Buyer B',
								affiliation: 'External',
							},
						],
					}),
				]),
		});
		// Phase 2: transcript
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				transcriptsResponse([
					{
						callId: '1',
						speakerId: 'spk-b',
						sentences: [
							{
								start: 1000,
								end: 5000,
								text: "We're evaluating Braze right now.",
							},
							{ start: 5500, end: 7000, text: 'It looks promising.' },
						],
					},
					{
						callId: '1',
						speakerId: 'spk-a',
						sentences: [
							{
								start: 8000,
								end: 12000,
								text: "Embraced by enterprise customers", // contains "raced" but not whole word "braze"
							},
						],
					},
				]),
		});

		const result = await client.searchTranscripts({
			keywords: ['braze'],
			fromDateTime: '2024-03-01T00:00:00Z',
			toDateTime: '2024-03-15T00:00:00Z',
			wholeWord: true,
			caseSensitive: false,
		});

		expect(result.callsScanned).toBe(1);
		expect(result.callsWithMatches).toBe(1);
		expect(result.totalMatches).toBe(1);
		const match = result.results[0]?.matches[0];
		expect(match?.keyword).toBe('braze');
		expect(match?.speakerName).toBe('Buyer B');
		expect(match?.speakerAffiliation).toBe('External');
	});

	it('respects wholeWord=false (substring match)', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						parties: [{ speakerId: 'spk-a', name: 'Rep' }],
					}),
				]),
		});
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				transcriptsResponse([
					{
						callId: '1',
						speakerId: 'spk-a',
						sentences: [
							{
								start: 1000,
								end: 5000,
								text: 'embraced by enterprise customers',
							},
						],
					},
				]),
		});

		const result = await client.searchTranscripts({
			keywords: ['brace'],
			fromDateTime: '2024-03-01T00:00:00Z',
			toDateTime: '2024-03-15T00:00:00Z',
			wholeWord: false,
		});

		expect(result.totalMatches).toBe(1);
	});

	it('narrows by domain before scanning transcripts', async () => {
		// Phase 1 returns 2 calls; only one has a party at acme.com
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						parties: [
							{
								speakerId: 'spk',
								emailAddress: 'b@acme.com',
								affiliation: 'External',
							},
						],
					}),
					makeCall({
						id: '2',
						parties: [
							{
								speakerId: 'spk',
								emailAddress: 'b@beta.com',
								affiliation: 'External',
							},
						],
					}),
				]),
		});
		// Phase 2 should only be called for callId 1
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				transcriptsResponse([
					{
						callId: '1',
						speakerId: 'spk',
						sentences: [
							{ start: 0, end: 1000, text: 'Klaviyo is our current ESP.' },
						],
					},
				]),
		});

		const result = await client.searchTranscripts({
			keywords: ['klaviyo'],
			fromDateTime: '2024-03-01T00:00:00Z',
			toDateTime: '2024-03-15T00:00:00Z',
			domains: ['acme.com'],
		});

		expect(result.callsScanned).toBe(1);
		expect(result.callsWithMatches).toBe(1);

		// Verify the transcript request only contained callId 1
		const transcriptCall = fetchMock.mock.calls[1];
		const body = JSON.parse(transcriptCall?.[1].body);
		expect(body.filter.callIds).toEqual(['1']);
	});

	it('does not use internal participants for transcript domain narrowing', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						parties: [
							{
								speakerId: 'rep',
								emailAddress: 'rep@acme.com',
								affiliation: 'Internal',
							},
							{
								speakerId: 'buyer',
								emailAddress: 'buyer@other.com',
								affiliation: 'External',
							},
						],
					}),
				]),
		});

		const result = await client.searchTranscripts({
			keywords: ['klaviyo'],
			fromDateTime: '2024-03-01T00:00:00Z',
			toDateTime: '2024-03-15T00:00:00Z',
			domains: ['acme.com'],
		});

		expect(result.callsScanned).toBe(0);
		expect(result.totalMatches).toBe(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('truncates matches at maxMatchesPerCall', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				makeExtensiveResponse([
					makeCall({
						id: '1',
						parties: [{ speakerId: 'spk', name: 'Rep' }],
					}),
				]),
		});
		const sentences = Array.from({ length: 10 }, (_, i) => ({
			start: i * 1000,
			end: (i + 1) * 1000,
			text: `klaviyo mention ${i}`,
		}));
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () =>
				transcriptsResponse([{ callId: '1', speakerId: 'spk', sentences }]),
		});

		const result = await client.searchTranscripts({
			keywords: ['klaviyo'],
			fromDateTime: '2024-03-01T00:00:00Z',
			toDateTime: '2024-03-15T00:00:00Z',
			maxMatchesPerCall: 3,
		});

		expect(result.totalMatches).toBe(3);
		expect(result.results[0]?.truncated).toBe(true);
	});

	it('returns zero results when phase 1 narrows everything out', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => makeExtensiveResponse([]),
		});

		const result = await client.searchTranscripts({
			keywords: ['anything'],
			fromDateTime: '2024-03-01T00:00:00Z',
			toDateTime: '2024-03-15T00:00:00Z',
		});

		expect(result.callsScanned).toBe(0);
		expect(result.totalMatches).toBe(0);
		// Should not have called the transcripts endpoint
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
