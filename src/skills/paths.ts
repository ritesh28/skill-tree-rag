import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const SKILL_SCRIPT_LANGUAGES = ["ts", "js", "py"] as const;

export type SkillScriptLanguage = (typeof SKILL_SCRIPT_LANGUAGES)[number];

export class SkillPaths {
  static readonly REPO_ROOT = path.resolve(here, "../..");

  static readonly SKILLS_DIR = path.join(SkillPaths.REPO_ROOT, "skills");

  static readonly GENERATED_SKILLS_PATH = path.join(
    SkillPaths.REPO_ROOT,
    "src",
    "generated",
    "skills.ts",
  );

  static readonly SCRIPT_LANGUAGES = SKILL_SCRIPT_LANGUAGES;

  static readonly SCRIPT_EXTENSIONS: readonly string[] =
    SKILL_SCRIPT_LANGUAGES.map((language) => `.${language}`);

  private static readonly TODO_FILE_RE = new RegExp(
    `^.+\\.TODO\\.(md|${SKILL_SCRIPT_LANGUAGES.join("|")})$`,
  );

  static toRepoRelative(absolutePath: string): string {
    return path
      .relative(SkillPaths.REPO_ROOT, absolutePath)
      .split(path.sep)
      .join("/");
  }

  static isSkippedFileName(fileName: string): boolean {
    return SkillPaths.TODO_FILE_RE.test(fileName);
  }

  static scriptLanguage(
    fileName: string,
  ): SkillScriptLanguage | undefined {
    const ext = path.extname(fileName).toLowerCase();
    return SKILL_SCRIPT_LANGUAGES.find((language) => `.${language}` === ext);
  }
}
