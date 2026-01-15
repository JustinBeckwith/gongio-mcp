import { describe, expect, it } from 'vitest';
import {
	formatCallDetailsResponse,
	formatCallSummary,
	formatCallsResponse,
	formatCallTranscript,
	formatUsersResponse,
} from '../src/formatters.js';
import type {
	CallDetails,
	CallDetailsResponse,
	CallsResponse,
	CallTranscript,
	UsersResponse,
} from '../src/schemas.js';

describe('formatCallsResponse', () => {
	it('formats empty calls list', () => {
		const response: CallsResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 0,
				currentPageSize: 0,
				currentPageNumber: 1,
			},
			calls: [],
		};

		const result = formatCallsResponse(response);
		expect(result).toContain('**Calls** (0 total)');
		expect(result).toContain('No calls found.');
	});

	it('formats calls as markdown table', () => {
		const response: CallsResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 2,
				currentPageSize: 2,
				currentPageNumber: 1,
			},
			calls: [
				{
					id: '123',
					title: 'Sales Call',
					started: '2024-01-15T10:00:00Z',
					duration: 1800,
					scope: 'External',
				},
				{
					id: '456',
					title: 'Demo Call',
					started: '2024-01-16T14:00:00Z',
					duration: 3600,
					scope: 'External',
				},
			],
		};

		const result = formatCallsResponse(response);
		expect(result).toContain('**Calls** (2 total)');
		expect(result).toContain('| ID | Title | Date | Duration | Scope |');
		expect(result).toContain('| 123 | Sales Call |');
		expect(result).toContain('| 456 | Demo Call |');
		expect(result).toContain('30m'); // 1800 seconds = 30 minutes
		expect(result).toContain('60m'); // 3600 seconds = 60 minutes
	});

	it('includes cursor when available', () => {
		const response: CallsResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 100,
				currentPageSize: 10,
				currentPageNumber: 1,
				cursor: 'next-page-cursor',
			},
			calls: [{ id: '123' }],
		};

		const result = formatCallsResponse(response);
		expect(result).toContain('`next-page-cursor`');
	});

	it('escapes pipe characters in titles', () => {
		const response: CallsResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 1,
				currentPageSize: 1,
				currentPageNumber: 1,
			},
			calls: [
				{
					id: '123',
					title: 'Call | With | Pipes',
				},
			],
		};

		const result = formatCallsResponse(response);
		expect(result).toContain('Call \\| With \\| Pipes');
	});
});

describe('formatCallDetailsResponse', () => {
	it('formats empty calls list', () => {
		const response: CallDetailsResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 0,
				currentPageSize: 0,
				currentPageNumber: 1,
			},
			calls: [],
		};

		const result = formatCallDetailsResponse(response);
		expect(result).toContain('**Calls** (0 total)');
		expect(result).toContain('No calls found.');
	});

	it('formats calls as markdown table from CallDetailsResponse', () => {
		const response: CallDetailsResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 2,
				currentPageSize: 2,
				currentPageNumber: 1,
			},
			calls: [
				{
					metaData: {
						id: '123',
						title: 'Sales Call',
						started: '2024-01-15T10:00:00Z',
						duration: 1800,
						scope: 'External',
					},
				},
				{
					metaData: {
						id: '456',
						title: 'Demo Call',
						started: '2024-01-16T14:00:00Z',
						duration: 3600,
						scope: 'Internal',
					},
				},
			],
		};

		const result = formatCallDetailsResponse(response);
		expect(result).toContain('**Calls** (2 total)');
		expect(result).toContain('| ID | Title | Date | Duration | Scope |');
		expect(result).toContain('| 123 | Sales Call |');
		expect(result).toContain('| 456 | Demo Call |');
		expect(result).toContain('30m'); // 1800 seconds = 30 minutes
		expect(result).toContain('60m'); // 3600 seconds = 60 minutes
		expect(result).toContain('External');
		expect(result).toContain('Internal');
	});

	it('includes cursor when available', () => {
		const response: CallDetailsResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 100,
				currentPageSize: 10,
				currentPageNumber: 1,
				cursor: 'next-page-cursor',
			},
			calls: [{ metaData: { id: '123' } }],
		};

		const result = formatCallDetailsResponse(response);
		expect(result).toContain('`next-page-cursor`');
	});

	it('escapes pipe characters in titles', () => {
		const response: CallDetailsResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 1,
				currentPageSize: 1,
				currentPageNumber: 1,
			},
			calls: [
				{
					metaData: {
						id: '123',
						title: 'Call | With | Pipes',
					},
				},
			],
		};

		const result = formatCallDetailsResponse(response);
		expect(result).toContain('Call \\| With \\| Pipes');
	});

	it('handles missing optional metadata fields', () => {
		const response: CallDetailsResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 1,
				currentPageSize: 1,
				currentPageNumber: 1,
			},
			calls: [
				{
					metaData: {
						id: '999',
					},
				},
			],
		};

		const result = formatCallDetailsResponse(response);
		expect(result).toContain('| 999 |');
		expect(result).toContain('| - |'); // Missing fields show as '-'
	});
});

describe('formatUsersResponse', () => {
	it('formats empty users list', () => {
		const response: UsersResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 0,
				currentPageSize: 0,
				currentPageNumber: 1,
			},
			users: [],
		};

		const result = formatUsersResponse(response);
		expect(result).toContain('**Users** (0 total)');
		expect(result).toContain('No users found.');
	});

	it('formats users as markdown table', () => {
		const response: UsersResponse = {
			requestId: 'test-123',
			records: {
				totalRecords: 2,
				currentPageSize: 2,
				currentPageNumber: 1,
			},
			users: [
				{
					id: '111',
					firstName: 'John',
					lastName: 'Doe',
					emailAddress: 'john@example.com',
					title: 'Sales Rep',
					active: true,
				},
				{
					id: '222',
					firstName: 'Jane',
					lastName: 'Smith',
					emailAddress: 'jane@example.com',
					title: 'Account Executive',
					active: false,
				},
			],
		};

		const result = formatUsersResponse(response);
		expect(result).toContain('**Users** (2 total)');
		expect(result).toContain('| ID | Name | Email | Title | Active |');
		expect(result).toContain(
			'| 111 | John Doe | john@example.com | Sales Rep | Yes |',
		);
		expect(result).toContain(
			'| 222 | Jane Smith | jane@example.com | Account Executive | No |',
		);
	});
});

describe('formatCallSummary', () => {
	it('formats call summary with basic metadata', () => {
		const call: CallDetails = {
			metaData: {
				id: '123',
				title: 'Important Sales Call',
				started: '2024-01-15T10:00:00Z',
				duration: 1800,
				scope: 'External',
				url: 'https://gong.io/call/123',
			},
		};

		const result = formatCallSummary(call);
		expect(result).toContain('## Important Sales Call');
		expect(result).toContain('**ID:** 123');
		expect(result).toContain('**Duration:** 30m');
		expect(result).toContain('**Scope:** External');
		expect(result).toContain('**URL:** https://gong.io/call/123');
	});

	it('formats call summary with participants', () => {
		const call: CallDetails = {
			metaData: {
				id: '123',
				title: 'Team Call',
			},
			parties: [
				{ name: 'John Doe', affiliation: 'Internal' },
				{ name: 'Jane Customer', affiliation: 'External' },
			],
		};

		const result = formatCallSummary(call);
		expect(result).toContain('### Participants');
		expect(result).toContain('John Doe (Internal)');
		expect(result).toContain('Jane Customer (External)');
	});

	it('formats call summary with brief and key points', () => {
		const call: CallDetails = {
			metaData: {
				id: '123',
				title: 'Sales Call',
			},
			content: {
				brief: 'Productive discussion about enterprise features.',
				keyPoints: [
					{ text: 'Customer interested in enterprise plan' },
					{ text: 'Follow-up scheduled for next week' },
				],
			},
		};

		const result = formatCallSummary(call);
		expect(result).toContain('### Summary');
		expect(result).toContain(
			'Productive discussion about enterprise features.',
		);
		expect(result).toContain('### Key Points');
		expect(result).toContain('- Customer interested in enterprise plan');
		expect(result).toContain('- Follow-up scheduled for next week');
	});

	it('formats call summary with topics', () => {
		const call: CallDetails = {
			metaData: {
				id: '123',
				title: 'Demo Call',
			},
			content: {
				topics: [
					{ name: 'Pricing', duration: 600 },
					{ name: 'Features', duration: 900 },
				],
			},
		};

		const result = formatCallSummary(call);
		expect(result).toContain('### Topics');
		expect(result).toContain('Pricing (10m)');
		expect(result).toContain('Features (15m)');
	});
});

describe('formatCallTranscript', () => {
	it('formats transcript with speaker names from parties', () => {
		const transcript: CallTranscript = {
			callId: '123',
			transcript: [
				{
					speakerId: 'speaker-1',
					sentences: [
						{ start: 0, end: 5000, text: 'Hello, welcome to the call.' },
					],
				},
				{
					speakerId: 'speaker-2',
					sentences: [
						{ start: 5000, end: 10000, text: 'Thanks for having me.' },
					],
				},
			],
		};

		const parties = [
			{ speakerId: 'speaker-1', name: 'John Host' },
			{ speakerId: 'speaker-2', name: 'Jane Guest' },
		];

		const result = formatCallTranscript(transcript, parties);
		expect(result).toContain('## Transcript (Call 123)');
		expect(result).toContain('[John Host]: Hello, welcome to the call.');
		expect(result).toContain('[Jane Guest]: Thanks for having me.');
	});

	it('uses speaker ID when no party info available', () => {
		const transcript: CallTranscript = {
			callId: '456',
			transcript: [
				{
					speakerId: 'unknown-speaker',
					sentences: [{ start: 0, end: 3000, text: 'Some text here.' }],
				},
			],
		};

		const result = formatCallTranscript(transcript, null);
		expect(result).toContain('[Speaker unknown-speaker]: Some text here.');
	});

	it('handles empty transcript', () => {
		const transcript: CallTranscript = {
			callId: '789',
			transcript: [],
		};

		const result = formatCallTranscript(transcript, null);
		expect(result).toContain('## Transcript (Call 789)');
		expect(result).toContain('*No transcript available*');
	});

	it('joins multiple sentences in a monologue', () => {
		const transcript: CallTranscript = {
			callId: '123',
			transcript: [
				{
					speakerId: 'speaker-1',
					sentences: [
						{ start: 0, end: 2000, text: 'First sentence.' },
						{ start: 2000, end: 4000, text: 'Second sentence.' },
						{ start: 4000, end: 6000, text: 'Third sentence.' },
					],
				},
			],
		};

		const result = formatCallTranscript(transcript, null);
		expect(result).toContain(
			'First sentence. Second sentence. Third sentence.',
		);
	});

	it('truncates long transcripts with maxLength', () => {
		const longText = 'A'.repeat(500);
		const transcript: CallTranscript = {
			callId: '123',
			transcript: [
				{
					speakerId: 'speaker-1',
					sentences: [{ start: 0, end: 5000, text: longText }],
				},
				{
					speakerId: 'speaker-2',
					sentences: [{ start: 5000, end: 10000, text: longText }],
				},
			],
		};

		const result = formatCallTranscript(transcript, null, { maxLength: 100 });
		expect(result).toContain('*Showing characters 1-100');
		expect(result).toContain('*[...truncated...]*');
		expect(result).toContain('*To see more, use offset: 100*');
		// Result should be truncated
		expect(result.length).toBeLessThan(1500); // Much less than the full ~1000 char transcript
	});

	it('supports pagination with offset', () => {
		const longText = 'A'.repeat(200);
		const transcript: CallTranscript = {
			callId: '123',
			transcript: [
				{
					speakerId: 'speaker-1',
					sentences: [{ start: 0, end: 5000, text: longText }],
				},
			],
		};

		const result = formatCallTranscript(transcript, null, {
			maxLength: 100,
			offset: 50,
		});
		expect(result).toContain('*[...truncated start...]*');
		expect(result).toContain('*Showing characters 51-150');
	});

	it('does not show truncation messages for short transcripts', () => {
		const transcript: CallTranscript = {
			callId: '123',
			transcript: [
				{
					speakerId: 'speaker-1',
					sentences: [{ start: 0, end: 5000, text: 'Short text.' }],
				},
			],
		};

		const result = formatCallTranscript(transcript, null, { maxLength: 10000 });
		expect(result).not.toContain('truncated');
		expect(result).not.toContain('Showing characters');
	});
});
