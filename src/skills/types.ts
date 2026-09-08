import type { SkillFrontmatter } from "./frontmatter.js";
import type { SkillScriptLanguage } from "./paths.js";

export type { AttachType, SkillFrontmatter } from "./frontmatter.js";
export type { SkillScriptLanguage } from "./paths.js";

export type SkillMetadata = SkillFrontmatter["metadata"];

/** Subskill as referenced in markdown, e.g. `subskills/greet.md`. */
export type SkillSubskillRef = {
  path: string;
  content: string;
};

/** Script as referenced in markdown, e.g. `scripts/shout.ts`. */
export type SkillScriptRef = {
  path: string;
  language: SkillScriptLanguage;
  content: string;
};

export type SkillDefinition = {
  /** Skill folder name (stable id) */
  id: string;
  name: string;
  description: string;
  metadata: SkillMetadata;
  /** Full SKILL.md text (frontmatter + body) */
  content: string;
  subskills: SkillSubskillRef[];
  scripts: SkillScriptRef[];
};

export type LoadedSkillFiles = {
  id: string;
  dirAbs: string;
  dirRel: string;
  skillMdPathAbs: string;
  skillMdPathRel: string;
  content: string;
  subskillFiles: { fileName: string; pathAbs: string; pathRel: string }[];
  scriptFiles: {
    fileName: string;
    pathAbs: string;
    pathRel: string;
    language: SkillScriptLanguage;
  }[];
};

export type CheckIssue = {
  skillId: string;
  message: string;
};
