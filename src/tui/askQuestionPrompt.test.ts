import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClackAskQuestion } from "./askQuestionPrompt.js";

const oneQuestion = {
  question: "Pick",
  choices: [
    { id: "A" as const, label: "One" },
    { id: "B" as const, label: "Two" },
  ],
  allowFreeform: false,
};

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

    await expect(ask.ask({ questions: [oneQuestion] })).resolves.toEqual([
      "B: Two",
    ]);
    expect(logInfo).toHaveBeenCalledWith("Agent\nPick");
    expect(text).not.toHaveBeenCalled();
  });

  it("asks a full batch before returning", async () => {
    select.mockResolvedValueOnce("A").mockResolvedValueOnce("B");
    const ask = new ClackAskQuestion({
      select,
      text,
      isCancel,
      cancel,
      logInfo,
    });

    await expect(
      ask.ask({
        questions: [
          oneQuestion,
          {
            question: "Second?",
            choices: [
              { id: "A", label: "Yes" },
              { id: "B", label: "No" },
            ],
            allowFreeform: false,
          },
        ],
      }),
    ).resolves.toEqual(["A: One", "B: No"]);
    expect(logInfo).toHaveBeenCalledWith("Agent\n(1/2) Pick");
    expect(logInfo).toHaveBeenCalledWith("Agent\n(2/2) Second?");
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
        questions: [
          {
            question: "Pick",
            choices: [
              { id: "A", label: "One" },
              { id: "B", label: "Two" },
              { id: "C", label: "Other" },
            ],
            allowFreeform: true,
          },
        ],
      }),
    ).resolves.toEqual(["custom"]);
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

    await expect(ask.ask({ questions: [oneQuestion] })).rejects.toThrow(
      /cancelled/,
    );
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
    const freeformQuestion = {
      question: "Pick",
      choices: [
        { id: "A" as const, label: "One" },
        { id: "B" as const, label: "Two" },
        { id: "C" as const, label: "Other" },
      ],
      allowFreeform: true,
    };

    select.mockResolvedValue("C");
    text.mockResolvedValueOnce(Symbol.for("cancel"));
    await expect(
      ask.ask({ questions: [freeformQuestion] }),
    ).rejects.toThrow(/cancelled/);

    text.mockResolvedValueOnce("   ");
    await expect(
      ask.ask({ questions: [freeformQuestion] }),
    ).rejects.toThrow(/empty/);
  });

  it("throws when questions is empty", async () => {
    const ask = new ClackAskQuestion({
      select,
      text,
      isCancel,
      cancel,
      logInfo,
    });
    await expect(ask.ask({ questions: [] })).rejects.toThrow(/at least one/);
  });
});
