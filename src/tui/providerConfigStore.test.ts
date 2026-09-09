import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ProviderConfigStore,
  type FileSystemPort,
} from "./providerConfigStore.js";

function createMemoryFs(
  initial: Record<string, string> = {},
): FileSystemPort & { files: Record<string, string> } {
  const files = { ...initial };
  return {
    files,
    existsSync: (p) => p in files,
    mkdirSync: vi.fn(),
    readFileSync: (p) => {
      const value = files[p];
      if (value === undefined) {
        throw new Error(`ENOENT: ${p}`);
      }
      return value;
    },
    writeFileSync: (p, data) => {
      files[p] = data;
    },
  };
}

describe("ProviderConfigStore", () => {
  const filePath = "/tmp/skill-tree-rag-config.json";

  it("returns null when config file is missing", () => {
    const store = new ProviderConfigStore(filePath, createMemoryFs());
    expect(store.load()).toBeNull();
  });

  it("returns null when JSON is invalid", () => {
    const fsPort = createMemoryFs({ [filePath]: "{not-json" });
    const store = new ProviderConfigStore(filePath, fsPort);
    expect(store.load()).toBeNull();
  });

  it("returns null when schema is invalid", () => {
    const fsPort = createMemoryFs({
      [filePath]: JSON.stringify({ provider: "openai" }),
    });
    const store = new ProviderConfigStore(filePath, fsPort);
    expect(store.load()).toBeNull();
  });

  it("loads and saves config through an injected filesystem", () => {
    const fsPort = createMemoryFs();
    const store = new ProviderConfigStore(filePath, fsPort);
    const result = {
      provider: "openai" as const,
      model: "gpt-4o-mini",
      credentials: { apiKey: "sk-test" },
    };

    store.save(result);
    expect(fsPort.mkdirSync).toHaveBeenCalled();
    expect(store.load()).toEqual(result);

    const loadedCreds = store.load()?.credentials;
    if (!loadedCreds) {
      throw new Error("expected credentials");
    }
    loadedCreds.apiKey = "mutated";
    expect(store.load()?.credentials.apiKey).toBe("sk-test");
  });

  it("uses the real filesystem by default", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-tree-rag-"));
    const filePath = path.join(dir, "config.json");
    try {
      const store = new ProviderConfigStore(filePath);
      expect(store.load()).toBeNull();
      const result = {
        provider: "openai" as const,
        model: "gpt-4o-mini",
        credentials: { apiKey: "sk-disk" },
      };
      store.save(result);
      expect(store.load()).toEqual(result);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
