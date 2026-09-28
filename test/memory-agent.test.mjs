import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMemoryOrganizer, createBackgroundStream } from "../index.ts";
import { model, response, toolCall } from "./agent-fixture.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-mini-agent-"));
const directory = path.join(root, "MEMORY");
fs.mkdirSync(directory);
const original = { "USER.md": "Name: Casey.\nAddress preference unknown.", "MEMORY.md": "UNCHANGED_HUGE_BODY ".repeat(2000) };
for (const [p, t] of Object.entries(original)) fs.writeFileSync(path.join(directory, p), t);
const calls = [];
let turn = 0;
let worker;
const streamFn = createBackgroundStream({ complete: async (activeModel, context, options) => {
	assert.equal(activeModel.id, model.id);
	assert.equal(options.cacheRetention, "long");
	assert.equal(options.maxTokens, 8192, "Output is bounded per tool turn, independently of the resident budget");
	calls.push({ messages: structuredClone(context.messages), sessionId: options.sessionId });
	turn++;
	if (turn === 1) {
		assert(JSON.stringify(context.messages).includes("Paperclip Memory Organization"));
		assert(!JSON.stringify(context.messages).includes("UNCHANGED_HUGE_BODY"));
		return response([toolCall("memory_read", { path: "USER.md" })]);
	}
	if (turn === 2) {
		assert(context.messages.at(-1).content[0].text.includes("Address preference unknown"));
		return response([toolCall("memory_edit", { path: "USER.md", oldText: "Address preference unknown.", newText: "Use Casey; do not address by real name." })]);
	}
	assert.equal(fs.readFileSync(path.join(directory, "USER.md"), "utf8"), "Name: Casey.\nUse Casey; do not address by real name.", "Tools edit live files before the model finishes");
	return response();
} });
try {
	worker = createMemoryOrganizer({ directory, model, streamFn, debounceMs: 60000 });
	worker.enqueue("same-session", [{ id: "u1", role: "user", text: "Do not use my real name." }]);
	await worker.drain();
	assert.equal(worker.status().pending, 0, worker.status().lastError);
	assert.equal(turn, 3, "The existing pi Agent must execute its own tool loop");
	assert.equal(fs.readFileSync(path.join(directory, "MEMORY.md"), "utf8"), original["MEMORY.md"]);
	assert(!fs.existsSync(directory + ".state/current.json"), "No publication pointer");
	assert(!fs.existsSync(directory + ".state/versions"), "No staged tree");
	worker.stop();
	worker = createMemoryOrganizer({ directory, model, streamFn, debounceMs: 60000 });
	worker.enqueue("same-session", [{ id: "u2", role: "user", text: "Thanks" }]);
	await worker.drain();
	assert.equal(worker.status().pending, 0, worker.status().lastError);
	assert.equal(turn, 4);
	assert.equal(JSON.stringify(calls[3].messages.slice(0, calls[2].messages.length)), JSON.stringify(calls[2].messages), "Restart preserves the serialized provider prefix");
	assert(calls.every(call => call.sessionId === calls[0].sessionId));
	assert(calls[3].messages.some(m => m.role === "toolResult" && m.toolName === "memory_edit"));
	assert.equal(fs.readdirSync(directory + ".state/agent-sessions").length, 1, "Private sessions live with Memory state, outside pi history");
	const audits = fs.readdirSync(directory + ".state/completed").filter(x => !x.endsWith(".source.json"));
	assert(audits.some(p => JSON.parse(fs.readFileSync(path.join(directory + ".state/completed", p))).usage.cacheRead === 6000));
	console.log("PASS: native pi Agent tool loop; direct edits; private durable session; cache prefix and usage; no full-tree output or publication");
} finally {
	worker?.stop();
	fs.rmSync(root, { recursive: true, force: true });
}
