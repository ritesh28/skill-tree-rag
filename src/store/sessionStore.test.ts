import { describe, expect, it } from "vitest";
import { SessionStore, createSessionStore } from "./sessionStore.js";

describe("createSessionStore", () => {
  it("returns a SessionStore instance", () => {
    expect(createSessionStore()).toBeInstanceOf(SessionStore);
  });
});

describe("SessionStore", () => {
  it("starts empty", () => {
    const store = createSessionStore();
    expect(store.getSnapshot()).toEqual({
      messages: [],
      toolCalls: [],
      timings: [],
      provider: null,
      interrupted: false,
    });
    expect(store.getProviderSelection()).toBeNull();
    expect(store.isInterrupted()).toBe(false);
  });

  it("appends messages with and without toolCallId", () => {
    const store = createSessionStore();
    const withoutTool = store.appendMessage({
      role: "user",
      content: "hi",
    });
    const withTool = store.appendMessage({
      role: "tool",
      content: "result",
      toolCallId: "tool-1",
    });

    expect(withoutTool.toolCallId).toBeUndefined();
    expect(withTool.toolCallId).toBe("tool-1");
    expect(store.getSnapshot().messages).toHaveLength(2);
  });

  it("records tool calls with default and provided args", () => {
    const store = createSessionStore();
    const withDefaultArgs = store.startToolCall({ name: "list_skills" });
    const withArgs = store.startToolCall({
      name: "run_script",
      args: { path: "scripts/a.ts" },
    });

    expect(withDefaultArgs.args).toEqual({});
    expect(withDefaultArgs.status).toBe("running");
    expect(withArgs.args).toEqual({ path: "scripts/a.ts" });
  });

  it("finishes tool calls with result, error, or neither", () => {
    const store = createSessionStore();
    const completed = store.startToolCall({ name: "a" });
    const failed = store.startToolCall({ name: "b" });
    const cancelled = store.startToolCall({ name: "c" });

    const completedRecord = store.finishToolCall(completed.id, {
      status: "completed",
      result: { ok: true },
    });
    const failedRecord = store.finishToolCall(failed.id, {
      status: "failed",
      error: "boom",
    });
    const cancelledRecord = store.finishToolCall(cancelled.id, {
      status: "cancelled",
    });

    expect(completedRecord.status).toBe("completed");
    expect(completedRecord.result).toEqual({ ok: true });
    expect(completedRecord.endedAt).toEqual(expect.any(Number));
    expect(failedRecord.status).toBe("failed");
    expect(failedRecord.error).toBe("boom");
    expect(cancelledRecord.status).toBe("cancelled");
    expect(cancelledRecord.result).toBeUndefined();
    expect(cancelledRecord.error).toBeUndefined();
  });

  it("throws when finishing an unknown tool call", () => {
    const store = createSessionStore();
    expect(() =>
      store.finishToolCall("missing", { status: "completed" }),
    ).toThrow("unknown tool call id: missing");
  });

  it("records timings with and without toolCallId", () => {
    const store = createSessionStore();
    const plain = store.recordTiming({ label: "request", durationMs: 10 });
    const linked = store.recordTiming({
      label: "tool:a",
      durationMs: 5,
      toolCallId: "tool-1",
    });

    expect(plain.toolCallId).toBeUndefined();
    expect(linked.toolCallId).toBe("tool-1");
    expect(store.getSnapshot().timings).toHaveLength(2);
  });

  it("stores provider selection as a defensive copy", () => {
    const store = createSessionStore();
    const credentials = { apiKey: "secret" };
    store.setProviderSelection({
      provider: "openai",
      model: "gpt-4o-mini",
      credentials,
    });

    credentials.apiKey = "mutated";
    const fromGetter = store.getProviderSelection();
    expect(fromGetter).toEqual({
      provider: "openai",
      model: "gpt-4o-mini",
      credentials: { apiKey: "secret" },
    });

    if (!fromGetter) {
      throw new Error("expected provider");
    }
    fromGetter.credentials.apiKey = "mutated-again";
    expect(store.getProviderSelection()?.credentials.apiKey).toBe("secret");

    const snapshot = store.getSnapshot();
    expect(snapshot.provider?.credentials.apiKey).toBe("secret");
    if (!snapshot.provider) {
      throw new Error("expected snapshot provider");
    }
    snapshot.provider.credentials.apiKey = "snapshot-mutated";
    expect(store.getProviderSelection()?.credentials.apiKey).toBe("secret");
  });

  it("exposes interrupted flag", () => {
    const store = createSessionStore();
    store.setInterrupted(true);
    expect(store.isInterrupted()).toBe(true);
    expect(store.getSnapshot().interrupted).toBe(true);
    store.setInterrupted(false);
    expect(store.isInterrupted()).toBe(false);
  });

  it("returns snapshot copies that do not mutate internal arrays", () => {
    const store = createSessionStore();
    store.appendMessage({ role: "user", content: "x" });
    const snapshot = store.getSnapshot();
    snapshot.messages.push({
      id: "fake",
      role: "assistant",
      content: "y",
      createdAt: 0,
    });
    expect(store.getSnapshot().messages).toHaveLength(1);
  });

  it("resets all session state", () => {
    const store = createSessionStore();
    store.setProviderSelection({
      provider: "ollama",
      model: "llama3",
      credentials: { baseUrl: "http://localhost:11434" },
    });
    store.appendMessage({ role: "user", content: "hi" });
    const tool = store.startToolCall({ name: "list_skills", args: {} });
    store.finishToolCall(tool.id, { status: "completed", result: [] });
    store.recordTiming({
      label: "tool:list_skills",
      durationMs: 3,
      toolCallId: tool.id,
    });
    store.setInterrupted(true);

    store.reset();

    expect(store.getSnapshot()).toEqual({
      messages: [],
      toolCalls: [],
      timings: [],
      provider: null,
      interrupted: false,
    });
    expect(store.getProviderSelection()).toBeNull();
    expect(store.isInterrupted()).toBe(false);
  });
});
