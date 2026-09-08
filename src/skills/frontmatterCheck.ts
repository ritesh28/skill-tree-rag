import fs from "node:fs";
import { SkillFrontmatterParser } from "./frontmatter.js";
import { SkillLoader } from "./load.js";
import type { CheckIssue } from "./types.js";

export class SkillFrontmatterCheck {
  private readonly loader = new SkillLoader();
  private readonly frontmatterParser = new SkillFrontmatterParser();

  run(): CheckIssue[] {
    const issues: CheckIssue[] = [];

    for (const skillId of this.loader.listSkillIds()) {
      const files = this.loader.loadSkillFiles(skillId);

      if (!fs.existsSync(files.skillMdPathAbs)) {
        issues.push({
          skillId,
          message: "SKILL.md is required",
        });
        continue;
      }

      try {
        this.frontmatterParser.parse(files.content, skillId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const line of message.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const prefix = `skills/${skillId}/SKILL.md: `;
          const prefixAlt = `skills/${skillId}: `;
          let detail = trimmed;
          if (detail.startsWith(prefix)) {
            detail = detail.slice(prefix.length);
          } else if (detail.startsWith(prefixAlt)) {
            detail = detail.slice(prefixAlt.length);
          }
          issues.push({ skillId, message: detail });
        }
      }
    }

    return issues;
  }
}
