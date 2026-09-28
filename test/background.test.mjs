import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMemoryOrganizer } from "../index.ts";
import { lastJob, model, response, streamFixture, toolCall } from "./agent-fixture.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "extended-memory-worker-"));
const directory = path.join(temp, "MEMORY");
fs.mkdirSync(directory);
fs.writeFileSync(path.join(directory, "USER.md"), "original");
let calls = 0;
let phase = "write";
let release;
const streamFn = streamFixture(async (context, options) => {
	calls++;
	if (phase === "write") { phase = "wait"; return response([toolCall("memory_edit", { path: "USER.md", oldText: "original", newText: "live change" })]); }
	if (phase === "wait") {
		await new Promise(resolve => { release = resolve; options.signal.addEventListener("abort", resolve, { once: true }); });
		return response([], "interrupted");
	}
	assert.equal(lastJob(context).retry, true, "Unfinished work resumes with an explicit reread instruction");
	assert.equal(fs.readFileSync(path.join(directory, "USER.md"), "utf8"), "live change");
	return response();
});
const make = () => createMemoryOrganizer({ directory, model, streamFn, debounceMs: 60000, timeoutMs: 2000 });
let worker = make();
let rival;
try {
	worker.enqueue("session-a", [{ id: "u1", role: "user", text: "A correction" }]);
	const running = worker.drain();
	for (let n = 0; n < 100 && !release; n++) await new Promise(r => setTimeout(r, 10));
	assert(release, "Native Agent should reach the second provider request");
	assert.equal(fs.readFileSync(path.join(directory, "USER.md"), "utf8"), "live change", "Foreground does not wait for completion or publication");
	rival = make();
	await rival.drain();
	assert.equal(calls, 2, "Workers sharing MEMORY serialize under a lock");
	rival.stop();
	worker.stop();
	await running;
	assert.equal(worker.status().pending, 1, "Cancellation retains the durable job");
	assert.equal(fs.readFileSync(path.join(directory, "USER.md"), "utf8"), "live change", "No rollback of direct edits");
	phase = "finish";
	worker = make();
	await worker.drain();
	assert.equal(worker.status().pending, 0, worker.status().lastError);
	worker.enqueue("session-a", [{ id: "u1", role: "user", text: "A correction" }]);
	await worker.drain();
	assert.equal(calls, 3, "Source IDs deduplicate across restarts");
	console.log("PASS: asynchronous queue; live edits survive interruption; serialized workers; durable retry and source deduplication");
} finally { worker.stop(); rival?.stop(); fs.rmSync(temp, { recursive: true, force: true }); }
