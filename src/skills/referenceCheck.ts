import fs from "node:fs";
import { SkillLoader } from "./load.js";
import { SkillPaths } from "./paths.js";
import type { CheckIssue } from "./types.js";

export class SkillReferenceCheck {
  private readonly loader = new SkillLoader();

  run(): CheckIssue[] {
    const issues: CheckIssue[] = [];

    for (const skillId of this.loader.listSkillIds()) {
      issues.push(...this.checkSkillReferences(skillId));
    }

    return issues;
  }

  private checkSkillReferences(skillId: string): CheckIssue[] {
    const issues: CheckIssue[] = [];
    const files = this.loader.loadSkillFiles(skillId);

    if (!fs.existsSync(files.skillMdPathAbs)) {
      issues.push({
        skillId,
        message: "SKILL.md is required for reference check",
      });
      return issues;
    }

    const sources: string[] = [files.content];
    for (const sub of files.subskillFiles) {
      sources.push(fs.readFileSync(sub.pathAbs, "utf8"));
    }
    const haystack = sources.join("\n");

    const required = [
      ...files.subskillFiles.map((f) => f.fileName),
      ...files.scriptFiles.map((f) => f.fileName),
    ].filter((fileName) => !SkillPaths.isSkippedFileName(fileName));

    for (const fileName of required) {
      if (!haystack.includes(fileName)) {
        issues.push({
          skillId,
          message: `"${fileName}" is not referenced in SKILL.md or subskills/ (rename to *.TODO.<ext> to skip)`,
        });
      }
    }

    return issues;
  }
}
