import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMemoryOrganizer } from "../index.ts";
import { lastJob, model, response, streamFixture, toolCall } from "./agent-fixture.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "extended-memory-recent-"));
const directory = path.join(temp, "MEMORY");
const now = () => new Date("2026-09-27T10:00:00.000Z");
const evidence = [{ id: "u1", role: "user", timestamp: "2026-09-26T23:00:00.000Z", text: "For example: I am on a train to Qingdao." }];
const collectionContext = { hostname: "capture-host", cwd: temp, platform: process.platform };
let calls = 0;
let worker;
try {
	worker = createMemoryOrganizer({ directory, model, now, tokenBudget: 1, debounceMs: 60000, streamFn: streamFixture(context => {
		calls++;
		const system = JSON.stringify(context.messages[0]);
		const prompt = lastJob(context);
		assert.equal(prompt.currentTime, now().toISOString());
		assert.equal(prompt.source.messages[0].timestamp, evidence[0].timestamp);
		assert.equal(prompt.source.messages[0].capturedAt, now().toISOString());
		assert.deepEqual(prompt.source.collectionContext, collectionContext);
		assert(system.includes("人称") && system.includes("来源会话") && system.includes("客观实体名称"));
		assert(system.includes("Recent") && system.includes("最后确认") && system.includes("示例"));
		assert(system.includes("Total resident token budget: 1"));
		if (calls === 1) return response([toolCall("memory_write", { path: "Recent.md", content: "# Recent\nNo confirmed location. The train trip was an example." })]);
		if (calls === 2) return response([toolCall("memory_tokens", {})]);
		assert(JSON.parse(context.messages.at(-1).content[0].text).remaining < 0, "Budget feedback is available to the Agent");
		return response();
	}) });
	worker.enqueue("recent-fixture", evidence, collectionContext);
	await worker.drain();
	assert.equal(worker.status().pending, 0, worker.status().lastError);
	assert(fs.readFileSync(path.join(directory, "Recent.md"), "utf8").includes("example"), "Host does not validate content, mandatory concepts, or token budget before making edits live");
	worker.enqueue("recent-fixture", [{ ...evidence[0], capturedAt: "2026-09-28T00:00:00.000Z" }]);
	await worker.drain();
	assert.equal(calls, 3);
	console.log("PASS: Recent and referent Skill; timestamp provenance; budget tool feedback without host publication/validation");
} finally { worker?.stop(); fs.rmSync(temp, { recursive: true, force: true }); }
