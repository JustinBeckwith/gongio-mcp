/**
 * Formatters to convert API responses to markdown tables
 * Reduces token usage compared to JSON output
 */

import type {
	CallsResponse,
	CallDetails,
	CallTranscript,
	UsersResponse,
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
		const duration = call.duration
			? `${Math.round(call.duration / 60)}m`
			: '-';
		const title = call.title?.slice(0, 50) ?? '-';
		lines.push(
			`| ${call.id} | ${escapeMarkdown(title)} | ${date} | ${duration} | ${call.scope ?? '-'} |`,
		);
	}

	if (response.records.cursor) {
		lines.push(`\n*More results available. Cursor:* \`${response.records.cursor}\``);
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
			(t) => `${escapeMarkdown(t.name)} (${Math.round(t.duration / 60)}m)`,
		);
		lines.push(topics.join(', '));
	}

	return lines.join('\n');
}

/**
 * Format a single call transcript with speaker names
 */
export function formatCallTranscript(
	transcript: CallTranscript,
	parties?: Party[] | null,
): string {
	const lines: string[] = [];

	// Build speaker ID to name mapping
	const speakerNames = new Map<string, string>();
	if (parties) {
		for (const party of parties) {
			if (party.speakerId) {
				const name = party.name ?? party.emailAddress ?? `Speaker ${party.speakerId}`;
				speakerNames.set(party.speakerId, name);
			}
		}
	}

	lines.push(`## Transcript (Call ${transcript.callId})\n`);

	if (transcript.transcript.length === 0) {
		lines.push('*No transcript available*');
		return lines.join('\n');
	}

	for (const entry of transcript.transcript) {
		const speakerName = speakerNames.get(entry.speakerId) ?? `Speaker ${entry.speakerId}`;
		const text = entry.sentences.map((s) => s.text).join(' ');
		lines.push(`[${escapeMarkdown(speakerName)}]: ${escapeMarkdown(text)}\n`);
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
		lines.push(`\n*More results available. Cursor:* \`${response.records.cursor}\``);
	}

	return lines.join('\n');
}

/**
 * Escape markdown special characters in text
 */
function escapeMarkdown(text: string): string {
	return text
		.replace(/\|/g, '\\|')
		.replace(/\n/g, ' ')
		.replace(/\r/g, '');
}
