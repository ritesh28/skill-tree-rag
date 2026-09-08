import fs from "node:fs";
import path from "node:path";
import { SkillFrontmatterParser } from "./frontmatter.js";
import { SkillPaths } from "./paths.js";
import type { LoadedSkillFiles, SkillDefinition } from "./types.js";

export class SkillLoader {
  private readonly frontmatterParser = new SkillFrontmatterParser();

  listSkillIds(): string[] {
    if (!fs.existsSync(SkillPaths.SKILLS_DIR)) {
      return [];
    }

    return fs
      .readdirSync(SkillPaths.SKILLS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }

  /**
   * Load skill file inventory without validating frontmatter.
   * Used by structure/reference checks.
   */
  loadSkillFiles(skillId: string): LoadedSkillFiles {
    const dirAbs = path.join(SkillPaths.SKILLS_DIR, skillId);
    const skillMdPathAbs = path.join(dirAbs, "SKILL.md");

    const content = fs.existsSync(skillMdPathAbs)
      ? fs.readFileSync(skillMdPathAbs, "utf8")
      : "";

    const subskillFiles = this.listFlatFiles(
      path.join(dirAbs, "subskills"),
    ).map((fileName) => {
      const pathAbs = path.join(dirAbs, "subskills", fileName);
      return {
        fileName,
        pathAbs,
        pathRel: SkillPaths.toRepoRelative(pathAbs),
      };
    });

    const scriptFiles = this.listFlatFiles(path.join(dirAbs, "scripts")).flatMap(
      (fileName) => {
        const language = SkillPaths.scriptLanguage(fileName);
        if (!language) {
          return [];
        }
        const pathAbs = path.join(dirAbs, "scripts", fileName);
        return [
          {
            fileName,
            pathAbs,
            pathRel: SkillPaths.toRepoRelative(pathAbs),
            language,
          },
        ];
      },
    );

    return {
      id: skillId,
      dirAbs,
      dirRel: SkillPaths.toRepoRelative(dirAbs),
      skillMdPathAbs,
      skillMdPathRel: SkillPaths.toRepoRelative(skillMdPathAbs),
      content,
      subskillFiles,
      scriptFiles,
    };
  }

  /** Load and parse a skill into the generated SkillDefinition shape. */
  loadSkillDefinition(skillId: string): SkillDefinition {
    const files = this.loadSkillFiles(skillId);
    if (!fs.existsSync(files.skillMdPathAbs)) {
      throw new Error(`skills/${skillId}/SKILL.md: file is missing`);
    }

    const { frontmatter } = this.frontmatterParser.parse(
      files.content,
      skillId,
    );

    return {
      id: skillId,
      name: frontmatter.name,
      description: frontmatter.description,
      metadata: frontmatter.metadata,
      content: files.content,
      subskills: files.subskillFiles
        .filter((file) => !SkillPaths.isSkippedFileName(file.fileName))
        .map((file) => ({
          path: `subskills/${file.fileName}`,
          content: fs.readFileSync(file.pathAbs, "utf8"),
        })),
      scripts: files.scriptFiles
        .filter((file) => !SkillPaths.isSkippedFileName(file.fileName))
        .map((file) => ({
          path: `scripts/${file.fileName}`,
          language: file.language,
          content: fs.readFileSync(file.pathAbs, "utf8"),
        })),
    };
  }

  loadAllSkillDefinitions(): SkillDefinition[] {
    return this.listSkillIds().map((id) => this.loadSkillDefinition(id));
  }

  private listFlatFiles(dirAbs: string): string[] {
    if (!fs.existsSync(dirAbs)) {
      return [];
    }

    return fs
      .readdirSync(dirAbs, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  }
}
