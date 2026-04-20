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
	SearchTranscriptsResult,
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
 * Check if any call in the response has rich content beyond metadata.
 */
function hasRichContent(calls: CallDetails[]): boolean {
	return calls.some(
		(c) =>
			(c.parties && c.parties.length > 0) ||
			c.content?.brief ||
			(c.content?.topics && c.content.topics.length > 0),
	);
}

/**
 * Extract CRM account name from call context, if available.
 */
function extractAccountName(call: CallDetails): string | null {
	for (const ctx of call.context ?? []) {
		for (const obj of ctx.objects ?? []) {
			if (obj.objectType === 'Account') {
				for (const field of obj.fields ?? []) {
					if (
						field.name.toLowerCase() === 'name' &&
						typeof field.value === 'string'
					) {
						return field.value;
					}
				}
			}
		}
	}
	return null;
}

/**
 * Format call details response with adaptive output.
 * Uses rich per-call blocks when content data is present,
 * falls back to a compact table for metadata-only results.
 *
 * trackerFilter, when provided, limits the Trackers line to only
 * trackers whose name matches one of the supplied needles
 * (case-insensitive substring). Without a filter, all non-zero
 * trackers are shown.
 */
export function formatCallDetailsResponse(
	response: CallDetailsResponse,
	totalBeforeFilter?: number,
	trackerFilter?: string[],
): string {
	const lines: string[] = [];

	// Header with optional filter count
	const count = response.calls.length;
	if (
		totalBeforeFilter !== undefined &&
		totalBeforeFilter !== count
	) {
		lines.push(`**Calls** (${count} of ${totalBeforeFilter} matched)\n`);
	} else {
		lines.push(`**Calls** (${count} total)\n`);
	}

	if (response.calls.length === 0) {
		lines.push('No calls found.');
		return lines.join('\n');
	}

	// Use rich format when content data is available
	if (hasRichContent(response.calls)) {
		for (const call of response.calls) {
			lines.push(formatCallDetailsBlock(call, trackerFilter));
			lines.push('');
		}
	} else {
		// Fallback to compact table for metadata-only results
		lines.push('| ID | Title | Date | Duration | Scope |');
		lines.push('|---|---|---|---|---|');

		for (const call of response.calls) {
			const meta = call.metaData;
			const date = meta.started
				? new Date(meta.started).toLocaleDateString()
				: '-';
			const duration = meta.duration
				? `${Math.round(meta.duration / 60)}m`
				: '-';
			const title = meta.title?.slice(0, 50) ?? '-';
			lines.push(
				`| ${meta.id} | ${escapeMarkdown(title)} | ${date} | ${duration} | ${meta.scope ?? '-'} |`,
			);
		}
	}

	return lines.join('\n');
}

/**
 * Format a single call as a rich block for search results.
 */
function formatCallDetailsBlock(
	call: CallDetails,
	trackerFilter?: string[],
): string {
	const lines: string[] = [];
	const meta = call.metaData;

	// Title
	lines.push(`### ${escapeMarkdown(meta.title?.slice(0, 80) ?? 'Untitled Call')}`);

	// Metadata line
	const metaParts: string[] = [`**ID:** ${meta.id}`];
	if (meta.started) {
		metaParts.push(
			`**Date:** ${new Date(meta.started).toLocaleDateString()}`,
		);
	}
	if (meta.duration) {
		metaParts.push(`**Duration:** ${Math.round(meta.duration / 60)}m`);
	}
	if (meta.scope) {
		metaParts.push(`**Scope:** ${meta.scope}`);
	}
	lines.push(metaParts.join(' | '));

	// Account name from CRM context
	const account = extractAccountName(call);
	if (account) {
		lines.push(`**Account:** ${escapeMarkdown(account)}`);
	}

	// Participants (compact single line)
	if (call.parties && call.parties.length > 0) {
		const participants = call.parties
			.map((p) => {
				const name = p.name ?? p.emailAddress ?? 'Unknown';
				const role = p.affiliation ? ` (${p.affiliation})` : '';
				return `${escapeMarkdown(name)}${role}`;
			})
			.join(', ');
		lines.push(`**Participants:** ${participants}`);
	}

	// Brief summary
	if (call.content?.brief) {
		lines.push(`**Summary:** ${escapeMarkdown(call.content.brief)}`);
	}

	// Topics (compact)
	if (call.content?.topics && call.content.topics.length > 0) {
		const topics = call.content.topics
			.map(
				(t) =>
					`${escapeMarkdown(t.name)} (${Math.round((t.duration ?? 0) / 60)}m)`,
			)
			.join(', ');
		lines.push(`**Topics:** ${topics}`);
	}

	// Key Points (optional)
	if (call.content?.keyPoints && call.content.keyPoints.length > 0) {
		lines.push('**Key Points:**');
		for (const point of call.content.keyPoints) {
			lines.push(`- ${escapeMarkdown(point.text)}`);
		}
	}

	// Trackers (optional, compact). Filter to relevance:
	// - if trackerFilter is supplied, show only matching trackers (substring, case-insensitive)
	// - otherwise show only trackers with count > 0 (drop the noisy 0x entries)
	if (call.content?.trackers && call.content.trackers.length > 0) {
		const needles = trackerFilter?.map((n) => n.toLowerCase());
		const visible = call.content.trackers.filter((t) => {
			if (t.count <= 0) return false;
			if (!needles || needles.length === 0) return true;
			return needles.some((needle) => t.name.toLowerCase().includes(needle));
		});
		if (visible.length > 0) {
			const trackers = visible
				.map((t) => `${escapeMarkdown(t.name)} (${t.count}x)`)
				.join(', ');
			lines.push(`**Trackers:** ${trackers}`);
		}
	}

	// Highlights (optional)
	if (call.content?.highlights && call.content.highlights.length > 0) {
		lines.push('**Highlights:**');
		for (const section of call.content.highlights) {
			if (section.title) {
				lines.push(`  *${escapeMarkdown(section.title)}*`);
			}
			for (const item of section.items ?? []) {
				if (item.text) {
					lines.push(`  - ${escapeMarkdown(item.text)}`);
				}
			}
		}
	}

	// Speakers (optional)
	if (call.interaction?.speakers && call.interaction.speakers.length > 0) {
		const speakerMap = new Map<string, string>();
		for (const p of call.parties ?? []) {
			if (p.id) {
				speakerMap.set(p.id, p.name ?? p.emailAddress ?? 'Unknown');
			}
		}
		const speakers = call.interaction.speakers
			.map((s) => {
				const name = speakerMap.get(s.id) ?? s.id;
				const time = s.talkTime
					? `${Math.round(s.talkTime / 60)}m`
					: '-';
				return `${escapeMarkdown(name)}: ${time}`;
			})
			.join(', ');
		lines.push(`**Talk Time:** ${speakers}`);
	}

	// Comments (optional)
	if (call.collaboration?.publicComments && call.collaboration.publicComments.length > 0) {
		lines.push('**Comments:**');
		for (const comment of call.collaboration.publicComments) {
			if (comment.comment) {
				lines.push(`- ${escapeMarkdown(comment.comment)}`);
			}
		}
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

	for (const tracker of trackers) {
		const name = tracker.trackerName ?? 'Unnamed Tracker';
		const keywords = (tracker.languageKeywords ?? []).flatMap(
			(lk) => lk.keywords ?? [],
		);

		lines.push(`### ${escapeMarkdown(name)}`);
		const metaParts: string[] = [];
		if (tracker.affiliation) {
			metaParts.push(`**Affiliation:** ${tracker.affiliation}`);
		}
		if (tracker.saidAt) {
			metaParts.push(`**Tracks:** ${tracker.saidAt}`);
		}
		metaParts.push(`**Keyword count:** ${keywords.length}`);
		lines.push(metaParts.join(' | '));

		if (keywords.length > 0) {
			const display = keywords.map((k) => escapeMarkdown(k)).join(', ');
			lines.push(`**Keywords:** ${display}`);
		}
		lines.push('');
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

/**
 * Format a CallDetails list (with parties and CRM context) for the
 * search_calls_by_account / search_calls_by_opportunity tools.
 *
 * Shows each match with the matching parties highlighted so the agent can
 * see why the call matched without re-fetching.
 */
export function formatMatchedCalls(
	calls: CallDetails[],
	meta: {
		header: string;
		totalScanned: number;
		matched: number;
		limitedByMaxCalls: boolean;
	},
): string {
	const lines: string[] = [];
	lines.push(`**${meta.header}**\n`);
	lines.push(
		`Scanned ${meta.totalScanned} call${meta.totalScanned === 1 ? '' : 's'}, matched ${meta.matched}.${meta.limitedByMaxCalls ? ' *(maxCalls limit reached — increase maxCalls or narrow date range to scan more.)*' : ''}\n`,
	);

	if (calls.length === 0) {
		lines.push('No matching calls.');
		return lines.join('\n');
	}

	lines.push('| ID | Title | Date | Duration | External Parties |');
	lines.push('|---|---|---|---|---|');

	for (const call of calls) {
		const m = call.metaData;
		const date = m.started ? new Date(m.started).toLocaleDateString() : '-';
		const duration = m.duration ? `${Math.round(m.duration / 60)}m` : '-';
		const title = escapeMarkdown(m.title?.slice(0, 50) ?? '-');
		const externals =
			call.parties
				?.filter((p) => (p.affiliation ?? '').toLowerCase() === 'external')
				.map((p) => p.name ?? p.emailAddress ?? '?')
				.slice(0, 3)
				.map((s) => escapeMarkdown(s.slice(0, 30)))
				.join(', ') || '-';
		lines.push(
			`| ${m.id} | ${title} | ${date} | ${duration} | ${externals} |`,
		);
	}

	return lines.join('\n');
}

/**
 * Format keyword match results from search_transcripts.
 */
export function formatTranscriptMatches(
	result: SearchTranscriptsResult,
): string {
	const lines: string[] = [];
	const keywords = result.keywords.map((k) => `\`${k}\``).join(', ');
	lines.push(`**Transcript matches for ${keywords}**\n`);
	lines.push(
		`Scanned ${result.callsScanned} call${result.callsScanned === 1 ? '' : 's'} \u2192 ${result.callsWithMatches} with matches \u2192 ${result.totalMatches} total sentence match${result.totalMatches === 1 ? '' : 'es'}.${result.limitedByMaxCalls ? ' *(maxCalls limit reached.)*' : ''}\n`,
	);

	if (result.results.length === 0) {
		lines.push('No matching sentences found.');
		return lines.join('\n');
	}

	for (const call of result.results) {
		const date = call.callStarted
			? new Date(call.callStarted).toLocaleDateString()
			: '';
		const titleLine = call.callTitle
			? escapeMarkdown(call.callTitle)
			: `Call ${call.callId}`;
		lines.push(
			`\n### ${titleLine}${date ? ` \u2014 ${date}` : ''}` +
				`${call.truncated ? ' *(matches truncated)*' : ''}`,
		);
		lines.push(
			`*ID:* \`${call.callId}\`${call.callUrl ? ` \u2014 [open in Gong](${call.callUrl})` : ''}`,
		);
		lines.push('');

		for (const m of call.matches) {
			const ts = formatTimestamp(m.startTime);
			const speaker = m.speakerName
				? `${escapeMarkdown(m.speakerName)}${m.speakerAffiliation ? ` (${m.speakerAffiliation})` : ''}`
				: `Speaker ${m.speakerId}`;
			lines.push(
				`- \`${ts}\` **${speaker}** \u2014 _${escapeMarkdown(`"${m.snippet}"`)}_ *(matched: ${m.keyword})*`,
			);
		}
	}

	return lines.join('\n');
}

/**
 * Convert milliseconds (Gong's transcript times) to mm:ss.
 */
function formatTimestamp(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}
