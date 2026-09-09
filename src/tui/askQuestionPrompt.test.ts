import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClackAskQuestion } from "./askQuestionPrompt.js";

describe("ClackAskQuestion", () => {
  const select = vi.fn();
  const text = vi.fn();
  const isCancel = vi.fn((value: unknown) => value === Symbol.for("cancel"));
  const cancel = vi.fn();
  const logInfo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns A/B choice label", async () => {
    select.mockResolvedValue("B");
    const ask = new ClackAskQuestion({
      select,
      text,
      isCancel,
      cancel,
      logInfo,
    });

    await expect(
      ask.ask({
        question: "Pick",
        choices: [
          { id: "A", label: "One" },
          { id: "B", label: "Two" },
        ],
        allowFreeform: false,
      }),
    ).resolves.toBe("B: Two");
    expect(logInfo).toHaveBeenCalledWith("Pick");
    expect(text).not.toHaveBeenCalled();
  });

  it("prompts free-form when C is selected", async () => {
    select.mockResolvedValue("C");
    text.mockResolvedValue("custom");
    const ask = new ClackAskQuestion({
      select,
      text,
      isCancel,
      cancel,
      logInfo,
    });

    await expect(
      ask.ask({
        question: "Pick",
        choices: [
          { id: "A", label: "One" },
          { id: "B", label: "Two" },
          { id: "C", label: "Other" },
        ],
        allowFreeform: true,
      }),
    ).resolves.toBe("custom");
  });

  it("throws when selection is cancelled", async () => {
    select.mockResolvedValue(Symbol.for("cancel"));
    const ask = new ClackAskQuestion({
      select,
      text,
      isCancel,
      cancel,
      logInfo,
    });

    await expect(
      ask.ask({
        question: "Pick",
        choices: [
          { id: "A", label: "One" },
          { id: "B", label: "Two" },
        ],
        allowFreeform: false,
      }),
    ).rejects.toThrow(/cancelled/);
    expect(cancel).toHaveBeenCalled();
  });

  it("throws when free-form is cancelled or empty", async () => {
    const ask = new ClackAskQuestion({
      select,
      text,
      isCancel,
      cancel,
      logInfo,
    });

    select.mockResolvedValue("C");
    text.mockResolvedValueOnce(Symbol.for("cancel"));
    await expect(
      ask.ask({
        question: "Pick",
        choices: [
          { id: "A", label: "One" },
          { id: "B", label: "Two" },
          { id: "C", label: "Other" },
        ],
        allowFreeform: true,
      }),
    ).rejects.toThrow(/cancelled/);

    text.mockResolvedValueOnce("   ");
    await expect(
      ask.ask({
        question: "Pick",
        choices: [
          { id: "A", label: "One" },
          { id: "B", label: "Two" },
          { id: "C", label: "Other" },
        ],
        allowFreeform: true,
      }),
    ).rejects.toThrow(/empty/);
  });
});
