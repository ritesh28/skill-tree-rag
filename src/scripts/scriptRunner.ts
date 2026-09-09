import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import {
  SkillPaths,
  type SkillScriptLanguage,
} from "../skills/paths.js";
import type { RunSkillScriptInput, SkillScriptRunResult } from "./types.js";

type SpawnedProcess = ChildProcessByStdio<null, Readable, Readable>;

export type SpawnPort = {
  spawn(
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      stdio: ["ignore", "pipe", "pipe"];
    },
  ): SpawnedProcess;
};

export type ScriptRunnerFsPort = {
  existsSync(path: string): boolean;
  statSync(path: string): { isFile(): boolean };
  realpathSync(path: string): string;
};

const defaultFs: ScriptRunnerFsPort = {
  existsSync: (p) => fs.existsSync(p),
  statSync: (p) => fs.statSync(p),
  realpathSync: (p) => fs.realpathSync(p),
};

const defaultSpawn: SpawnPort = {
  spawn: (command, args, options) => spawn(command, args, options),
};

function isPathInsideDir(dir: string, target: string): boolean {
  if (target === dir) {
    return true;
  }
  const dirWithSep = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
  return target.startsWith(dirWithSep);
}

export type SkillScriptRunnerDeps = {
  skillsDir?: string;
  repoRoot?: string;
  fsPort?: ScriptRunnerFsPort;
  spawnPort?: SpawnPort;
  nodeExecutable?: string;
  tsxCliPath?: string;
  pythonExecutable?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
};

export class SkillScriptRunner {
  private readonly skillsDir: string;
  private readonly repoRoot: string;
  private readonly fsPort: ScriptRunnerFsPort;
  private readonly spawnPort: SpawnPort;
  private readonly nodeExecutable: string;
  private readonly tsxCliPath: string;
  private readonly pythonExecutable: string;
  private readonly platform: NodeJS.Platform;
  private readonly env: NodeJS.ProcessEnv;

  constructor(deps: SkillScriptRunnerDeps = {}) {
    this.repoRoot = deps.repoRoot ?? SkillPaths.REPO_ROOT;
    this.skillsDir = deps.skillsDir ?? SkillPaths.SKILLS_DIR;
    this.fsPort = deps.fsPort ?? defaultFs;
    this.spawnPort = deps.spawnPort ?? defaultSpawn;
    this.nodeExecutable = deps.nodeExecutable ?? process.execPath;
    this.platform = deps.platform ?? process.platform;
    this.tsxCliPath =
      deps.tsxCliPath ??
      path.join(this.repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
    this.pythonExecutable =
      deps.pythonExecutable ?? this.resolvePythonExecutable();
    this.env = deps.env ?? process.env;
  }

  async run(input: RunSkillScriptInput): Promise<SkillScriptRunResult> {
    const started = Date.now();
    const timeoutMs = input.timeoutMs ?? 30_000;
    const cwd = input.cwd ?? this.repoRoot;

    const resolved = this.resolveScriptPath(input.skillId, input.fileName);
    if (!resolved.ok) {
      return {
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: false,
        durationMs: Date.now() - started,
        error: resolved.error,
      };
    }

    const { scriptPath, language } = resolved;
    const command = this.buildCommand(language, scriptPath, input.args ?? []);

    try {
      const outcome = await this.execute(command, cwd, timeoutMs);
      return {
        ok: outcome.exitCode === 0 && !outcome.timedOut,
        exitCode: outcome.exitCode,
        stdout: outcome.stdout,
        stderr: outcome.stderr,
        timedOut: outcome.timedOut,
        scriptPath,
        language,
        durationMs: Date.now() - started,
        ...(outcome.timedOut
          ? { error: `script timed out after ${timeoutMs}ms` }
          : outcome.exitCode !== 0
            ? {
                error: `script exited with code ${outcome.exitCode ?? "null"}`,
              }
            : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: false,
        scriptPath,
        language,
        durationMs: Date.now() - started,
        error: message,
      };
    }
  }

  private resolveScriptPath(
    skillId: string,
    fileName: string,
  ):
    | { ok: true; scriptPath: string; language: SkillScriptLanguage }
    | { ok: false; error: string } {
    if (skillId.trim() === "" || skillId.includes("..") || path.isAbsolute(skillId)) {
      return { ok: false, error: `invalid skill id: ${skillId}` };
    }

    const normalizedName = fileName.replace(/\\/g, "/").replace(/^scripts\//, "");
    if (
      normalizedName.trim() === "" ||
      normalizedName.includes("..") ||
      normalizedName.includes("/") ||
      path.isAbsolute(normalizedName)
    ) {
      return {
        ok: false,
        error: `invalid script file name: ${fileName}`,
      };
    }

    if (SkillPaths.isSkippedFileName(normalizedName)) {
      return {
        ok: false,
        error: `refusing to run TODO script: ${normalizedName}`,
      };
    }

    const language = SkillPaths.scriptLanguage(normalizedName);
    if (!language) {
      return {
        ok: false,
        error: `unsupported script extension: ${normalizedName}`,
      };
    }

    const scriptsDir = path.resolve(this.skillsDir, skillId, "scripts");
    const candidate = path.resolve(scriptsDir, normalizedName);

    if (!isPathInsideDir(scriptsDir, candidate)) {
      return {
        ok: false,
        error: `script path escapes skill scripts directory: ${fileName}`,
      };
    }

    if (!this.fsPort.existsSync(candidate)) {
      return {
        ok: false,
        error: `script not found: skills/${skillId}/scripts/${normalizedName}`,
      };
    }

    let realScript: string;
    let realScriptsDir: string;
    try {
      realScript = this.fsPort.realpathSync(candidate);
      realScriptsDir = this.fsPort.realpathSync(scriptsDir);
    } catch {
      return {
        ok: false,
        error: `script not found: skills/${skillId}/scripts/${normalizedName}`,
      };
    }

    if (!isPathInsideDir(realScriptsDir, realScript)) {
      return {
        ok: false,
        error: `script path escapes skill scripts directory: ${fileName}`,
      };
    }

    if (!this.fsPort.statSync(realScript).isFile()) {
      return {
        ok: false,
        error: `script is not a file: skills/${skillId}/scripts/${normalizedName}`,
      };
    }

    return { ok: true, scriptPath: realScript, language };
  }

  private buildCommand(
    language: SkillScriptLanguage,
    scriptPath: string,
    args: string[],
  ): { command: string; args: string[] } {
    switch (language) {
      case "js":
        return {
          command: this.nodeExecutable,
          args: [scriptPath, ...args],
        };
      case "ts":
        return {
          command: this.nodeExecutable,
          args: [this.tsxCliPath, scriptPath, ...args],
        };
      case "py":
        return {
          command: this.pythonExecutable,
          args: [scriptPath, ...args],
        };
    }
  }

  private resolvePythonExecutable(): string {
    const venvPython = path.join(
      this.repoRoot,
      ".venv",
      this.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
    if (this.fsPort.existsSync(venvPython)) {
      return venvPython;
    }
    return "python3";
  }

  private execute(
    command: { command: string; args: string[] },
    cwd: string,
    timeoutMs: number,
  ): Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
  }> {
    return new Promise((resolve, reject) => {
      let child: SpawnedProcess;
      try {
        child = this.spawnPort.spawn(command.command, command.args, {
          cwd,
          env: this.env,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        reject(error);
        return;
      }

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          exitCode: code,
          stdout,
          stderr,
          timedOut,
        });
      });
    });
  }
}

export async function runSkillScript(
  input: RunSkillScriptInput,
  deps?: SkillScriptRunnerDeps,
): Promise<SkillScriptRunResult> {
  return new SkillScriptRunner(deps).run(input);
}
