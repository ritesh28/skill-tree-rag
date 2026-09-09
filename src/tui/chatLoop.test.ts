import type { LanguageModel } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createSessionStore } from "../store/sessionStore.js";
import { ChatLoop } from "./chatLoop.js";
import { ChatRenderer } from "./chatRenderer.js";
import type { PromptPort } from "./promptPort.js";

function createPrompts(
  answers: Array<string | symbol>,
): PromptPort {
  const queue = [...answers];
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    isCancel: (value) => value === Symbol.for("cancel"),
    logInfo: vi.fn(),
    selectProvider: vi.fn(),
    text: vi.fn(async () => queue.shift() ?? "/exit"),
    password: vi.fn(),
  };
}

function mockStream(parts: Array<{ type: string; [key: string]: unknown }>) {
  return vi.fn(() => ({
    stream: (async function* () {
      for (const part of parts) {
        yield part;
      }
    })(),
    responseMessages: Promise.resolve([
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
    ]),
  }));
}

describe("ChatLoop", () => {
  const model = {} as LanguageModel;

  it("runs a streamed turn and records think timing on first text", async () => {
    const store = createSessionStore();
    const out = {
      write: vi.fn(),
      agent: vi.fn(),
      writeLine: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const streamTextFn = mockStream([
      { type: "reasoning-delta", text: "r" },
      { type: "text-delta", text: "hello" },
      { type: "tool-call", toolName: "list_skills", input: {} },
      { type: "tool-result", toolName: "list_skills", output: [] },
      { type: "tool-error", toolName: "run_script", error: "nope" },
      { type: "finish", finishReason: "stop" },
    ]);

    const loop = new ChatLoop({
      store,
      model,
      askQuestion: { ask: async () => ["A"] },
      prompts: createPrompts(["/exit"]),
      renderer: new ChatRenderer({
        out,
        onThought: (durationMs) => {
          store.recordTiming({ label: "think", durationMs });
        },
      }),
      streamTextFn: streamTextFn as never,
    });

    await loop.handleTurn("hi there");

    const snap = store.getSnapshot();
    expect(snap.messages.some((m) => m.role === "user")).toBe(true);
    expect(snap.messages.some((m) => m.role === "assistant")).toBe(true);
    expect(snap.timings.some((t) => t.label === "think")).toBe(true);
    expect(out.info).toHaveBeenCalledWith(expect.stringMatching(/^thought /));
    expect(out.agent).toHaveBeenCalledWith("hello");
    expect(streamTextFn).toHaveBeenCalled();
  });

  it("handles abort and error stream parts", async () => {
    const store = createSessionStore();
    const out = {
      write: vi.fn(),
      agent: vi.fn(),
      writeLine: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const abortLoop = new ChatLoop({
      store,
      model,
      askQuestion: { ask: async () => ["A"] },
      renderer: new ChatRenderer(out),
      streamTextFn: mockStream([{ type: "abort" }]) as never,
    });
    await abortLoop.handleTurn("stop");
    expect(out.warn).toHaveBeenCalledWith("interrupted");

    const errorLoop = new ChatLoop({
      store: createSessionStore(),
      model,
      askQuestion: { ask: async () => ["A"] },
      renderer: new ChatRenderer(out),
      streamTextFn: mockStream([
        { type: "error", error: new Error("provider down") },
      ]) as never,
    });
    await errorLoop.handleTurn("again");
    expect(out.error).toHaveBeenCalled();
  });

  it("handles thrown abort errors and exits the run loop", async () => {
    const store = createSessionStore();
    const prompts = createPrompts(["hello", "/exit"]);
    const out = {
      write: vi.fn(),
      agent: vi.fn(),
      writeLine: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    const streamTextFn = vi.fn(() => {
      throw abortError;
    });

    const loop = new ChatLoop({
      store,
      model,
      askQuestion: { ask: async () => ["A"] },
      prompts,
      renderer: new ChatRenderer(out),
      streamTextFn: streamTextFn as never,
    });

    await loop.run();
    expect(out.warn).toHaveBeenCalledWith("interrupted");
    expect(prompts.outro).toHaveBeenCalled();

    const cancelPrompts = createPrompts([Symbol.for("cancel")]);
    const cancelLoop = new ChatLoop({
      store: createSessionStore(),
      model,
      askQuestion: { ask: async () => ["A"] },
      prompts: cancelPrompts,
      renderer: new ChatRenderer(out),
      streamTextFn: mockStream([]) as never,
    });
    await cancelLoop.run();
    expect(cancelPrompts.cancel).toHaveBeenCalled();
  });

  it("reports non-abort stream failures", async () => {
    const store = createSessionStore();
    const out = {
      write: vi.fn(),
      agent: vi.fn(),
      writeLine: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const loop = new ChatLoop({
      store,
      model,
      askQuestion: { ask: async () => ["A"] },
      renderer: new ChatRenderer(out),
      streamTextFn: vi.fn(() => {
        throw new Error("network");
      }) as never,
    });
    await loop.handleTurn("x");
    expect(out.error).toHaveBeenCalledWith("network");
  });

  it("pauses interrupt while ask_question runs", async () => {
    const store = createSessionStore();
    const pause = vi.fn();
    const resume = vi.fn();
    const interrupt = {
      begin: vi.fn(() => new AbortController().signal),
      end: vi.fn(),
      pause,
      resume,
      aborted: false,
      signal: undefined,
    };

    const innerAsk = vi.fn(async () => {
      expect(pause).toHaveBeenCalled();
      return ["A"];
    });

    let askExecute:
      | ((input: unknown, options: unknown) => Promise<unknown>)
      | undefined;

    const streamTextFn = vi.fn(
      (args: {
        tools: {
          ask_question: {
            execute?: (input: unknown, options: unknown) => Promise<unknown>;
          };
        };
      }) => {
        askExecute = args.tools.ask_question.execute;
        return {
          stream: (async function* () {
            yield { type: "text-delta", text: "done" };
          })(),
          responseMessages: Promise.resolve([]),
        };
      },
    );

    const loop = new ChatLoop({
      store,
      model,
      askQuestion: { ask: innerAsk },
      interrupt: interrupt as never,
      renderer: new ChatRenderer({
        write: vi.fn(),
        writeLine: vi.fn(),
        agent: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
      streamTextFn: streamTextFn as never,
    });

    await loop.handleTurn("hi");
    expect(askExecute).toBeTypeOf("function");
    await expect(
      askExecute!(
        {
          questions: [
            {
              question: "Q",
              choices: [
                { id: "A", label: "One" },
                { id: "B", label: "Two" },
              ],
              allowFreeform: false,
            },
          ],
        },
        { toolCallId: "1", messages: [] },
      ),
    ).resolves.toEqual({ answers: ["A"] });
    expect(innerAsk).toHaveBeenCalled();
    expect(resume).toHaveBeenCalled();
  });
});
