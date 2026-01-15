#!/usr/bin/env -S node --experimental-strip-types

import { readFileSync } from 'node:fs';
import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';

// Handle both ESM and CJS module exports
const Ajv = AjvModule.default ?? AjvModule;
const addFormats = addFormatsModule.default ?? addFormatsModule;

interface PackageJson {
	name: string;
	version: string;
	mcpName?: string;
}

interface ServerPackage {
	registryType: string;
	identifier: string;
	version: string;
}

interface ServerJson {
	$schema?: string;
	name: string;
	version: string;
	packages?: ServerPackage[];
}

interface ValidationError {
	instancePath?: string;
	message?: string;
}

// Read package.json and server.json
const pkg: PackageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const server: ServerJson = JSON.parse(readFileSync('server.json', 'utf8'));

const errors: string[] = [];

// Validate server.json against official MCP schema
console.log('Validating server.json against MCP schema...');
try {
	const schemaUrl =
		server.$schema ||
		'https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json';
	const schemaResponse = await fetch(schemaUrl);
	const schema = await schemaResponse.json();

	const ajv = new Ajv({ allErrors: true, strict: false });
	addFormats(ajv);
	const validate = ajv.compile(schema);
	const valid = validate(server);

	if (!valid && validate.errors) {
		errors.push('server.json failed schema validation:');
		for (const err of validate.errors as ValidationError[]) {
			errors.push(`  - ${err.instancePath || 'root'}: ${err.message}`);
		}
	}
} catch (e) {
	const message = e instanceof Error ? e.message : String(e);
	console.warn(`⚠️  Could not fetch schema for validation: ${message}`);
	console.warn('   Continuing with basic validation...\n');
}

// Check package.json requirements
console.log('Validating package.json requirements...');

if (!pkg.mcpName) {
	errors.push('package.json is missing required "mcpName" field');
}

if (pkg.mcpName && pkg.mcpName !== server.name) {
	errors.push(
		`package.json mcpName "${pkg.mcpName}" does not match server.json name "${server.name}"`,
	);
}

// Check cross-file version consistency
console.log('Validating version consistency...');

if (pkg.version !== server.version) {
	errors.push(
		`package.json version "${pkg.version}" does not match server.json version "${server.version}"`,
	);
}

if (
	server.packages?.[0]?.version &&
	pkg.version !== server.packages[0].version
) {
	errors.push(
		`package.json version "${pkg.version}" does not match server.json packages[0].version "${server.packages[0].version}"`,
	);
}

// Report results
if (errors.length > 0) {
	console.error('\n❌ MCP validation failed:\n');
	for (const error of errors) {
		console.error(`  • ${error}`);
	}
	process.exit(1);
} else {
	console.log('\n✅ MCP validation passed');
}
