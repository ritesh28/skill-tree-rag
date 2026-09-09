import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { PROVIDER_IDS, type ProviderSetupResult } from "./types.js";

const savedConfigSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  model: z.string().trim().min(1),
  credentials: z.record(z.string(), z.string()),
});

export type FileSystemPort = {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: boolean }): void;
  readFileSync(path: string, encoding: "utf8"): string;
  writeFileSync(path: string, data: string, encoding: "utf8"): void;
};

const defaultFs: FileSystemPort = {
  existsSync: (p) => fs.existsSync(p),
  mkdirSync: (p, options) => {
    fs.mkdirSync(p, options);
  },
  readFileSync: (p, encoding) => fs.readFileSync(p, encoding),
  writeFileSync: (p, data, encoding) => {
    fs.writeFileSync(p, data, encoding);
  },
};

export class ProviderConfigStore {
  private readonly filePath: string;
  private readonly fsPort: FileSystemPort;

  constructor(filePath: string, fsPort: FileSystemPort = defaultFs) {
    this.filePath = filePath;
    this.fsPort = fsPort;
  }

  load(): ProviderSetupResult | null {
    if (!this.fsPort.existsSync(this.filePath)) {
      return null;
    }

    try {
      const raw = JSON.parse(this.fsPort.readFileSync(this.filePath, "utf8"));
      const parsed = savedConfigSchema.safeParse(raw);
      if (!parsed.success) {
        return null;
      }
      return {
        provider: parsed.data.provider,
        model: parsed.data.model,
        credentials: { ...parsed.data.credentials },
      };
    } catch {
      return null;
    }
  }

  save(result: ProviderSetupResult): void {
    const dir = path.dirname(this.filePath);
    this.fsPort.mkdirSync(dir, { recursive: true });
    this.fsPort.writeFileSync(
      this.filePath,
      `${JSON.stringify(
        {
          provider: result.provider,
          model: result.model,
          credentials: result.credentials,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
}
