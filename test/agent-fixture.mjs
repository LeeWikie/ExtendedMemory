import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

export const model = { id: "fixture", name: "Fixture", api: "openai-responses", provider: "fixture", baseUrl: "https://invalid.example", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 };
export const toolCall = (name, args) => ({ type: "toolCall", id: crypto.randomUUID(), name, arguments: args });
export function response(content = [{ type: "text", text: "Done" }], error) {
	return { role: "assistant", api: model.api, provider: model.provider, model: model.id, content, stopReason: error ? "error" : content.some(x => x.type === "toolCall") ? "toolUse" : "stop", ...(error ? { errorMessage: error } : {}), timestamp: Date.now(), usage: { input: 10, output: 5, cacheRead: 2000, cacheWrite: 0, totalTokens: 2015, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
}
export function streamFixture(handler) {
	return (activeModel, context, options) => {
		const stream = createAssistantMessageEventStream();
		Promise.resolve().then(() => handler(context, options, activeModel)).then(message => {
			if (message.stopReason === "error" || message.stopReason === "aborted") stream.push({ type: "error", reason: message.stopReason, error: message });
			else stream.push({ type: "done", reason: message.stopReason, message });
			stream.end();
		}).catch(error => { const message = response([], String(error)); stream.push({ type: "error", reason: "error", error: message }); stream.end(); });
		return stream;
	};
}
export const lastJob = context => JSON.parse(context.messages.findLast(m => m.role === "user").content[0].text);
