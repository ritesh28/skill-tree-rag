import { describe, expect, it, vi } from "vitest";
import {
  ChatRenderer,
  ConsoleChatOutput,
  type ChatOutputPort,
} from "./chatRenderer.js";

function createOut(): ChatOutputPort & {
  writes: string[];
  lines: string[];
  infos: string[];
  warns: string[];
  errors: string[];
} {
  const writes: string[] = [];
  const lines: string[] = [];
  const infos: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];
  return {
    writes,
    lines,
    infos,
    warns,
    errors,
    write: (text) => writes.push(text),
    writeLine: (text) => lines.push(text),
    info: (message) => infos.push(message),
    warn: (message) => warns.push(message),
    error: (message) => errors.push(message),
  };
}

describe("ChatRenderer", () => {
  it("streams reasoning then text and tool events", () => {
    const out = createOut();
    const renderer = new ChatRenderer(out);
    renderer.beginAssistant();
    renderer.onReasoningDelta("think");
    renderer.onTextDelta("hello");
    renderer.onToolCall("list_skills", {});
    renderer.onToolResult("list_skills", [{ id: "x" }]);
    renderer.onToolError("run_script", { message: "boom" });
    renderer.onError(new Error("nope"));
    renderer.printInterrupted();
    renderer.printTimings([
      {
        id: "1",
        label: "request",
        durationMs: 1200,
        recordedAt: 1,
      },
    ]);
    renderer.printToolSummary([
      {
        id: "t1",
        name: "list_skills",
        args: {},
        status: "completed",
        startedAt: 0,
        endedAt: 400,
      },
    ]);
    renderer.endAssistant();

    expect(out.lines).toContain("reasoning:");
    expect(out.writes).toContain("think");
    expect(out.lines).toContain("assistant:");
    expect(out.writes).toContain("hello");
    expect(out.infos.some((m) => m.includes("tool list_skills"))).toBe(true);
    expect(out.errors.some((m) => m.includes("nope"))).toBe(true);
    expect(out.warns).toContain("interrupted");
    expect(out.infos.some((m) => m.includes("timing request: 2s"))).toBe(true);
  });

  it("compacts circular values without throwing", () => {
    const out = createOut();
    const renderer = new ChatRenderer(out);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    renderer.onToolResult("x", circular);
    expect(out.infos[0]).toContain("tool x →");
  });

  it("ConsoleChatOutput writes to stdout/stderr", () => {
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const out = new ConsoleChatOutput();
    out.write("a");
    out.writeLine("b");
    out.info("i");
    out.warn("w");
    out.error("e");

    expect(stdout).toHaveBeenCalled();
    expect(stderr).toHaveBeenCalled();
    stdout.mockRestore();
    stderr.mockRestore();
  });
});
