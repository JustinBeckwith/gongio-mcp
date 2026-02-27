import { describe, expect, it } from 'vitest';
import {
	formatCallDetailsResponse,
	formatCallSummary,
	formatCallsResponse,
	formatCallTranscript,
	formatLibraryFolderCallsResponse,
	formatLibraryFoldersResponse,
	formatSingleCall,
	formatSingleUser,
	formatTrackersResponse,
	formatUsersResponse,
	formatWorkspacesResponse,
} from '../src/formatters.js';
import type {
	CallDetails,
	CallDetailsResponse,
	CallsResponse,
	CallTranscript,
	LibraryFolderCallsResponse,
	LibraryFoldersResponse,
	SingleCallResponse,
	SingleUserResponse,
	TrackersSettingsResponse,
	UsersResponse,
	WorkspacesResponse,
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

describe('formatSingleCall', () => {
	it('formats call with full metadata', () => {
		const response: SingleCallResponse = {
			call: {
				id: '123',
				title: 'Enterprise Demo',
				started: '2024-01-15T10:00:00Z',
				duration: 1800,
				direction: 'Outbound',
				scope: 'External',
				system: 'Zoom',
				media: 'Video',
				language: 'eng',
				url: 'https://gong.io/call/123',
				primaryUserId: '999',
				workspaceId: '888',
			},
		};

		const result = formatSingleCall(response);
		expect(result).toContain('## Enterprise Demo');
		expect(result).toContain('**ID:** 123');
		expect(result).toContain('**Direction:** Outbound');
		expect(result).toContain('**Scope:** External');
		expect(result).toContain('**System:** Zoom');
		expect(result).toContain('**Media:** Video');
		expect(result).toContain('**URL:** https://gong.io/call/123');
		expect(result).toContain('**Host User ID:** 999');
		expect(result).toContain('**Workspace ID:** 888');
	});

	it('shows Untitled Call when title is missing', () => {
		const response: SingleCallResponse = {
			call: { id: '456' },
		};

		const result = formatSingleCall(response);
		expect(result).toContain('## Untitled Call');
		expect(result).toContain('**ID:** 456');
	});

	it('shows private flag', () => {
		const response: SingleCallResponse = {
			call: { id: '789', isPrivate: true },
		};

		const result = formatSingleCall(response);
		expect(result).toContain('**Private:** Yes');
	});
});

describe('formatSingleUser', () => {
	it('formats user with full profile', () => {
		const response: SingleUserResponse = {
			user: {
				id: '111',
				firstName: 'John',
				lastName: 'Doe',
				emailAddress: 'john@example.com',
				title: 'Account Executive',
				phoneNumber: '+14155550100',
				active: true,
				managerId: '999',
				spokenLanguages: [
					{ language: 'eng', primary: true },
					{ language: 'spa', primary: false },
				],
			},
		};

		const result = formatSingleUser(response);
		expect(result).toContain('## John Doe');
		expect(result).toContain('**ID:** 111');
		expect(result).toContain('**Email:** john@example.com');
		expect(result).toContain('**Title:** Account Executive');
		expect(result).toContain('**Active:** Yes');
		expect(result).toContain('**Phone:** +14155550100');
		expect(result).toContain('**Manager ID:** 999');
		expect(result).toContain('eng (primary)');
		expect(result).toContain('spa');
	});

	it('shows Unknown when name is missing', () => {
		const response: SingleUserResponse = {
			user: { id: '222' },
		};

		const result = formatSingleUser(response);
		expect(result).toContain('## Unknown');
	});

	it('shows inactive status', () => {
		const response: SingleUserResponse = {
			user: { id: '333', firstName: 'Inactive', active: false },
		};

		const result = formatSingleUser(response);
		expect(result).toContain('**Active:** No');
	});
});

describe('formatTrackersResponse', () => {
	it('formats trackers as table', () => {
		const response: TrackersSettingsResponse = {
			keywordTrackers: [
				{
					trackerId: 't-1',
					trackerName: 'Competitor: ACME',
					affiliation: 'External',
					saidAt: 'Anywhere',
					languageKeywords: [
						{
							language: 'eng',
							keywords: ['acme', 'acme corp', 'acme co'],
						},
					],
				},
			],
		};

		const result = formatTrackersResponse(response);
		expect(result).toContain('**Keyword Trackers** (1 total)');
		expect(result).toContain('Competitor: ACME');
		expect(result).toContain('External');
		expect(result).toContain('acme');
	});

	it('handles empty trackers list', () => {
		const response: TrackersSettingsResponse = { keywordTrackers: [] };

		const result = formatTrackersResponse(response);
		expect(result).toContain('No trackers found.');
	});

	it('limits keywords to 5 per tracker', () => {
		const response: TrackersSettingsResponse = {
			keywordTrackers: [
				{
					trackerName: 'Pricing',
					languageKeywords: [
						{
							language: 'eng',
							keywords: [
								'price',
								'cost',
								'discount',
								'budget',
								'expensive',
								'cheap',
							],
						},
					],
				},
			],
		};

		const result = formatTrackersResponse(response);
		// Should show max 5 keywords
		expect(result).toContain('price');
		expect(result).not.toContain('cheap'); // 6th keyword should be omitted
	});
});

describe('formatWorkspacesResponse', () => {
	it('formats workspaces as table', () => {
		const response: WorkspacesResponse = {
			workspaces: [
				{ id: '111', name: 'North America', description: 'NA sales team' },
				{ id: '222', name: 'EMEA', description: 'Europe, Middle East, Africa' },
			],
		};

		const result = formatWorkspacesResponse(response);
		expect(result).toContain('**Workspaces** (2 total)');
		expect(result).toContain('| ID | Name | Description |');
		expect(result).toContain('| 111 | North America | NA sales team |');
		expect(result).toContain('| 222 | EMEA |');
	});

	it('handles empty workspaces list', () => {
		const response: WorkspacesResponse = { workspaces: [] };

		const result = formatWorkspacesResponse(response);
		expect(result).toContain('No workspaces found.');
	});

	it('handles null workspaces', () => {
		const response: WorkspacesResponse = {};

		const result = formatWorkspacesResponse(response);
		expect(result).toContain('No workspaces found.');
	});
});

describe('formatLibraryFoldersResponse', () => {
	it('formats folders as table with IDs and names', () => {
		const response: LibraryFoldersResponse = {
			folders: [
				{
					id: '111',
					name: 'Best Discovery Calls',
					parentFolderId: null,
					createdBy: 'user-1',
				},
				{
					id: '222',
					name: 'Onboarding Sub-Folder',
					parentFolderId: '111',
					createdBy: 'user-2',
				},
			],
		};

		const result = formatLibraryFoldersResponse(response);
		expect(result).toContain('**Library Folders** (2 total)');
		expect(result).toContain('| ID | Name | Parent Folder |');
		expect(result).toContain('| 111 | Best Discovery Calls | Root |');
		expect(result).toContain('| 222 | Onboarding Sub-Folder | 111 |');
	});

	it('shows Root when parentFolderId is null', () => {
		const response: LibraryFoldersResponse = {
			folders: [{ id: '333', name: 'Top Level', parentFolderId: null }],
		};

		const result = formatLibraryFoldersResponse(response);
		expect(result).toContain('Root');
	});

	it('handles empty folders list', () => {
		const response: LibraryFoldersResponse = { folders: [] };

		const result = formatLibraryFoldersResponse(response);
		expect(result).toContain('**Library Folders** (0 total)');
		expect(result).toContain('No library folders found.');
	});

	it('handles null folders', () => {
		const response: LibraryFoldersResponse = {};

		const result = formatLibraryFoldersResponse(response);
		expect(result).toContain('No library folders found.');
	});
});

describe('formatLibraryFolderCallsResponse', () => {
	it('formats calls table with all fields', () => {
		const response: LibraryFolderCallsResponse = {
			id: '555',
			name: 'Best Demos',
			calls: [
				{
					id: '999111',
					title: 'Closing the enterprise deal',
					addedBy: 'user-42',
					created: '2024-03-01T10:00:00Z',
					url: 'https://app.gong.io/call?id=999111',
					note: 'Great objection handling here',
					snippet: null,
				},
			],
		};

		const result = formatLibraryFolderCallsResponse(response);
		expect(result).toContain('## Library Folder: Best Demos');
		expect(result).toContain('**Folder ID:** 555');
		expect(result).toContain('**Calls:** 1');
		expect(result).toContain(
			'| Call ID | Title | Added By | Added On | Snippet | Note |',
		);
		expect(result).toContain('999111');
		expect(result).toContain('Closing the enterprise deal');
		expect(result).toContain('user-42');
		expect(result).toContain('Great objection handling here');
	});

	it('formats snippet timing as M:SS–M:SS', () => {
		const response: LibraryFolderCallsResponse = {
			id: '555',
			name: 'Clips',
			calls: [
				{
					id: '123',
					title: 'Clip call',
					snippet: { fromSec: 305, toSec: 540 },
				},
			],
		};

		const result = formatLibraryFolderCallsResponse(response);
		expect(result).toContain('5:05');
		expect(result).toContain('9:00');
	});

	it('shows dash for snippet when null', () => {
		const response: LibraryFolderCallsResponse = {
			id: '555',
			name: 'Full Calls',
			calls: [{ id: '123', title: 'Full call', snippet: null }],
		};

		const result = formatLibraryFolderCallsResponse(response);
		// The snippet column should show '-'
		expect(result).toMatch(/\| - \|/);
	});

	it('truncates long notes with ellipsis', () => {
		const longNote = 'A'.repeat(80);
		const response: LibraryFolderCallsResponse = {
			id: '555',
			name: 'Test',
			calls: [{ id: '123', title: 'Call', note: longNote }],
		};

		const result = formatLibraryFolderCallsResponse(response);
		expect(result).toContain('\u2026');
		expect(result).not.toContain(longNote);
	});

	it('handles empty calls list', () => {
		const response: LibraryFolderCallsResponse = {
			id: '555',
			name: 'Empty Folder',
			calls: [],
		};

		const result = formatLibraryFolderCallsResponse(response);
		expect(result).toContain('**Calls:** 0');
		expect(result).toContain('No calls in this folder.');
	});

	it('uses Unknown Folder when name is missing', () => {
		const response: LibraryFolderCallsResponse = { calls: [] };

		const result = formatLibraryFolderCallsResponse(response);
		expect(result).toContain('## Library Folder: Unknown Folder');
	});
});
