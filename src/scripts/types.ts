import type { SkillScriptLanguage } from "../skills/paths.js";

export type RunSkillScriptInput = {
  /** Skill folder name (e.g. `zip-code-info`) */
  skillId: string;
  /**
   * Script basename or skill-relative path:
   * `get-zip-info.js` or `scripts/get-zip-info.js`
   */
  fileName: string;
  /** Extra argv passed after the script path */
  args?: string[];
  /** Kill the process after this many ms (default 30_000) */
  timeoutMs?: number;
  /** Child process cwd (default: repo root) */
  cwd?: string;
};

export type SkillScriptRunResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Absolute path that was executed (when resolved) */
  scriptPath?: string;
  language?: SkillScriptLanguage;
  durationMs: number;
  /** High-level error when the script could not be started or allowlist failed */
  error?: string;
};
