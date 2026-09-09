import { beforeEach, describe, expect, it, vi } from "vitest";

const clackMocks = vi.hoisted(() => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === Symbol.for("cancel")),
  log: { info: vi.fn() },
  select: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
}));

vi.mock("@clack/prompts", () => clackMocks);

import { ClackPromptAdapter } from "./promptPort.js";

describe("ClackPromptAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates intro, outro, cancel, log, and isCancel", () => {
    const prompts = new ClackPromptAdapter();
    prompts.intro("hi");
    prompts.outro("bye");
    prompts.cancel("nope");
    prompts.logInfo("note");
    expect(prompts.isCancel(Symbol.for("cancel"))).toBe(true);
    expect(prompts.isCancel("ok")).toBe(false);
    expect(clackMocks.intro).toHaveBeenCalledWith("hi");
    expect(clackMocks.outro).toHaveBeenCalledWith("bye");
    expect(clackMocks.cancel).toHaveBeenCalledWith("nope");
    expect(clackMocks.log.info).toHaveBeenCalledWith("note");
  });

  it("selects a provider with and without initial value", async () => {
    const prompts = new ClackPromptAdapter();
    clackMocks.select.mockResolvedValueOnce("openai");
    await prompts.selectProvider({
      message: "Select",
      options: [{ value: "openai", label: "OpenAI" }],
    });
    clackMocks.select.mockResolvedValueOnce("ollama");
    await prompts.selectProvider({
      message: "Select",
      options: [{ value: "ollama", label: "Ollama" }],
      initialValue: "ollama",
    });
    expect(clackMocks.select).toHaveBeenCalledTimes(2);
  });

  it("prompts text with optional fields", async () => {
    const prompts = new ClackPromptAdapter();
    clackMocks.text.mockResolvedValue("x");
    await prompts.text({ message: "Model" });
    await prompts.text({
      message: "Model",
      placeholder: "p",
      defaultValue: "d",
      initialValue: "i",
    });
    expect(clackMocks.text).toHaveBeenCalledTimes(2);
  });

  it("prompts password", async () => {
    const prompts = new ClackPromptAdapter();
    clackMocks.password.mockResolvedValue("secret");
    await expect(prompts.password({ message: "Key" })).resolves.toBe("secret");
  });
});
