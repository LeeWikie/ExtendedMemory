import { afterEach, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import registerExtension from "../index.js";

const original = process.env.EXTENDED_MEMORY_DIR;
const dirs: string[] = [];
afterEach(() => {
	if (original === undefined) delete process.env.EXTENDED_MEMORY_DIR;
	else process.env.EXTENDED_MEMORY_DIR = original;
	for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

test("resident entry loads all nested files once, exposes no tools, and refreshes for a new session", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extended-memory-test-"));
	dirs.push(dir);
	process.env.EXTENDED_MEMORY_DIR = dir;
	fs.mkdirSync(path.join(dir, "USER"));
	fs.writeFileSync(path.join(dir, "USER", "USER.md"), `# USER\n${"retained text ".repeat(2000)}`);
	fs.writeFileSync(path.join(dir, "IDENTITY.md"), "# IDENTITY\noriginal");
	fs.writeFileSync(path.join(dir, "ignored.json"), "not memory");
	const hooks: Record<string, (...args: any[]) => any> = {};
	const entries: any[] = [];
	const tools: any[] = [];
	registerExtension({
		on: (name: string, handler: any) => {
			hooks[name] = handler;
		},
		registerTool: (tool: any) => tools.push(tool),
		appendEntry: (customType: string, data: any) => entries.push({ type: "custom", customType, data }),
	} as any);
	const ctx = { sessionManager: { getBranch: () => entries }, hasUI: false };
	await hooks.session_start({}, ctx);
	expect(tools).toHaveLength(0);
	const first = await hooks.before_agent_start({ systemPrompt: "base" }, ctx);
	expect(first.systemPrompt).toContain("retained text ".repeat(2000));
	expect(first.systemPrompt).toContain('path="MEMORY/USER/USER.md"');
	expect(first.systemPrompt).not.toContain("not memory");
	fs.writeFileSync(path.join(dir, "IDENTITY.md"), "# IDENTITY\nchanged");
	expect((await hooks.before_agent_start({ systemPrompt: "base" }, ctx)).systemPrompt).toBe(first.systemPrompt);
	await hooks.session_start({}, ctx); // Resume uses the persisted snapshot.
	expect((await hooks.before_agent_start({ systemPrompt: "base" }, ctx)).systemPrompt).toBe(first.systemPrompt);
	entries.length = 0;
	await hooks.session_start({}, ctx);
	expect((await hooks.before_agent_start({ systemPrompt: "base" }, ctx)).systemPrompt).toContain("changed");
});
