import { afterEach, describe, expect, it, vi } from "vitest";
import { BusySpinner } from "./busySpinner.js";

describe("BusySpinner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes frames while active and clears on stop", () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    const spinner = new BusySpinner({
      write: (text) => writes.push(text),
      frames: ["a", "b"],
      intervalMs: 10,
    });

    spinner.start("thinking");
    expect(spinner.isActive).toBe(true);
    expect(writes.some((w) => w.includes("thinking"))).toBe(true);

    vi.advanceTimersByTime(10);
    expect(writes.some((w) => w.includes("b "))).toBe(true);

    spinner.setLabel("thinking");
    expect(writes.at(-1)).toContain("thinking");

    spinner.start("thinking");
    expect(writes.at(-1)).toContain("thinking");

    spinner.stop();
    expect(spinner.isActive).toBe(false);
    expect(writes.at(-1)).toBe("\r\x1b[K");

    spinner.stop();
  });

  it("uses default stderr writer when none provided", () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const spinner = new BusySpinner({
      frames: ["x"],
      intervalMs: 1_000_000,
    });
    spinner.start("Go");
    expect(stderr).toHaveBeenCalled();
    spinner.stop();
    stderr.mockRestore();
  });
});
