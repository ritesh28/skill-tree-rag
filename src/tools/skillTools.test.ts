import { describe, expect, it, vi } from "vitest";
import type { SkillDefinition } from "../skills/types.js";
import { createSessionStore } from "../store/sessionStore.js";
import type { AskQuestionPort } from "./askQuestion.js";
import { SkillToolKit } from "./skillTools.js";

const sampleSkills: SkillDefinition[] = [
  {
    id: "demo-always",
    name: "Demo Always",
    description: "Always attached demo",
    metadata: { attachType: "always", version: "0.1.0" },
    content: "# Demo Always\n\nAlways do this.",
    subskills: [],
    scripts: [],
  },
  {
    id: "demo-ondemand",
    name: "Demo On Demand",
    description: "On-demand demo",
    metadata: { attachType: "on-demand", version: "0.1.0" },
    content: "# Demo On Demand\n\nLoad when needed.",
    subskills: [
      { path: "subskills/hint.md", content: "# Hint\n\nUse me." },
    ],
    scripts: [
      {
        path: "scripts/hello.js",
        language: "js",
        content: 'console.log("hi");',
      },
    ],
  },
];

const noopAsk: AskQuestionPort = {
  ask: async () => "A",
};

async function execTool<T>(
  toolDef: { execute?: (...args: never[]) => unknown },
  input: unknown,
): Promise<T> {
  if (!toolDef.execute) {
    throw new Error("tool has no execute");
  }
  return (await (
    toolDef.execute as (input: unknown, options: unknown) => Promise<T>
  )(input, {
    toolCallId: "test-call",
    messages: [],
  })) as T;
}

describe("SkillToolKit", () => {
  it("list_skills returns id/name/description/attachType and records timing", async () => {
    const store = createSessionStore();
    const tools = new SkillToolKit({
      store,
      skills: sampleSkills,
      askQuestion: noopAsk,
    }).createTools();

    const listed = await execTool<
      Array<{
        id: string;
        name: string;
        description: string;
        attachType: string;
      }>
    >(tools.list_skills, {});

    expect(listed).toEqual([
      {
        id: "demo-always",
        name: "Demo Always",
        description: "Always attached demo",
        attachType: "always",
      },
      {
        id: "demo-ondemand",
        name: "Demo On Demand",
        description: "On-demand demo",
        attachType: "on-demand",
      },
    ]);

    const snap = store.getSnapshot();
    expect(snap.toolCalls).toHaveLength(1);
    expect(snap.toolCalls[0]?.name).toBe("list_skills");
    expect(snap.toolCalls[0]?.status).toBe("completed");
    expect(snap.timings).toHaveLength(1);
    expect(snap.timings[0]?.label).toBe("tool:list_skills");
    expect(snap.timings[0]?.toolCallId).toBe(snap.toolCalls[0]?.id);
  });

  it("get_skill returns skill payload and optionally script content", async () => {
    const store = createSessionStore();
    const tools = new SkillToolKit({
      store,
      skills: sampleSkills,
      askQuestion: noopAsk,
    }).createTools();

    const missing = await execTool<{ ok: false; error: string }>(
      tools.get_skill,
      { skillId: "nope" },
    );
    expect(missing.ok).toBe(false);
    expect(missing.error).toContain("unknown skill");

    const withoutScripts = await execTool<{
      ok: true;
      skill: {
        id: string;
        scripts: Array<{ path: string; content?: string }>;
        subskills: Array<{ path: string }>;
      };
    }>(tools.get_skill, { skillId: "demo-ondemand" });

    expect(withoutScripts.ok).toBe(true);
    expect(withoutScripts.skill.id).toBe("demo-ondemand");
    expect(withoutScripts.skill.subskills[0]?.path).toBe("subskills/hint.md");
    expect(withoutScripts.skill.scripts[0]?.path).toBe("scripts/hello.js");
    expect(withoutScripts.skill.scripts[0]?.content).toBeUndefined();

    const withScripts = await execTool<{
      ok: true;
      skill: { scripts: Array<{ content?: string }> };
    }>(tools.get_skill, {
      skillId: "demo-ondemand",
      includeScriptContent: true,
    });
    expect(withScripts.skill.scripts[0]?.content).toContain("console.log");
  });

  it("run_script delegates to runSkillScript", async () => {
    const store = createSessionStore();
    const runScript = vi.fn().mockResolvedValue({
      ok: true,
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      timedOut: false,
      durationMs: 1,
    });

    const tools = new SkillToolKit({
      store,
      skills: sampleSkills,
      askQuestion: noopAsk,
      runScript,
      scriptRunnerDeps: { skillsDir: "/tmp/skills" },
    }).createTools();

    const result = await execTool<{ ok: boolean; stdout: string }>(
      tools.run_script,
      {
        skillId: "demo-ondemand",
        fileName: "scripts/hello.js",
        args: ["a"],
        timeoutMs: 1000,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.stdout).toBe("ok");
    expect(runScript).toHaveBeenCalledWith(
      {
        skillId: "demo-ondemand",
        fileName: "scripts/hello.js",
        args: ["a"],
        timeoutMs: 1000,
      },
      { skillsDir: "/tmp/skills" },
    );
    expect(store.getSnapshot().toolCalls[0]?.name).toBe("run_script");

    await execTool(tools.run_script, {
      skillId: "demo-ondemand",
      fileName: "hello.js",
    });
    expect(runScript).toHaveBeenLastCalledWith(
      {
        skillId: "demo-ondemand",
        fileName: "hello.js",
      },
      { skillsDir: "/tmp/skills" },
    );
  });

  it("ask_question waits on AskQuestionPort and returns answer", async () => {
    const store = createSessionStore();
    let resolveAsk: ((value: string) => void) | undefined;
    const askQuestion: AskQuestionPort = {
      ask: () =>
        new Promise((resolve) => {
          resolveAsk = resolve;
        }),
    };

    const tools = new SkillToolKit({
      store,
      skills: sampleSkills,
      askQuestion,
    }).createTools();

    const pending = execTool<{ answer: string }>(tools.ask_question, {
      question: "Pick one",
      choices: [
        { id: "A", label: "One" },
        { id: "B", label: "Two" },
      ],
      allowFreeform: false,
    });

    expect(store.getSnapshot().toolCalls[0]?.status).toBe("running");
    resolveAsk?.("B");
    await expect(pending).resolves.toEqual({ answer: "B" });
    expect(store.getSnapshot().toolCalls[0]?.status).toBe("completed");
  });

  it("records failed tool calls when execute throws", async () => {
    const store = createSessionStore();
    const tools = new SkillToolKit({
      store,
      skills: sampleSkills,
      askQuestion: {
        ask: async () => {
          throw new Error("user cancelled");
        },
      },
    }).createTools();

    await expect(
      execTool(tools.ask_question, {
        question: "Pick",
        choices: [
          { id: "A", label: "One" },
          { id: "B", label: "Two" },
        ],
        allowFreeform: false,
      }),
    ).rejects.toThrow("user cancelled");

    const snap = store.getSnapshot();
    expect(snap.toolCalls[0]?.status).toBe("failed");
    expect(snap.toolCalls[0]?.error).toBe("user cancelled");
    expect(snap.timings[0]?.label).toBe("tool:ask_question");
  });

  it("stringifies non-Error failures", async () => {
    const store = createSessionStore();
    const tools = new SkillToolKit({
      store,
      skills: sampleSkills,
      askQuestion: {
        ask: async () => {
          throw "boom";
        },
      },
    }).createTools();

    await expect(
      execTool(tools.ask_question, {
        question: "Pick",
        choices: [
          { id: "A", label: "One" },
          { id: "B", label: "Two" },
        ],
        allowFreeform: false,
      }),
    ).rejects.toBe("boom");

    expect(store.getSnapshot().toolCalls[0]?.error).toBe("boom");
  });
});
