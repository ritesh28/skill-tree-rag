import { describe, expect, it, vi } from "vitest";
import type { SkillDefinition } from "../skills/types.js";
import { createSessionStore } from "../store/sessionStore.js";
import { AgentContext } from "./agentContext.js";
import { SystemPromptBuilder } from "./systemPrompt.js";

const skills: SkillDefinition[] = [
  {
    id: "always-one",
    name: "Always One",
    description: "always",
    metadata: { attachType: "always", version: "0.1.0" },
    content: "# Always\n\nBody.",
    subskills: [],
    scripts: [],
  },
  {
    id: "later",
    name: "Later",
    description: "later",
    metadata: { attachType: "on-demand", version: "0.1.0" },
    content: "# Later\n\nBody.",
    subskills: [],
    scripts: [],
  },
];

describe("AgentContext", () => {
  it("builds system prompt and tools wired to the store", async () => {
    const store = createSessionStore();
    const ask = vi.fn().mockResolvedValue("A");

    const bundle = new AgentContext({
      store,
      askQuestion: { ask },
      skills,
      alwaysAttachedSkills: [skills[0]!],
      systemPromptBuilder: new SystemPromptBuilder({
        basePrompt: "Base prompt.",
      }),
    }).build();

    expect(bundle.system).toContain("Base prompt.");
    expect(bundle.system).toContain("Always One");
    expect(bundle.alwaysAttachedSkills).toHaveLength(1);
    expect(bundle.skills).toHaveLength(2);
    expect(Object.keys(bundle.tools).sort()).toEqual([
      "ask_question",
      "get_skill",
      "list_skills",
      "run_script",
    ]);

    const listed = await (
      bundle.tools.list_skills.execute as (
        input: unknown,
        options: unknown,
      ) => Promise<unknown>
    )({}, { toolCallId: "t1", messages: [] });

    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "always-one" }),
        expect.objectContaining({ id: "later" }),
      ]),
    );
    expect(store.getSnapshot().toolCalls[0]?.name).toBe("list_skills");
  });

  it("defaults to generated skills registry and SystemPromptBuilder", () => {
    const store = createSessionStore();
    const bundle = new AgentContext({
      store,
      askQuestion: { ask: async () => "A" },
    }).build();

    expect(bundle.skills.length).toBeGreaterThan(0);
    expect(bundle.alwaysAttachedSkills.every((s) => s.metadata.attachType === "always")).toBe(
      true,
    );
    expect(bundle.system).toContain("skill-tree-rag");
    expect(bundle.system).toContain("## Always-attached skills");
  });
});
