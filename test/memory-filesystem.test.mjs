import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as memory from "../index.ts";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "memory-filesystem-"));
const directory = path.join(temp, "MEMORY");
const outside = path.join(temp, "outside");
fs.mkdirSync(directory);
fs.mkdirSync(outside);
fs.writeFileSync(path.join(outside, "secret.md"), "not accessible");
try {
	assert.equal(typeof memory.createMemoryTools, "function");
	const tools = memory.createMemoryTools(directory, 50);
	assert(!tools.some(t => /bash|exec|shell/.test(t.name)));
	const run = (name, args) => tools.find(t => t.name === name).execute("test", args);
	await run("memory_write", { path: "USER.md", content: "old preference" });
	await run("memory_edit", { path: "USER.md", oldText: "old", newText: "new" });
	assert.equal(fs.readFileSync(path.join(directory, "USER.md"), "utf8"), "new preference");
	await assert.rejects(run("memory_edit", { path: "USER.md", oldText: "old", newText: "oops" }), /match/i);
	await run("memory_mkdir", { path: "USER" });
	await run("memory_move", { from: "USER.md", to: "USER/USER.md" });
	assert((await run("memory_search", { query: "new preference" })).content[0].text.includes("USER/USER.md"));
	assert((await run("memory_list", {})).content[0].text.includes("USER/USER.md"));
	assert(JSON.parse((await run("memory_tokens", {})).content[0].text).tokens > 0);
	for (const unsafe of ["../outside/secret.md", path.join(outside, "secret.md"), "C:\\outside.md", "\\\\host\\share\\file.md", "USER.md:stream", "USER/../../outside/secret.md"]) {
		await assert.rejects(run("memory_read", { path: unsafe }), /path|scope|outside/i);
		await assert.rejects(run("memory_write", { path: unsafe, content: "escape" }), /path|scope|outside/i);
		await assert.rejects(run("memory_move", { from: "USER/USER.md", to: unsafe }), /path|scope|outside/i);
		await assert.rejects(run("memory_remove", { path: unsafe }), /path|scope|outside/i);
	}
	fs.symlinkSync(outside, path.join(directory, "junction"), process.platform === "win32" ? "junction" : "dir");
	for (const name of ["memory_read", "memory_write", "memory_remove"]) await assert.rejects(run(name, { path: "junction/secret.md", content: "escape" }), /link|scope/i);
	fs.linkSync(path.join(outside, "secret.md"), path.join(directory, "hardlink.md"));
	await assert.rejects(run("memory_write", { path: "hardlink.md", content: "escape" }), /link/i);
	await assert.rejects(run("memory_read", { path: "hardlink.md" }), /link/i);
	await assert.rejects(run("memory_remove", { path: "." }), /path|root/i);
	assert.equal(fs.readFileSync(path.join(outside, "secret.md"), "utf8"), "not accessible");
	await run("memory_remove", { path: "USER/USER.md" });
	await run("memory_remove", { path: "USER" });
	console.log("PASS: scoped live filesystem; structural edits; traversal/absolute/ADS/junction/hardlink escapes blocked; tokenizer available");
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
