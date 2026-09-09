import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationInterrupt } from "./generationInterrupt.js";

describe("GenerationInterrupt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aborts on SIGINT and supports pause/resume", () => {
    const interrupt = new GenerationInterrupt();
    const onAbort = vi.fn();
    const signal = interrupt.begin(onAbort);

    expect(signal.aborted).toBe(false);
    process.emit("SIGINT");
    expect(onAbort).toHaveBeenCalled();
    expect(interrupt.aborted).toBe(true);
    interrupt.end();

    const again = new GenerationInterrupt();
    again.begin();
    again.pause();
    process.emit("SIGINT");
    expect(again.aborted).toBe(false);
    again.resume();
    process.emit("SIGINT");
    expect(again.aborted).toBe(true);
    again.end();
  });
});
