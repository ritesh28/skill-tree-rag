import {
  alwaysAttachedSkills,
  skills,
} from "../generated/skills.js";
import type { SkillDefinition } from "../skills/types.js";
import type { SessionStore } from "../store/sessionStore.js";
import type { AskQuestionPort } from "../tools/askQuestion.js";
import { SkillToolKit } from "../tools/skillTools.js";
import { SystemPromptBuilder } from "./systemPrompt.js";

export type AgentContextDeps = {
  store: SessionStore;
  askQuestion: AskQuestionPort;
  skills?: SkillDefinition[];
  alwaysAttachedSkills?: SkillDefinition[];
  systemPromptBuilder?: SystemPromptBuilder;
};

export type AgentContextBundle = {
  system: string;
  tools: ReturnType<SkillToolKit["createTools"]>;
  alwaysAttachedSkills: SkillDefinition[];
  skills: SkillDefinition[];
};

/**
 * Builds the system prompt (base + always-attached skills) and MVP tools
 * wired to the session store and script runner.
 */
export class AgentContext {
  private readonly store: SessionStore;
  private readonly askQuestion: AskQuestionPort;
  private readonly skills: SkillDefinition[];
  private readonly alwaysAttached: SkillDefinition[];
  private readonly systemPromptBuilder: SystemPromptBuilder;

  constructor(deps: AgentContextDeps) {
    this.store = deps.store;
    this.askQuestion = deps.askQuestion;
    this.skills = deps.skills ?? skills;
    this.alwaysAttached = deps.alwaysAttachedSkills ?? alwaysAttachedSkills;
    this.systemPromptBuilder =
      deps.systemPromptBuilder ?? new SystemPromptBuilder();
  }

  build(): AgentContextBundle {
    const tools = new SkillToolKit({
      store: this.store,
      skills: this.skills,
      askQuestion: this.askQuestion,
    }).createTools();

    return {
      system: this.systemPromptBuilder.build(this.alwaysAttached),
      tools,
      alwaysAttachedSkills: this.alwaysAttached,
      skills: this.skills,
    };
  }
}
