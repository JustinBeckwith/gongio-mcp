import {
	execFileSync,
	spawn,
	type ChildProcessWithoutNullStreams,
} from 'node:child_process';
import { createInterface } from 'node:readline';
import { ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const EXPECTED_TOOL_NAMES = [
	'get_call',
	'get_call_summary',
	'get_call_transcript',
	'get_library_folder_calls',
	'get_trackers',
	'get_user',
	'list_calls',
	'list_library_folders',
	'list_users',
	'list_workspaces',
	'search_calls',
	'search_calls_by_account',
	'search_calls_by_opportunity',
	'search_transcripts',
	'search_users',
];

interface JsonRpcResponse {
	id: number;
	result?: unknown;
}

describe('MCP tool metadata', () => {
	let server: ChildProcessWithoutNullStreams | undefined;

	beforeAll(() => {
		execFileSync(process.execPath, ['node_modules/typescript/bin/tsc']);
	});

	afterEach(() => {
		server?.kill();
	});

	it('advertises every tool as read-only and open-world', async () => {
		server = spawn(
			process.execPath,
			['dist/index.js'],
			{
				cwd: process.cwd(),
				env: {
					...process.env,
					GONG_ACCESS_KEY: 'test-access-key',
					GONG_ACCESS_KEY_SECRET: 'test-access-key-secret',
				},
			},
		);

		const responses = new Map<
			number,
			(value: JsonRpcResponse) => void
		>();
		const lines = createInterface({ input: server.stdout });
		lines.on('line', (line) => {
			const message = JSON.parse(line) as JsonRpcResponse;
			if (message.id !== undefined) {
				responses.get(message.id)?.(message);
				responses.delete(message.id);
			}
		});

		const request = (id: number, method: string, params: object) =>
			new Promise<JsonRpcResponse>((resolve) => {
				responses.set(id, resolve);
				server?.stdin.write(
					`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
				);
			});

		await request(1, 'initialize', {
			protocolVersion: '2025-06-18',
			capabilities: {},
			clientInfo: { name: 'gongio-mcp-test', version: '1.0.0' },
		});
		server.stdin.write(
			`${JSON.stringify({
				jsonrpc: '2.0',
				method: 'notifications/initialized',
			})}\n`,
		);

		const response = await request(2, 'tools/list', {});
		const { tools } = ListToolsResultSchema.parse(response.result);

		expect(tools.map(({ name }) => name).sort()).toEqual(EXPECTED_TOOL_NAMES);
		for (const tool of tools) {
			expect(tool.annotations, tool.name).toEqual({
				readOnlyHint: true,
				openWorldHint: true,
			});
		}
	});
});
