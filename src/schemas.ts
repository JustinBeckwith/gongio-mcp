/**
 * Zod schemas for Gong API request/response validation
 * Based on Gong API v2 documentation
 * https://gong.app.gong.io/settings/api/documentation
 */

import { z } from 'zod';

// ============================================================================
// Common Patterns & Primitives
// ============================================================================

/**
 * ISO 8601 datetime string validation
 * Accepts formats like: 2024-01-01T00:00:00Z or 2024-01-01T00:00:00-07:00
 */
export const iso8601DateTimeSchema = z
	.string()
	.regex(
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
		'Must be a valid ISO 8601 datetime (e.g., 2024-01-01T00:00:00Z)',
	);

/**
 * Gong ID validation - numeric string up to 20 digits
 */
export const gongIdSchema = z
	.string()
	.regex(/^\d{1,20}$/, 'Must be a numeric string up to 20 digits');

/**
 * Pagination cursor - opaque string from API
 */
export const cursorSchema = z.string().min(1);

// ============================================================================
// Request Schemas (for input validation)
// ============================================================================

/**
 * GET /v2/calls - List calls request parameters
 */
export const listCallsRequestSchema = z
	.object({
		fromDateTime: iso8601DateTimeSchema.optional(),
		toDateTime: iso8601DateTimeSchema.optional(),
		workspaceId: gongIdSchema.optional(),
		cursor: cursorSchema.optional(),
	})
	.refine(
		(data) => {
			// If both dates provided, fromDateTime must be before toDateTime
			if (data.fromDateTime && data.toDateTime) {
				return new Date(data.fromDateTime) < new Date(data.toDateTime);
			}
			return true;
		},
		{
			message: 'fromDateTime must be before toDateTime',
		},
	);

export type ListCallsRequest = z.infer<typeof listCallsRequestSchema>;

/**
 * POST /v2/calls/extensive - Search calls with filters
 */
export const searchCallsRequestSchema = z
	.object({
		fromDateTime: iso8601DateTimeSchema.optional(),
		toDateTime: iso8601DateTimeSchema.optional(),
		workspaceId: gongIdSchema.optional(),
		primaryUserIds: z.array(gongIdSchema).optional(),
		callIds: z.array(gongIdSchema).optional(),
		cursor: cursorSchema.optional(),
	})
	.refine(
		(data) => {
			if (data.fromDateTime && data.toDateTime) {
				return new Date(data.fromDateTime) < new Date(data.toDateTime);
			}
			return true;
		},
		{
			message: 'fromDateTime must be before toDateTime',
		},
	);

export type SearchCallsRequest = z.infer<typeof searchCallsRequestSchema>;

/**
 * Get call summary - single call ID
 */
export const getCallSummaryRequestSchema = z.object({
	callId: gongIdSchema,
});

export type GetCallSummaryRequest = z.infer<typeof getCallSummaryRequestSchema>;

/**
 * Get call transcript - single call ID with optional truncation
 * Default maxLength is 10000 characters (~10KB) to prevent context overflow
 */
export const getCallTranscriptRequestSchema = z.object({
	callId: gongIdSchema,
	maxLength: z
		.number()
		.int()
		.min(1000)
		.max(100000)
		.default(10000)
		.describe(
			'Maximum characters to return (default: 10000). Use offset to paginate through longer transcripts.',
		),
	offset: z
		.number()
		.int()
		.min(0)
		.default(0)
		.describe(
			'Character offset to start from (default: 0). Use with maxLength to paginate.',
		),
});

export type GetCallTranscriptRequest = z.infer<
	typeof getCallTranscriptRequestSchema
>;

/**
 * GET /v2/users - List users request parameters
 */
export const listUsersRequestSchema = z.object({
	cursor: cursorSchema.optional(),
	includeAvatars: z.boolean().optional(),
});

export type ListUsersRequest = z.infer<typeof listUsersRequestSchema>;

// ============================================================================
// Response Schemas (for API response parsing)
// ============================================================================

/**
 * Pagination records info in responses
 */
export const recordsSchema = z.object({
	cursor: z.string().optional(),
	totalRecords: z.number(),
	currentPageSize: z.number(),
	currentPageNumber: z.number(),
});

/**
 * Call scope enum
 */
export const callScopeSchema = z.enum(['Internal', 'External', 'Unknown']);

/**
 * Call direction enum
 */
export const callDirectionSchema = z.enum([
	'Inbound',
	'Outbound',
	'Conference',
	'Unknown',
]);

/**
 * Call media type enum
 */
export const callMediaSchema = z.enum(['Video', 'Audio']);

/**
 * Basic call data from GET /v2/calls
 * Note: Gong API returns null for empty fields, so we use .nullish()
 */
export const callSchema = z.object({
	id: z.string(),
	title: z.string().nullish(),
	scheduled: z.string().nullish(),
	started: z.string().nullish(),
	duration: z.number().nullish(),
	primaryUserId: z.string().nullish(),
	direction: z.string().nullish(),
	scope: z.string().nullish(),
	media: z.string().nullish(),
	language: z.string().nullish(),
	workspaceId: z.string().nullish(),
	url: z.string().nullish(),
});

export type Call = z.infer<typeof callSchema>;

/**
 * GET /v2/calls response
 */
export const callsResponseSchema = z.object({
	requestId: z.string(),
	records: recordsSchema,
	calls: z.array(callSchema),
});

export type CallsResponse = z.infer<typeof callsResponseSchema>;

/**
 * Sentence in a transcript
 */
export const sentenceSchema = z.object({
	start: z.number(),
	end: z.number(),
	text: z.string(),
});

/**
 * Monologue (speaker segment) in a transcript
 */
export const transcriptEntrySchema = z.object({
	speakerId: z.string(),
	topic: z.string().nullish(),
	sentences: z.array(sentenceSchema),
});

export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;

/**
 * Call transcript
 */
export const callTranscriptSchema = z.object({
	callId: z.string(),
	transcript: z.array(transcriptEntrySchema),
});

export type CallTranscript = z.infer<typeof callTranscriptSchema>;

/**
 * POST /v2/calls/transcript response
 */
export const transcriptsResponseSchema = z.object({
	requestId: z.string(),
	records: recordsSchema,
	callTranscripts: z.array(callTranscriptSchema),
});

export type TranscriptsResponse = z.infer<typeof transcriptsResponseSchema>;

/**
 * Spoken language settings
 */
export const spokenLanguageSchema = z.object({
	language: z.string(),
	primary: z.boolean(),
});

/**
 * User settings
 */
export const userSettingsSchema = z.object({
	webConferencesRecorded: z.boolean().nullish(),
	preventWebConferenceRecording: z.boolean().nullish(),
	telephonyCallsRecorded: z.boolean().nullish(),
	emailsRecorded: z.boolean().nullish(),
	preventEmailRecording: z.boolean().nullish(),
	nonRecordedMeetingsDefaultPrivacy: z.string().nullish(),
	gpiSettings: z.unknown().nullish(),
	emailsImported: z.boolean().nullish(),
});

/**
 * User data
 * Note: Gong API returns null for empty fields
 */
export const userSchema = z.object({
	id: z.string(),
	emailAddress: z.string().nullish(),
	created: z.string().nullish(),
	active: z.boolean().nullish(),
	emailAliases: z.array(z.string()).nullish(),
	trustedEmailAddress: z.string().nullish(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	title: z.string().nullish(),
	phoneNumber: z.string().nullish(),
	extension: z.string().nullish(),
	personalMeetingUrls: z.array(z.string()).nullish(),
	settings: userSettingsSchema.nullish(),
	managerId: z.string().nullish(),
	meetingConsentPageUrl: z.string().nullish(),
	spokenLanguages: z.array(spokenLanguageSchema).nullish(),
});

export type User = z.infer<typeof userSchema>;

/**
 * GET /v2/users response
 */
export const usersResponseSchema = z.object({
	requestId: z.string(),
	records: recordsSchema,
	users: z.array(userSchema),
});

export type UsersResponse = z.infer<typeof usersResponseSchema>;

/**
 * Party (participant) in a call
 * Note: Gong API returns null for empty fields
 */
export const partySchema = z.object({
	id: z.string().nullish(),
	emailAddress: z.string().nullish(),
	name: z.string().nullish(),
	title: z.string().nullish(),
	userId: z.string().nullish(),
	speakerId: z.string().nullish(),
	context: z
		.array(
			z.object({
				system: z.string().nullish(),
				objects: z
					.array(
						z.object({
							objectType: z.string().nullish(),
							objectId: z.string().nullish(),
							fields: z
								.array(z.object({ name: z.string(), value: z.string() }))
								.nullish(),
						}),
					)
					.nullish(),
			}),
		)
		.nullish(),
	affiliation: z.string().nullish(),
	phoneNumber: z.string().nullish(),
	methods: z.array(z.string()).nullish(),
});

/**
 * Tracker occurrence
 */
export const trackerOccurrenceSchema = z.object({
	startTime: z.number(),
	speakerId: z.string().nullish(),
});

/**
 * Tracker in call content
 */
export const trackerSchema = z.object({
	id: z.string(),
	name: z.string(),
	count: z.number(),
	type: z.string().nullish(),
	occurrences: z.array(trackerOccurrenceSchema).nullish(),
});

/**
 * Topic in call content
 */
export const topicSchema = z.object({
	name: z.string(),
	duration: z.number(),
});

/**
 * Action item in call
 */
export const actionItemSchema = z.object({
	snippetStartTime: z.number().nullish(),
	snippetEndTime: z.number().nullish(),
	speakerIds: z.array(z.string()).nullish(),
	snippet: z.string().nullish(),
});

/**
 * Outline item
 */
export const outlineItemSchema = z.object({
	text: z.string(),
	startTime: z.number().nullish(),
});

/**
 * Outline section
 */
export const outlineSectionSchema = z.object({
	section: z.string(),
	startTime: z.number().nullish(),
	duration: z.number().nullish(),
	items: z.array(outlineItemSchema).nullish(),
});

/**
 * Call outcome
 */
export const callOutcomeSchema = z.object({
	id: z.string().nullish(),
	category: z.string().nullish(),
	name: z.string().nullish(),
});

/**
 * Key point
 */
export const keyPointSchema = z.object({
	text: z.string(),
});

/**
 * Call content (detailed data)
 */
export const callContentSchema = z.object({
	trackers: z.array(trackerSchema).nullish(),
	topics: z.array(topicSchema).nullish(),
	pointsOfInterest: z
		.object({
			actionItems: z.array(actionItemSchema).nullish(),
		})
		.nullish(),
	brief: z.string().nullish(),
	outline: z.array(outlineSectionSchema).nullish(),
	callOutcome: callOutcomeSchema.nullish(),
	keyPoints: z.array(keyPointSchema).nullish(),
});

/**
 * Speaker stats
 */
export const speakerSchema = z.object({
	id: z.string(),
	visibility: z.number().nullish(),
	talkTime: z.number().nullish(),
});

/**
 * Video segment
 */
export const videoSegmentSchema = z.object({
	name: z.string(),
	duration: z.number(),
});

/**
 * Call interaction data
 */
export const interactionSchema = z.object({
	speakers: z.array(speakerSchema).nullish(),
	interactivity: z.number().nullish(),
	video: z.array(videoSegmentSchema).nullish(),
	questions: z
		.object({
			companyCount: z.number().nullish(),
			nonCompanyCount: z.number().nullish(),
		})
		.nullish(),
});

/**
 * Public comment
 */
export const publicCommentSchema = z.object({
	id: z.string(),
	audioStartTime: z.number().nullish(),
	audioEndTime: z.number().nullish(),
	commenterUserId: z.string().nullish(),
	comment: z.string().nullish(),
	posted: z.string().nullish(),
	inReplyTo: z.string().nullish(),
	duringCall: z.boolean().nullish(),
});

/**
 * Call collaboration data
 */
export const collaborationSchema = z.object({
	publicComments: z.array(publicCommentSchema).nullish(),
});

/**
 * Call media URLs
 */
export const mediaSchema = z.object({
	audioUrl: z.string().nullish(),
	videoUrl: z.string().nullish(),
});

/**
 * Call metadata
 * Note: Gong API returns null for empty fields, so we use .nullish() (allows null | undefined)
 */
export const callMetadataSchema = z.object({
	id: z.string(),
	url: z.string().nullish(),
	title: z.string().nullish(),
	scheduled: z.string().nullish(),
	started: z.string().nullish(),
	duration: z.number().nullish(),
	primaryUserId: z.string().nullish(),
	direction: z.string().nullish(),
	system: z.string().nullish(),
	scope: z.string().nullish(),
	media: z.string().nullish(),
	language: z.string().nullish(),
	workspaceId: z.string().nullish(),
	sdrDisposition: z.string().nullish(),
	clientUniqueId: z.string().nullish(),
	customData: z.string().nullish(),
	purpose: z.string().nullish(),
	meetingUrl: z.string().nullish(),
	isPrivate: z.boolean().nullish(),
	calendarEventId: z.string().nullish(),
});

/**
 * Context object field
 */
export const contextFieldSchema = z.object({
	name: z.string(),
	value: z.string(),
});

/**
 * Context object (CRM, etc)
 */
export const contextObjectSchema = z.object({
	objectType: z.string().nullish(),
	objectId: z.string().nullish(),
	fields: z.array(contextFieldSchema).nullish(),
	timing: z.string().nullish(),
});

/**
 * Context (external system links)
 */
export const contextSchema = z.object({
	system: z.string().nullish(),
	objects: z.array(contextObjectSchema).nullish(),
});

/**
 * Detailed call data from POST /v2/calls/extensive
 */
export const callDetailsSchema = z.object({
	metaData: callMetadataSchema,
	context: z.array(contextSchema).nullish(),
	parties: z.array(partySchema).nullish(),
	content: callContentSchema.nullish(),
	interaction: interactionSchema.nullish(),
	collaboration: collaborationSchema.nullish(),
	media: mediaSchema.nullish(),
});

export type CallDetails = z.infer<typeof callDetailsSchema>;

/**
 * POST /v2/calls/extensive response
 */
export const callDetailsResponseSchema = z.object({
	requestId: z.string(),
	records: z.object({
		totalRecords: z.number(),
		currentPageSize: z.number(),
		currentPageNumber: z.number(),
		cursor: z.string().optional(),
	}),
	calls: z.array(callDetailsSchema),
});

export type CallDetailsResponse = z.infer<typeof callDetailsResponseSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate and parse list calls request
 */
export function validateListCallsRequest(input: unknown): ListCallsRequest {
	return listCallsRequestSchema.parse(input ?? {});
}

/**
 * Validate and parse search calls request
 */
export function validateSearchCallsRequest(input: unknown): SearchCallsRequest {
	return searchCallsRequestSchema.parse(input ?? {});
}

/**
 * Validate and parse get call summary request
 */
export function validateGetCallSummaryRequest(
	input: unknown,
): GetCallSummaryRequest {
	return getCallSummaryRequestSchema.parse(input);
}

/**
 * Validate and parse get call transcript request
 */
export function validateGetCallTranscriptRequest(
	input: unknown,
): GetCallTranscriptRequest {
	return getCallTranscriptRequestSchema.parse(input);
}

/**
 * Validate and parse list users request
 */
export function validateListUsersRequest(input: unknown): ListUsersRequest {
	return listUsersRequestSchema.parse(input ?? {});
}

/**
 * Parse and validate calls response
 */
export function parseCallsResponse(data: unknown): CallsResponse {
	return callsResponseSchema.parse(data);
}

/**
 * Parse and validate call details response
 */
export function parseCallDetailsResponse(data: unknown): CallDetailsResponse {
	return callDetailsResponseSchema.parse(data);
}

/**
 * Parse and validate transcripts response
 */
export function parseTranscriptsResponse(data: unknown): TranscriptsResponse {
	return transcriptsResponseSchema.parse(data);
}

/**
 * Parse and validate users response
 */
export function parseUsersResponse(data: unknown): UsersResponse {
	return usersResponseSchema.parse(data);
}

// ============================================================================
// New Tool Schemas
// ============================================================================

// --- get_call ---

export const getCallRequestSchema = z.object({
	callId: gongIdSchema,
});

export type GetCallRequest = z.infer<typeof getCallRequestSchema>;

export const singleCallResponseSchema = z.object({
	requestId: z.string().optional(),
	call: callMetadataSchema,
});

export type SingleCallResponse = z.infer<typeof singleCallResponseSchema>;

export function parseSingleCallResponse(data: unknown): SingleCallResponse {
	return singleCallResponseSchema.parse(data);
}

// --- get_user ---

export const getUserRequestSchema = z.object({
	userId: gongIdSchema,
});

export type GetUserRequest = z.infer<typeof getUserRequestSchema>;

export const singleUserResponseSchema = z.object({
	requestId: z.string().optional(),
	user: userSchema,
});

export type SingleUserResponse = z.infer<typeof singleUserResponseSchema>;

export function parseSingleUserResponse(data: unknown): SingleUserResponse {
	return singleUserResponseSchema.parse(data);
}

// --- search_users ---

export const searchUsersRequestSchema = z.object({
	userIds: z.array(gongIdSchema).optional(),
	createdFromDateTime: iso8601DateTimeSchema.optional(),
	createdToDateTime: iso8601DateTimeSchema.optional(),
	cursor: cursorSchema.optional(),
});

export type SearchUsersRequest = z.infer<typeof searchUsersRequestSchema>;

// (Reuse parseUsersResponse for search_users response)

// --- get_trackers ---

export const getTrackersRequestSchema = z.object({
	workspaceId: gongIdSchema.optional(),
});

export type GetTrackersRequest = z.infer<typeof getTrackersRequestSchema>;

const trackerKeywordGroupSchema = z.object({
	language: z.string().nullish(),
	keywords: z.array(z.string()).nullish(),
	includeRelatedForms: z.boolean().nullish(),
});

const keywordTrackerDefinitionSchema = z.object({
	trackerId: z.string().nullish(),
	trackerName: z.string().nullish(),
	workspaceId: z.string().nullish(),
	languageKeywords: z.array(trackerKeywordGroupSchema).nullish(),
	affiliation: z.string().nullish(),
	partOfQuestion: z.boolean().nullish(),
	saidAt: z.string().nullish(),
	filterQuery: z.string().nullish(),
	created: z.string().nullish(),
	creatorUserId: z.string().nullish(),
});

export const trackersSettingsResponseSchema = z.object({
	requestId: z.string().optional(),
	keywordTrackers: z.array(keywordTrackerDefinitionSchema).nullish(),
});

export type TrackersSettingsResponse = z.infer<
	typeof trackersSettingsResponseSchema
>;

export function parseTrackersSettingsResponse(
	data: unknown,
): TrackersSettingsResponse {
	return trackersSettingsResponseSchema.parse(data);
}

// --- list_workspaces ---

const workspaceSchema = z.object({
	id: z.string(),
	name: z.string().nullish(),
	description: z.string().nullish(),
});

export const workspacesResponseSchema = z.object({
	requestId: z.string().optional(),
	workspaces: z.array(workspaceSchema).nullish(),
});

export type WorkspacesResponse = z.infer<typeof workspacesResponseSchema>;

export function parseWorkspacesResponse(data: unknown): WorkspacesResponse {
	return workspacesResponseSchema.parse(data);
}

// --- list_library_folders ---

export const listLibraryFoldersRequestSchema = z.object({
	workspaceId: gongIdSchema,
});

export type ListLibraryFoldersRequest = z.infer<
	typeof listLibraryFoldersRequestSchema
>;

const libraryFolderSchema = z.object({
	id: z.string(),
	name: z.string().nullish(),
	parentFolderId: z.string().nullish(),
	createdBy: z.string().nullish(),
	updated: z.string().nullish(),
});

export const libraryFoldersResponseSchema = z.object({
	requestId: z.string().optional(),
	folders: z.array(libraryFolderSchema).nullish(),
});

export type LibraryFoldersResponse = z.infer<
	typeof libraryFoldersResponseSchema
>;

export function parseLibraryFoldersResponse(
	data: unknown,
): LibraryFoldersResponse {
	return libraryFoldersResponseSchema.parse(data);
}

// --- get_library_folder_calls ---

export const getLibraryFolderCallsRequestSchema = z.object({
	folderId: gongIdSchema,
});

export type GetLibraryFolderCallsRequest = z.infer<
	typeof getLibraryFolderCallsRequestSchema
>;

const snippetSchema = z.object({
	fromSec: z.number().nullish(),
	toSec: z.number().nullish(),
});

const libraryCallSchema = z.object({
	id: z.string(),
	title: z.string().nullish(),
	note: z.string().nullish(),
	addedBy: z.string().nullish(),
	created: z.string().nullish(),
	url: z.string().nullish(),
	snippet: snippetSchema.nullish(),
});

export const libraryFolderCallsResponseSchema = z.object({
	requestId: z.string().optional(),
	id: z.string().nullish(),
	name: z.string().nullish(),
	createdBy: z.string().nullish(),
	updated: z.string().nullish(),
	calls: z.array(libraryCallSchema).nullish(),
});

export type LibraryFolderCallsResponse = z.infer<
	typeof libraryFolderCallsResponseSchema
>;

export function parseLibraryFolderCallsResponse(
	data: unknown,
): LibraryFolderCallsResponse {
	return libraryFolderCallsResponseSchema.parse(data);
}
