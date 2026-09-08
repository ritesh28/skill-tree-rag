import { SkillFrontmatterCheck } from "./frontmatterCheck.js";
import { SkillIssueFormatter } from "./issueFormatter.js";
import { SkillPaths } from "./paths.js";
import { SkillReferenceCheck } from "./referenceCheck.js";
import { SkillStructureCheck } from "./structureCheck.js";
import { SkillSync } from "./sync.js";
import type { CheckIssue } from "./types.js";

const COMMANDS = [
  "structure-check",
  "reference-check",
  "frontmatter-check",
  "sync",
] as const;

type Command = (typeof COMMANDS)[number];

class SkillCli {
  private readonly issueFormatter = new SkillIssueFormatter();

  run(argv: string[]): void {
    const command = argv[2];
    if (!isCommand(command)) {
      console.error(
        `skill-cli: unknown command "${command ?? ""}"\n` +
          `usage: skill-cli <${COMMANDS.join("|")}>`,
      );
      process.exit(1);
    }

    switch (command) {
      case "structure-check":
        this.runCheck("skill-structure-check", () =>
          new SkillStructureCheck().run(),
        );
        break;
      case "reference-check":
        this.runCheck("skill-reference-check", () =>
          new SkillReferenceCheck().run(),
        );
        break;
      case "frontmatter-check":
        this.runCheck("skill-frontmatter-check", () =>
          new SkillFrontmatterCheck().run(),
        );
        break;
      case "sync":
        this.runSync();
        break;
    }
  }

  private runCheck(label: string, run: () => CheckIssue[]): void {
    const issues = run();
    if (issues.length === 0) {
      console.log(`${label}: ok`);
      process.exit(0);
    }

    console.error(`${label}: failed\n`);
    console.error(this.issueFormatter.format(issues));
    process.exit(1);
  }

  private runSync(): void {
    try {
      const result = new SkillSync().run();
      console.log(
        `skill-sync: wrote ${SkillPaths.toRepoRelative(result.outPath)} (${result.skillCount} skill${result.skillCount === 1 ? "" : "s"})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`skill-sync: failed\n  - ${message}`);
      process.exit(1);
    }
  }
}

function isCommand(value: string | undefined): value is Command {
  return (
    value !== undefined &&
    (COMMANDS as readonly string[]).includes(value)
  );
}

new SkillCli().run(process.argv);
