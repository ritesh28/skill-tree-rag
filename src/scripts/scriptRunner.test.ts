import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SkillScriptRunner,
  runSkillScript,
  type SpawnPort,
} from "./scriptRunner.js";

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();

  constructor() {
    super();
    this.stdout.setEncoding = vi.fn();
    this.stderr.setEncoding = vi.fn();
  }
}

function createSkillsFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-scripts-"));
  const scriptsDir = path.join(root, "demo", "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(
    path.join(scriptsDir, "ok.js"),
    'console.log("js-ok"); console.error("js-err");',
  );
  fs.writeFileSync(path.join(scriptsDir, "fail.js"), "process.exit(2);");
  fs.writeFileSync(
    path.join(scriptsDir, "ok.ts"),
    'console.log("ts-ok");',
  );
  fs.writeFileSync(
    path.join(scriptsDir, "ok.py"),
    'print("py-ok")',
  );
  fs.writeFileSync(
    path.join(scriptsDir, "draft.TODO.js"),
    'console.log("todo")',
  );
  fs.writeFileSync(path.join(scriptsDir, "notes.txt"), "nope");
  fs.mkdirSync(path.join(scriptsDir, "nested"));
  return root;
}

describe("SkillScriptRunner", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs js/ts/py scripts and returns stdout", async () => {
    const skillsDir = createSkillsFixture();
    tempDirs.push(skillsDir);
    const runner = new SkillScriptRunner({
      skillsDir,
      repoRoot: process.cwd(),
    });

    const js = await runner.run({
      skillId: "demo",
      fileName: "ok.js",
    });
    expect(js.ok).toBe(true);
    expect(js.stdout).toContain("js-ok");
    expect(js.stderr).toContain("js-err");
    expect(js.language).toBe("js");

    const ts = await runner.run({
      skillId: "demo",
      fileName: "scripts/ok.ts",
    });
    expect(ts.ok).toBe(true);
    expect(ts.stdout).toContain("ts-ok");
    expect(ts.language).toBe("ts");

    const py = await runner.run({
      skillId: "demo",
      fileName: "ok.py",
    });
    expect(py.ok).toBe(true);
    expect(py.stdout).toContain("py-ok");
    expect(py.language).toBe("py");
  });

  it("surfaces non-zero exits as structured errors", async () => {
    const skillsDir = createSkillsFixture();
    tempDirs.push(skillsDir);
    const result = await runSkillScript(
      { skillId: "demo", fileName: "fail.js" },
      { skillsDir, repoRoot: process.cwd() },
    );
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.error).toContain("exited with code 2");
  });

  it("rejects invalid ids, names, missing files, TODO scripts, and bad extensions", async () => {
    const skillsDir = createSkillsFixture();
    tempDirs.push(skillsDir);
    const runner = new SkillScriptRunner({ skillsDir });

    await expect(
      runner.run({ skillId: "../x", fileName: "ok.js" }),
    ).resolves.toMatchObject({ error: expect.stringContaining("invalid skill id") });

    await expect(
      runner.run({ skillId: "demo", fileName: "../ok.js" }),
    ).resolves.toMatchObject({
      error: expect.stringContaining("invalid script file name"),
    });

    await expect(
      runner.run({ skillId: "demo", fileName: "missing.js" }),
    ).resolves.toMatchObject({
      error: expect.stringContaining("script not found"),
    });

    await expect(
      runner.run({ skillId: "demo", fileName: "draft.TODO.js" }),
    ).resolves.toMatchObject({
      error: expect.stringContaining("TODO script"),
    });

    await expect(
      runner.run({ skillId: "demo", fileName: "notes.txt" }),
    ).resolves.toMatchObject({
      error: expect.stringContaining("unsupported script extension"),
    });

    await expect(
      runner.run({ skillId: "demo", fileName: "nested" }),
    ).resolves.toMatchObject({
      error: expect.stringMatching(/not a file|unsupported/),
    });
  });

  it("rejects empty skill id and absolute script names", async () => {
    const runner = new SkillScriptRunner({
      skillsDir: "/tmp",
      fsPort: {
        existsSync: () => true,
        statSync: () => ({ isFile: () => true }),
        realpathSync: (p) => p,
      },
    });

    await expect(
      runner.run({ skillId: "  ", fileName: "ok.js" }),
    ).resolves.toMatchObject({ error: expect.stringContaining("invalid skill id") });

    await expect(
      runner.run({ skillId: "demo", fileName: "/tmp/x.js" }),
    ).resolves.toMatchObject({
      error: expect.stringContaining("invalid script file name"),
    });
  });

  it("rejects path escape via realpath mismatch", async () => {
    const runner = new SkillScriptRunner({
      skillsDir: "/skills",
      fsPort: {
        existsSync: () => true,
        statSync: () => ({ isFile: () => true }),
        realpathSync: (p) =>
          p.includes("scripts") && p.endsWith("ok.js")
            ? "/elsewhere/ok.js"
            : p,
      },
    });

    await expect(
      runner.run({ skillId: "demo", fileName: "ok.js" }),
    ).resolves.toMatchObject({
      error: expect.stringContaining("escapes skill scripts directory"),
    });
  });

  it("handles realpath sync failures as not found", async () => {
    const runner = new SkillScriptRunner({
      skillsDir: "/skills",
      fsPort: {
        existsSync: () => true,
        statSync: () => ({ isFile: () => true }),
        realpathSync: () => {
          throw new Error("ENOENT");
        },
      },
    });

    await expect(
      runner.run({ skillId: "demo", fileName: "ok.js" }),
    ).resolves.toMatchObject({
      error: expect.stringContaining("script not found"),
    });
  });

  it("times out and kills the child process", async () => {
    const child = new FakeChild();
    const spawnPort: SpawnPort = {
      spawn: vi.fn(() => child as never),
    };
    const runner = new SkillScriptRunner({
      skillsDir: "/skills",
      spawnPort,
      fsPort: {
        existsSync: () => true,
        statSync: () => ({ isFile: () => true }),
        realpathSync: (p) => p,
      },
      pythonExecutable: "python3",
    });

    const pending = runner.run({
      skillId: "demo",
      fileName: "ok.js",
      timeoutMs: 20,
    });

    await new Promise((resolve) => setTimeout(resolve, 40));
    child.emit("close", null);
    const result = await pending;
    expect(result.timedOut).toBe(true);
    expect(result.error).toContain("timed out");
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("captures spawn failures", async () => {
    const spawnPort: SpawnPort = {
      spawn: () => {
        throw new Error("spawn failed");
      },
    };
    const runner = new SkillScriptRunner({
      skillsDir: "/skills",
      spawnPort,
      fsPort: {
        existsSync: () => true,
        statSync: () => ({ isFile: () => true }),
        realpathSync: (p) => p,
      },
    });

    await expect(
      runner.run({ skillId: "demo", fileName: "ok.js" }),
    ).resolves.toMatchObject({ error: "spawn failed" });
  });

  it("captures async child error events", async () => {
    const child = new FakeChild();
    const spawnPort: SpawnPort = {
      spawn: vi.fn(() => child as never),
    };
    const runner = new SkillScriptRunner({
      skillsDir: "/skills",
      spawnPort,
      fsPort: {
        existsSync: () => true,
        statSync: () => ({ isFile: () => true }),
        realpathSync: (p) => p,
      },
    });

    const pending = runner.run({ skillId: "demo", fileName: "ok.js" });
    queueMicrotask(() => child.emit("error", new Error("broken pipe")));
    await expect(pending).resolves.toMatchObject({ error: "broken pipe" });
  });

  it("ignores late child events after settle", async () => {
    const child = new FakeChild();
    const spawnPort: SpawnPort = {
      spawn: vi.fn(() => child as never),
    };
    const runner = new SkillScriptRunner({
      skillsDir: "/skills",
      spawnPort,
      fsPort: {
        existsSync: () => true,
        statSync: () => ({ isFile: () => true }),
        realpathSync: (p) => p,
      },
    });

    const pending = runner.run({
      skillId: "demo",
      fileName: "ok.js",
      timeoutMs: 10,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    child.emit("close", 0);
    const result = await pending;
    expect(result.timedOut).toBe(true);
    child.emit("error", new Error("late"));
    child.emit("close", 1);
  });

  it("resolves venv python for unix and windows, else python3", async () => {
    const seen: string[] = [];
    const child = new FakeChild();
    const spawnPort: SpawnPort = {
      spawn: vi.fn((command: string) => {
        seen.push(command);
        queueMicrotask(() => {
          child.stdout.emit("data", "ok");
          child.emit("close", 0);
        });
        return child as never;
      }),
    };

    const unix = new SkillScriptRunner({
      skillsDir: "/skills",
      repoRoot: "/repo",
      platform: "darwin",
      spawnPort,
      fsPort: {
        existsSync: (p) => p === "/repo/.venv/bin/python" || p.endsWith("ok.py"),
        statSync: () => ({ isFile: () => true }),
        realpathSync: (p) => p,
      },
    });
    await unix.run({ skillId: "demo", fileName: "ok.py" });

    const win = new SkillScriptRunner({
      skillsDir: "/skills",
      repoRoot: "/repo",
      platform: "win32",
      spawnPort,
      fsPort: {
        existsSync: (p) =>
          p === path.join("/repo", ".venv", "Scripts/python.exe") ||
          p.endsWith("ok.py"),
        statSync: () => ({ isFile: () => true }),
        realpathSync: (p) => p,
      },
    });
    await win.run({ skillId: "demo", fileName: "ok.py" });

    const fallback = new SkillScriptRunner({
      skillsDir: "/skills",
      repoRoot: "/repo",
      platform: "darwin",
      spawnPort,
      fsPort: {
        existsSync: (p) => p.endsWith("ok.py"),
        statSync: () => ({ isFile: () => true }),
        realpathSync: (p) => p,
      },
    });
    await fallback.run({ skillId: "demo", fileName: "ok.py" });

    expect(seen[0]).toContain(".venv");
    expect(seen[0]).toContain("bin/python");
    expect(seen[1]).toContain("Scripts/python.exe");
    expect(seen[2]).toBe("python3");
  });

  it("passes args through to the script", async () => {
    const skillsDir = createSkillsFixture();
    tempDirs.push(skillsDir);
    fs.writeFileSync(
      path.join(skillsDir, "demo", "scripts", "echo.js"),
      "console.log(process.argv.slice(2).join('|'));",
    );

    const result = await runSkillScript(
      {
        skillId: "demo",
        fileName: "echo.js",
        args: ["a", "b"],
      },
      { skillsDir, repoRoot: process.cwd() },
    );
    expect(result.stdout.trim()).toBe("a|b");
  });
});
