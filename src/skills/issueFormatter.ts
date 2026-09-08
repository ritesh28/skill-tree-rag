import type { CheckIssue } from "./types.js";

export class SkillIssueFormatter {
  format(issues: CheckIssue[]): string {
    return issues
      .map((issue) => `  - skills/${issue.skillId}: ${issue.message}`)
      .join("\n");
  }
}
