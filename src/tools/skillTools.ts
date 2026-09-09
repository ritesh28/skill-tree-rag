import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../skills/types.js";
import {
  runSkillScript,
  type SkillScriptRunnerDeps,
} from "../scripts/scriptRunner.js";
import type { SessionStore } from "../store/sessionStore.js";
import type { AskQuestionPort } from "./askQuestion.js";

export type SkillToolsDeps = {
  store: SessionStore;
  skills: SkillDefinition[];
  askQuestion: AskQuestionPort;
  runScript?: typeof runSkillScript;
  scriptRunnerDeps?: SkillScriptRunnerDeps;
};

export class SkillToolKit {
  private readonly store: SessionStore;
  private readonly skills: SkillDefinition[];
  private readonly skillsById: Map<string, SkillDefinition>;
  private readonly askQuestion: AskQuestionPort;
  private readonly runScript: typeof runSkillScript;
  private readonly scriptRunnerDeps?: SkillScriptRunnerDeps;

  constructor(deps: SkillToolsDeps) {
    this.store = deps.store;
    this.skills = deps.skills;
    this.skillsById = new Map(deps.skills.map((skill) => [skill.id, skill]));
    this.askQuestion = deps.askQuestion;
    this.runScript = deps.runScript ?? runSkillScript;
    this.scriptRunnerDeps = deps.scriptRunnerDeps;
  }

  createTools() {
    return {
      list_skills: this.listSkillsTool(),
      get_skill: this.getSkillTool(),
      run_script: this.runScriptTool(),
      ask_question: this.askQuestionTool(),
    };
  }

  private listSkillsTool() {
    return tool({
      description:
        "List available skills (id, name, description, attach type). Use before get_skill.",
      inputSchema: z.object({}),
      execute: async () =>
        this.withRecording("list_skills", {}, async () =>
          this.skills.map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            attachType: skill.metadata.attachType,
          })),
        ),
    });
  }

  private getSkillTool() {
    return tool({
      description:
        "Load a skill by id, including SKILL.md content, subskills, and script metadata.",
      inputSchema: z.object({
        skillId: z.string().describe("Skill folder id, e.g. zip-code-info"),
        includeScriptContent: z
          .boolean()
          .optional()
          .describe("When true, include full script source text"),
      }),
      execute: async ({ skillId, includeScriptContent }) =>
        this.withRecording(
          "get_skill",
          { skillId, includeScriptContent: includeScriptContent ?? false },
          async () => {
            const skill = this.skillsById.get(skillId);
            if (!skill) {
              return { ok: false as const, error: `unknown skill id: ${skillId}` };
            }
            return {
              ok: true as const,
              skill: {
                id: skill.id,
                name: skill.name,
                description: skill.description,
                metadata: skill.metadata,
                content: skill.content,
                subskills: skill.subskills,
                scripts: skill.scripts.map((script) => ({
                  path: script.path,
                  language: script.language,
                  ...(includeScriptContent
                    ? { content: script.content }
                    : {}),
                })),
              },
            };
          },
        ),
    });
  }

  private runScriptTool() {
    return tool({
      description:
        "Run a skill script under skills/<skillId>/scripts/. Pass fileName as basename or scripts/[name].",
      inputSchema: z.object({
        skillId: z.string().describe("Skill folder id"),
        fileName: z
          .string()
          .describe("Script file, e.g. get-zip-info.js or scripts/get-zip-info.js"),
        args: z
          .array(z.string())
          .optional()
          .describe("Extra argv passed to the script"),
        timeoutMs: z.number().int().positive().optional(),
      }),
      execute: async ({ skillId, fileName, args, timeoutMs }) =>
        this.withRecording(
          "run_script",
          { skillId, fileName, args: args ?? [], timeoutMs },
          async () =>
            this.runScript(
              {
                skillId,
                fileName,
                ...(args !== undefined ? { args } : {}),
                ...(timeoutMs !== undefined ? { timeoutMs } : {}),
              },
              this.scriptRunnerDeps,
            ),
        ),
    });
  }

  private askQuestionTool() {
    return tool({
      description:
        "Ask the user a clarifying question and wait for their answer. Binary: A/B. More options: top two as A/B plus C free-form when allowFreeform is true.",
      inputSchema: z.object({
        question: z.string().describe("Question to show the user"),
        choices: z
          .array(
            z.object({
              id: z.enum(["A", "B", "C"]),
              label: z.string(),
            }),
          )
          .min(2)
          .max(3),
        allowFreeform: z
          .boolean()
          .describe(
            "If true, include C as free-form text; if false, only A/B binary choice",
          ),
      }),
      execute: async ({ question, choices, allowFreeform }) =>
        this.withRecording(
          "ask_question",
          { question, choices, allowFreeform },
          async () => {
            const answer = await this.askQuestion.ask({
              question,
              choices,
              allowFreeform,
            });
            return { answer };
          },
        ),
    });
  }

  private async withRecording<T>(
    name: string,
    args: unknown,
    execute: () => Promise<T>,
  ): Promise<T> {
    const started = this.store.startToolCall({ name, args });
    const began = Date.now();
    try {
      const result = await execute();
      this.store.finishToolCall(started.id, {
        status: "completed",
        result,
      });
      this.store.recordTiming({
        label: `tool:${name}`,
        durationMs: Date.now() - began,
        toolCallId: started.id,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.finishToolCall(started.id, {
        status: "failed",
        error: message,
      });
      this.store.recordTiming({
        label: `tool:${name}`,
        durationMs: Date.now() - began,
        toolCallId: started.id,
      });
      throw error;
    }
  }
}
