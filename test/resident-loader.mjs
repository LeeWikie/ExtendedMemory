import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sdk = process.env.PI_SDK_ROOT;
assert(sdk, "Set PI_SDK_ROOT to the installed pi-coding-agent package");
const { loadExtensions } = await import(pathToFileURL(path.join(sdk, "dist/core/extensions/loader.js")).href);
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extended-memory-loader-"));
const previous = process.env.EXTENDED_MEMORY_DIR;
try {
	process.env.EXTENDED_MEMORY_DIR = dir;
	fs.mkdirSync(path.join(dir, "USER"));
	const text = "retained text ".repeat(2000);
	fs.writeFileSync(path.join(dir, "USER/USER.md"), text);
	fs.writeFileSync(path.join(dir, "IDENTITY.md"), "original");
	const loaded = await loadExtensions([path.join(repository, "index.ts")], repository);
	assert.deepEqual(loaded.errors, []);
	const extension = loaded.extensions[0];
	assert.equal(extension.tools.size, 0, "Resident mode must not expose memory tools");
	const entries = [];
	loaded.runtime.appendEntry = (customType, data) => entries.push({ type: "custom", customType, data });
	const ctx = { sessionManager: { getBranch: () => entries }, hasUI: false };
	const emit = async (name, event) => {
		let result;
		for (const handler of extension.handlers.get(name) ?? []) result = await handler(event, ctx);
		return result;
	};
	await emit("session_start", {});
	const initial = await emit("before_agent_start", { systemPrompt: "base" });
	assert(initial.systemPrompt.includes(text), "Nested content must not be truncated");
	assert(initial.systemPrompt.includes('path="MEMORY/USER/USER.md"'));
	fs.writeFileSync(path.join(dir, "IDENTITY.md"), "changed");
	assert.equal((await emit("before_agent_start", { systemPrompt: "base" })).systemPrompt, initial.systemPrompt);
	await emit("session_start", {});
	assert.equal((await emit("before_agent_start", { systemPrompt: "base" })).systemPrompt, initial.systemPrompt);
	entries.length = 0;
	await emit("session_start", {});
	assert((await emit("before_agent_start", { systemPrompt: "base" })).systemPrompt.includes("changed"));
	console.log("PASS: real pi loader; zero memory tools; nested full content; stable/resumed snapshot; new-session refresh");
} finally {
	if (previous === undefined) delete process.env.EXTENDED_MEMORY_DIR;
	else process.env.EXTENDED_MEMORY_DIR = previous;
	fs.rmSync(dir, { recursive: true, force: true });
}
