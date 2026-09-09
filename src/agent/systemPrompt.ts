import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillDefinition } from "../skills/types.js";

const defaultSystemPromptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "system-prompt.md",
);

export type SystemPromptBuilderDeps = {
  basePrompt?: string;
  basePromptPath?: string;
};

export class SystemPromptBuilder {
  private readonly basePrompt: string;

  constructor(deps: SystemPromptBuilderDeps = {}) {
    if (deps.basePrompt !== undefined) {
      this.basePrompt = deps.basePrompt;
      return;
    }
    const promptPath = deps.basePromptPath ?? defaultSystemPromptPath;
    this.basePrompt = fs.readFileSync(promptPath, "utf8");
  }

  build(alwaysAttachedSkills: SkillDefinition[]): string {
    const sections = [this.basePrompt.trimEnd()];

    if (alwaysAttachedSkills.length > 0) {
      const skillBlocks = alwaysAttachedSkills
        .map(
          (skill) =>
            `### ${skill.name} (\`${skill.id}\`)\n\n${skill.content.trim()}`,
        )
        .join("\n\n");
      sections.push(`## Always-attached skills\n\n${skillBlocks}`);
    }

    const onDemandHint =
      "On-demand skills are not inlined here. Use `list_skills` / `get_skill` when needed, then follow that skill’s instructions and `run_script` / `ask_question` as appropriate.";
    sections.push(`## On-demand skills\n\n${onDemandHint}`);

    return `${sections.join("\n\n")}\n`;
  }
}
