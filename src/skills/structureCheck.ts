import fs from "node:fs";
import path from "node:path";
import { SkillLoader } from "./load.js";
import { SkillPaths } from "./paths.js";
import type { CheckIssue } from "./types.js";

export class SkillStructureCheck {
  private static readonly ALLOWED_TOP_LEVEL = new Set([
    "SKILL.md",
    "subskills",
    "scripts",
  ]);

  private readonly loader = new SkillLoader();

  run(): CheckIssue[] {
    const issues: CheckIssue[] = [];

    if (!fs.existsSync(SkillPaths.SKILLS_DIR)) {
      return issues;
    }

    for (const skillId of this.loader.listSkillIds()) {
      issues.push(...this.checkSkillStructure(skillId));
    }

    return issues;
  }

  private checkSkillStructure(skillId: string): CheckIssue[] {
    const issues: CheckIssue[] = [];
    const dir = path.join(SkillPaths.SKILLS_DIR, skillId);
    const skillMd = path.join(dir, "SKILL.md");

    if (!fs.existsSync(skillMd) || !fs.statSync(skillMd).isFile()) {
      issues.push({
        skillId,
        message: "SKILL.md is required",
      });
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      if (!SkillStructureCheck.ALLOWED_TOP_LEVEL.has(entry.name)) {
        issues.push({
          skillId,
          message: `unexpected top-level entry "${entry.name}" (allowed: SKILL.md, subskills/, scripts/)`,
        });
        continue;
      }

      if (entry.name === "SKILL.md" && !entry.isFile()) {
        issues.push({ skillId, message: "SKILL.md must be a file" });
      }

      if (
        (entry.name === "subskills" || entry.name === "scripts") &&
        !entry.isDirectory()
      ) {
        issues.push({
          skillId,
          message: `${entry.name} must be a directory`,
        });
      }
    }

    issues.push(...this.checkFlatDir(skillId, "subskills", [".md"]));
    issues.push(
      ...this.checkFlatDir(skillId, "scripts", [
        ...SkillPaths.SCRIPT_EXTENSIONS,
      ]),
    );

    return issues;
  }

  private checkFlatDir(
    skillId: string,
    folderName: "subskills" | "scripts",
    allowedExts: string[],
  ): CheckIssue[] {
    const issues: CheckIssue[] = [];
    const dir = path.join(SkillPaths.SKILLS_DIR, skillId, folderName);
    if (!fs.existsSync(dir)) {
      return issues;
    }

    if (!fs.statSync(dir).isDirectory()) {
      return issues;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      if (entry.isDirectory()) {
        issues.push({
          skillId,
          message: `${folderName}/ must be flat; found nested directory "${entry.name}"`,
        });
        continue;
      }

      if (!entry.isFile()) {
        issues.push({
          skillId,
          message: `${folderName}/ contains unsupported entry "${entry.name}"`,
        });
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExts.includes(ext)) {
        issues.push({
          skillId,
          message: `${folderName}/ file "${entry.name}" has invalid extension (allowed: ${allowedExts.join(", ")})`,
        });
      }
    }

    return issues;
  }
}
