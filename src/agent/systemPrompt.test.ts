import { describe, expect, it } from "vitest";
import type { SkillDefinition } from "../skills/types.js";
import { SystemPromptBuilder } from "./systemPrompt.js";

const alwaysSkill: SkillDefinition = {
  id: "timing",
  name: "Timing",
  description: "Report timing",
  metadata: { attachType: "always", version: "0.1.0" },
  content: "# Timing\n\nAlways report seconds.",
  subskills: [],
  scripts: [],
};

describe("SystemPromptBuilder", () => {
  it("builds base + always-attached + on-demand hint", () => {
    const builder = new SystemPromptBuilder({
      basePrompt: "# System prompt\n\nYou are helpful.",
    });
    const prompt = builder.build([alwaysSkill]);

    expect(prompt).toContain("# System prompt");
    expect(prompt).toContain("## Always-attached skills");
    expect(prompt).toContain("### Timing (`timing`)");
    expect(prompt).toContain("Always report seconds.");
    expect(prompt).toContain("## On-demand skills");
    expect(prompt).toContain("list_skills");
  });

  it("omits always section body when none attached", () => {
    const builder = new SystemPromptBuilder({
      basePrompt: "Base only.",
    });
    const prompt = builder.build([]);
    expect(prompt).toContain("Base only.");
    expect(prompt).not.toContain("## Always-attached skills");
    expect(prompt).toContain("## On-demand skills");
  });

  it("loads default system-prompt.md from disk", () => {
    const prompt = new SystemPromptBuilder().build([]);
    expect(prompt).toContain("skill-tree-rag");
    expect(prompt).toContain("Stay within skills and tools");
  });
});
