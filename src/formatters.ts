/**
 * Formatters to convert API responses to markdown tables
 * Reduces token usage compared to JSON output
 */

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
} from './schemas.js';

// Party type for speaker name resolution
interface Party {
	id?: string | null;
	name?: string | null;
	emailAddress?: string | null;
	speakerId?: string | null;
	affiliation?: string | null;
}

/**
 * Format calls list as markdown table
 */
export function formatCallsResponse(response: CallsResponse): string {
	const lines: string[] = [];

	lines.push(`**Calls** (${response.records.totalRecords} total)\n`);

	if (response.calls.length === 0) {
		lines.push('No calls found.');
		return lines.join('\n');
	}

	lines.push('| ID | Title | Date | Duration | Scope |');
	lines.push('|---|---|---|---|---|');

	for (const call of response.calls) {
		const date = call.started
			? new Date(call.started).toLocaleDateString()
			: '-';
		const duration = call.duration ? `${Math.round(call.duration / 60)}m` : '-';
		const title = call.title?.slice(0, 50) ?? '-';
		lines.push(
			`| ${call.id} | ${escapeMarkdown(title)} | ${date} | ${duration} | ${call.scope ?? '-'} |`,
		);
	}

	if (response.records.cursor) {
		lines.push(
			`\n*More results available. Cursor:* \`${response.records.cursor}\``,
		);
	}

	return lines.join('\n');
}

/**
 * Format call details response as markdown table (same format as formatCallsResponse)
 * Used for search_calls which returns CallDetailsResponse from /v2/calls/extensive
 */
export function formatCallDetailsResponse(
	response: CallDetailsResponse,
): string {
	const lines: string[] = [];

	lines.push(`**Calls** (${response.records.totalRecords} total)\n`);

	if (response.calls.length === 0) {
		lines.push('No calls found.');
		return lines.join('\n');
	}

	lines.push('| ID | Title | Date | Duration | Scope |');
	lines.push('|---|---|---|---|---|');

	for (const call of response.calls) {
		const meta = call.metaData;
		const date = meta.started
			? new Date(meta.started).toLocaleDateString()
			: '-';
		const duration = meta.duration ? `${Math.round(meta.duration / 60)}m` : '-';
		const title = meta.title?.slice(0, 50) ?? '-';
		lines.push(
			`| ${meta.id} | ${escapeMarkdown(title)} | ${date} | ${duration} | ${meta.scope ?? '-'} |`,
		);
	}

	if (response.records.cursor) {
		lines.push(
			`\n*More results available. Cursor:* \`${response.records.cursor}\``,
		);
	}

	return lines.join('\n');
}

/**
 * Format a single call summary (compact, key info only)
 */
export function formatCallSummary(call: CallDetails): string {
	const lines: string[] = [];
	const meta = call.metaData;

	lines.push(`## ${escapeMarkdown(meta.title ?? 'Untitled Call')}\n`);

	// Compact metadata
	const metaParts: string[] = [`**ID:** ${meta.id}`];
	if (meta.started) {
		metaParts.push(`**Date:** ${new Date(meta.started).toLocaleString()}`);
	}
	if (meta.duration) {
		metaParts.push(`**Duration:** ${Math.round(meta.duration / 60)}m`);
	}
	if (meta.scope) {
		metaParts.push(`**Scope:** ${meta.scope}`);
	}
	lines.push(metaParts.join(' | '));
	if (meta.url) {
		lines.push(`**URL:** ${meta.url}`);
	}

	// Participants (compact)
	if (call.parties && call.parties.length > 0) {
		lines.push('\n### Participants\n');
		const participants = call.parties.map((p) => {
			const name = p.name ?? p.emailAddress ?? 'Unknown';
			const role = p.affiliation ? ` (${p.affiliation})` : '';
			return `${escapeMarkdown(name)}${role}`;
		});
		lines.push(participants.join(', '));
	}

	// Brief summary (most important)
	if (call.content?.brief) {
		lines.push('\n### Summary\n');
		lines.push(escapeMarkdown(call.content.brief));
	}

	// Key Points
	if (call.content?.keyPoints && call.content.keyPoints.length > 0) {
		lines.push('\n### Key Points\n');
		for (const point of call.content.keyPoints) {
			lines.push(`- ${escapeMarkdown(point.text)}`);
		}
	}

	// Action Items
	if (call.content?.pointsOfInterest?.actionItems?.length) {
		lines.push('\n### Action Items\n');
		for (const item of call.content.pointsOfInterest.actionItems) {
			if (item.snippet) {
				lines.push(`- ${escapeMarkdown(item.snippet)}`);
			}
		}
	}

	// Topics (compact)
	if (call.content?.topics && call.content.topics.length > 0) {
		lines.push('\n### Topics\n');
		const topics = call.content.topics.map(
			(t) =>
				`${escapeMarkdown(t.name)} (${Math.round((t.duration ?? 0) / 60)}m)`,
		);
		lines.push(topics.join(', '));
	}

	// Outline (detailed section breakdown)
	if (call.content?.outline && call.content.outline.length > 0) {
		lines.push('\n### Outline\n');
		for (const section of call.content.outline) {
			const duration = section.duration
				? ` (${Math.round(section.duration / 60)}m)`
				: '';
			lines.push(
				`**${escapeMarkdown(section.section ?? 'Section')}**${duration}`,
			);
			if (section.items && section.items.length > 0) {
				for (const item of section.items) {
					if (item.text) {
						lines.push(`- ${escapeMarkdown(item.text)}`);
					}
				}
			}
			lines.push('');
		}
	}

	return lines.join('\n');
}

/**
 * Options for formatting transcripts with truncation
 */
export interface FormatTranscriptOptions {
	maxLength?: number;
	offset?: number;
}

/**
 * Format a single call transcript with speaker names
 * Supports truncation via maxLength/offset to prevent context overflow
 */
export function formatCallTranscript(
	transcript: CallTranscript,
	parties?: Party[] | null,
	options?: FormatTranscriptOptions,
): string {
	const maxLength = options?.maxLength ?? 10000;
	const offset = options?.offset ?? 0;

	// Build speaker ID to name mapping
	const speakerNames = new Map<string, string>();
	if (parties) {
		for (const party of parties) {
			if (party.speakerId) {
				const name =
					party.name ?? party.emailAddress ?? `Speaker ${party.speakerId}`;
				speakerNames.set(party.speakerId, name);
			}
		}
	}

	// Build full transcript first to get total length
	const fullLines: string[] = [];
	for (const entry of transcript.transcript) {
		const speakerName =
			speakerNames.get(entry.speakerId) ?? `Speaker ${entry.speakerId}`;
		const text = entry.sentences.map((s) => s.text).join(' ');
		fullLines.push(
			`[${escapeMarkdown(speakerName)}]: ${escapeMarkdown(text)}\n`,
		);
	}
	const fullText = fullLines.join('\n');
	const totalLength = fullText.length;

	const lines: string[] = [];
	lines.push(`## Transcript (Call ${transcript.callId})\n`);

	if (transcript.transcript.length === 0) {
		lines.push('*No transcript available*');
		return lines.join('\n');
	}

	// Apply offset and maxLength
	const slicedText = fullText.slice(offset, offset + maxLength);

	// Check if truncated
	const isTruncatedStart = offset > 0;
	const isTruncatedEnd = offset + maxLength < totalLength;

	if (isTruncatedStart || isTruncatedEnd) {
		lines.push(
			`*Showing characters ${offset + 1}-${Math.min(offset + maxLength, totalLength)} of ${totalLength} total*\n`,
		);
	}

	if (isTruncatedStart) {
		lines.push('*[...truncated start...]*\n');
	}

	lines.push(slicedText);

	if (isTruncatedEnd) {
		lines.push('\n*[...truncated...]*');
		lines.push(`\n*To see more, use offset: ${offset + maxLength}*`);
	}

	return lines.join('\n');
}

/**
 * Format users list as markdown table
 */
export function formatUsersResponse(response: UsersResponse): string {
	const lines: string[] = [];

	lines.push(`**Users** (${response.records.totalRecords} total)\n`);

	if (response.users.length === 0) {
		lines.push('No users found.');
		return lines.join('\n');
	}

	lines.push('| ID | Name | Email | Title | Active |');
	lines.push('|---|---|---|---|---|');

	for (const user of response.users) {
		const name =
			[user.firstName, user.lastName].filter(Boolean).join(' ') || '-';
		const email = user.emailAddress ?? '-';
		const title = user.title?.slice(0, 30) ?? '-';
		const active = user.active ? 'Yes' : 'No';
		lines.push(
			`| ${user.id} | ${escapeMarkdown(name)} | ${email} | ${escapeMarkdown(title)} | ${active} |`,
		);
	}

	if (response.records.cursor) {
		lines.push(
			`\n*More results available. Cursor:* \`${response.records.cursor}\``,
		);
	}

	return lines.join('\n');
}

/**
 * Escape markdown special characters in text
 */
function escapeMarkdown(text: string): string {
	return text.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\r/g, '');
}

/**
 * Format a single call's metadata (GET /v2/calls/{id})
 */
export function formatSingleCall(response: SingleCallResponse): string {
	const lines: string[] = [];
	const call = response.call;

	lines.push(`## ${escapeMarkdown(call.title ?? 'Untitled Call')}\n`);

	const metaParts: string[] = [`**ID:** ${call.id}`];
	if (call.started) {
		metaParts.push(`**Date:** ${new Date(call.started).toLocaleString()}`);
	}
	if (call.duration) {
		metaParts.push(`**Duration:** ${Math.round(call.duration / 60)}m`);
	}
	if (call.direction) metaParts.push(`**Direction:** ${call.direction}`);
	if (call.scope) metaParts.push(`**Scope:** ${call.scope}`);
	if (call.system) metaParts.push(`**System:** ${call.system}`);
	if (call.media) metaParts.push(`**Media:** ${call.media}`);
	if (call.language) metaParts.push(`**Language:** ${call.language}`);
	lines.push(metaParts.join(' | '));

	if (call.url) lines.push(`**URL:** ${call.url}`);
	if (call.purpose) lines.push(`**Purpose:** ${escapeMarkdown(call.purpose)}`);
	if (call.primaryUserId) lines.push(`**Host User ID:** ${call.primaryUserId}`);
	if (call.workspaceId) lines.push(`**Workspace ID:** ${call.workspaceId}`);
	if (call.isPrivate !== null && call.isPrivate !== undefined) {
		lines.push(`**Private:** ${call.isPrivate ? 'Yes' : 'No'}`);
	}

	return lines.join('\n');
}

/**
 * Format a single user's profile (GET /v2/users/{id})
 */
export function formatSingleUser(response: SingleUserResponse): string {
	const lines: string[] = [];
	const user = response.user;

	const name =
		[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
	lines.push(`## ${escapeMarkdown(name)}\n`);

	const metaParts: string[] = [`**ID:** ${user.id}`];
	if (user.emailAddress) metaParts.push(`**Email:** ${user.emailAddress}`);
	if (user.title) metaParts.push(`**Title:** ${escapeMarkdown(user.title)}`);
	if (user.active !== null && user.active !== undefined) {
		metaParts.push(`**Active:** ${user.active ? 'Yes' : 'No'}`);
	}
	lines.push(metaParts.join(' | '));

	if (user.phoneNumber) lines.push(`**Phone:** ${user.phoneNumber}`);
	if (user.managerId) lines.push(`**Manager ID:** ${user.managerId}`);
	if (user.spokenLanguages?.length) {
		const langs = user.spokenLanguages
			.map((l) => (l.primary ? `${l.language} (primary)` : l.language))
			.join(', ');
		lines.push(`**Languages:** ${langs}`);
	}

	return lines.join('\n');
}

/**
 * Format keyword trackers response
 */
export function formatTrackersResponse(
	response: TrackersSettingsResponse,
): string {
	const lines: string[] = [];
	const trackers = response.keywordTrackers ?? [];

	lines.push(`**Keyword Trackers** (${trackers.length} total)\n`);

	if (trackers.length === 0) {
		lines.push('No trackers found.');
		return lines.join('\n');
	}

	lines.push('| Name | Affiliation | Tracks | Keywords |');
	lines.push('|------|-------------|--------|----------|');

	for (const tracker of trackers) {
		const name = escapeMarkdown(tracker.trackerName?.slice(0, 40) ?? '-');
		const affiliation = tracker.affiliation ?? '-';
		const tracks = tracker.saidAt ?? '-';

		const allKeywords = (tracker.languageKeywords ?? [])
			.flatMap((lk) => lk.keywords ?? [])
			.slice(0, 5)
			.map((k) => escapeMarkdown(k))
			.join(', ');
		const keywordsDisplay = allKeywords || '-';

		lines.push(`| ${name} | ${affiliation} | ${tracks} | ${keywordsDisplay} |`);
	}

	return lines.join('\n');
}

/**
 * Format workspaces list response
 */
export function formatWorkspacesResponse(response: WorkspacesResponse): string {
	const lines: string[] = [];
	const workspaces = response.workspaces ?? [];

	lines.push(`**Workspaces** (${workspaces.length} total)\n`);

	if (workspaces.length === 0) {
		lines.push('No workspaces found.');
		return lines.join('\n');
	}

	lines.push('| ID | Name | Description |');
	lines.push('|----|------|-------------|');

	for (const ws of workspaces) {
		const name = escapeMarkdown(ws.name?.slice(0, 40) ?? '-');
		const desc = escapeMarkdown(ws.description?.slice(0, 60) ?? '-');
		lines.push(`| ${ws.id} | ${name} | ${desc} |`);
	}

	return lines.join('\n');
}

/**
 * Format library folders list response
 */
export function formatLibraryFoldersResponse(
	response: LibraryFoldersResponse,
): string {
	const lines: string[] = [];
	const folders = response.folders ?? [];

	lines.push(`**Library Folders** (${folders.length} total)\n`);

	if (folders.length === 0) {
		lines.push('No library folders found.');
		return lines.join('\n');
	}

	lines.push('| ID | Name | Parent Folder |');
	lines.push('|----|------|---------------|');

	for (const folder of folders) {
		const name = escapeMarkdown(folder.name?.slice(0, 50) ?? '-');
		const parent = folder.parentFolderId ?? 'Root';
		lines.push(`| ${folder.id} | ${name} | ${parent} |`);
	}

	return lines.join('\n');
}

/**
 * Format library folder calls response
 */
export function formatLibraryFolderCallsResponse(
	response: LibraryFolderCallsResponse,
): string {
	const lines: string[] = [];
	const calls = response.calls ?? [];

	const folderName = escapeMarkdown(response.name ?? 'Unknown Folder');
	lines.push(`## Library Folder: ${folderName}\n`);
	if (response.id) lines.push(`**Folder ID:** ${response.id}`);
	lines.push(`**Calls:** ${calls.length}\n`);

	if (calls.length === 0) {
		lines.push('No calls in this folder.');
		return lines.join('\n');
	}

	lines.push('| Call ID | Title | Added By | Added On | Snippet | Note |');
	lines.push('|---------|-------|----------|----------|---------|------|');

	for (const call of calls) {
		const title = escapeMarkdown(call.title?.slice(0, 50) ?? '-');
		const addedBy = call.addedBy ?? '-';
		const addedOn = call.created
			? new Date(call.created).toLocaleDateString()
			: '-';

		let snippet = '-';
		if (call.snippet?.fromSec != null && call.snippet?.toSec != null) {
			const fmt = (s: number) =>
				`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
			snippet = `${fmt(call.snippet.fromSec)}\u2013${fmt(call.snippet.toSec)}`;
		}

		const note = call.note
			? escapeMarkdown(call.note.slice(0, 60)) +
				(call.note.length > 60 ? '\u2026' : '')
			: '-';

		lines.push(
			`| ${call.id} | ${title} | ${addedBy} | ${addedOn} | ${snippet} | ${note} |`,
		);
	}

	return lines.join('\n');
}
