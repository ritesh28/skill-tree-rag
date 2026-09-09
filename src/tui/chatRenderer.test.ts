import { describe, expect, it, vi } from "vitest";
import { BusySpinner } from "./busySpinner.js";
import {
  ChatRenderer,
  ConsoleChatOutput,
  type ChatOutputPort,
} from "./chatRenderer.js";

function createOut(): ChatOutputPort & {
  writes: string[];
  lines: string[];
  agents: string[];
  infos: string[];
  warns: string[];
  errors: string[];
} {
  const writes: string[] = [];
  const lines: string[] = [];
  const agents: string[] = [];
  const infos: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];
  return {
    writes,
    lines,
    agents,
    infos,
    warns,
    errors,
    write: (text) => writes.push(text),
    writeLine: (text) => lines.push(text),
    agent: (message) => agents.push(message),
    info: (message) => infos.push(message),
    warn: (message) => warns.push(message),
    error: (message) => errors.push(message),
  };
}

describe("ChatRenderer", () => {
  it("buffers agent text and prints via agent() label", () => {
    const out = createOut();
    const thoughts: number[] = [];
    const renderer = new ChatRenderer({
      out,
      onThought: (ms) => thoughts.push(ms),
    });
    renderer.beginAssistant();
    renderer.onReasoningDelta("r");
    expect(out.infos.some((m) => m.startsWith("thought "))).toBe(true);
    renderer.onTextDelta("hello");
    renderer.onTextDelta(" world");
    renderer.onToolCall("list_skills", {});
    expect(out.agents).toEqual(["hello world"]);
    renderer.onToolResult("list_skills", [{ id: "x" }]);
    renderer.onToolError("run_script", { message: "boom" });
    renderer.onError(new Error("nope"));
    renderer.printInterrupted();
    renderer.endAssistant();

    expect(out.lines).toContain("reasoning:");
    expect(thoughts).toHaveLength(1);
    expect(out.errors.some((m) => m.includes("nope"))).toBe(true);
    expect(out.warns).toContain("interrupted");
  });

  it("prints thought again after analyzing ask_question answers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00.000Z"));
    const out = createOut();
    const spinner = new BusySpinner({
      write: () => undefined,
      frames: ["*"],
      intervalMs: 1_000_000,
    });
    const renderer = new ChatRenderer({ out, spinner });

    renderer.beginAssistant();
    vi.setSystemTime(new Date("2020-01-01T00:00:02.000Z"));
    renderer.onTextDelta("plan");
    renderer.endAssistant();
    expect(out.infos).toContain("thought 2s");
    expect(out.agents).toEqual(["plan"]);

    renderer.beginAssistant();
    renderer.clearThinking();
    renderer.onToolResult("ask_question", { answers: ["A"] });
    expect(spinner.isActive).toBe(true);

    vi.setSystemTime(new Date("2020-01-01T00:00:02.200Z"));
    renderer.onTextDelta("next");
    renderer.endAssistant();
    expect(out.infos).toContain("thought briefly");
    expect(out.agents).toContain("next");
    expect(spinner.isActive).toBe(false);

    vi.useRealTimers();
  });

  it("does not show thinking spinner during ordinary tools", () => {
    const out = createOut();
    const spinner = new BusySpinner({
      write: () => undefined,
      frames: ["*"],
      intervalMs: 1_000_000,
    });
    const renderer = new ChatRenderer({ out, spinner });

    renderer.beginAssistant();
    renderer.onTextDelta("hi");
    renderer.endAssistant();
    expect(spinner.isActive).toBe(false);

    renderer.onToolCall("run_script", { skillId: "x" });
    expect(spinner.isActive).toBe(false);
    renderer.onToolResult("run_script", { ok: true });
    expect(spinner.isActive).toBe(false);
  });

  it("ConsoleChatOutput formats Agent like Clack", () => {
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const out = new ConsoleChatOutput();
    out.agent("hello\nworld");
    out.write("a");
    out.writeLine("b");
    out.info("i");
    out.warn("w");
    out.error("e");

    expect(stdout).toHaveBeenCalledWith("●  Agent\n");
    expect(stdout).toHaveBeenCalledWith("│  hello\n");
    expect(stdout).toHaveBeenCalledWith("│  world\n");
    expect(stderr).toHaveBeenCalled();
    stdout.mockRestore();
    stderr.mockRestore();
  });
});
