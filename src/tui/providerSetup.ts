import os from "node:os";
import path from "node:path";
import { ProviderConfigStore } from "./providerConfigStore.js";
import { ProviderRegistry } from "./providerRegistry.js";
import { ClackPromptAdapter, type PromptPort } from "./promptPort.js";
import type {
  CredentialFieldSpec,
  ProviderId,
  ProviderSetupResult,
} from "./types.js";

export type EnvPort = {
  get(name: string): string | undefined;
};

const defaultEnv: EnvPort = {
  get: (name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === "" ? undefined : value;
  },
};

export type ProviderSetupDeps = {
  registry?: ProviderRegistry;
  prompts?: PromptPort;
  configStore?: ProviderConfigStore;
  env?: EnvPort;
};

export function defaultProviderConfigPath(): string {
  return path.join(
    os.homedir(),
    ".config",
    "skill-tree-rag",
    "config.json",
  );
}

export class ProviderSetup {
  private readonly registry: ProviderRegistry;
  private readonly prompts: PromptPort;
  private readonly configStore: ProviderConfigStore;
  private readonly env: EnvPort;

  constructor(deps: ProviderSetupDeps = {}) {
    this.registry = deps.registry ?? new ProviderRegistry();
    this.prompts = deps.prompts ?? new ClackPromptAdapter();
    this.configStore =
      deps.configStore ??
      new ProviderConfigStore(defaultProviderConfigPath());
    this.env = deps.env ?? defaultEnv;
  }

  async run(): Promise<ProviderSetupResult> {
    this.prompts.intro("skill-tree-rag — provider setup");

    const saved = this.configStore.load();
    const providerId = await this.promptProvider(saved?.provider);
    const definition = this.registry.get(providerId);

    const credentials: Record<string, string> = {};
    for (const field of definition.fields) {
      credentials[field.key] = await this.resolveCredentialField(
        field,
        saved?.provider === providerId
          ? saved.credentials[field.key]
          : undefined,
      );
    }

    const model = await this.promptModel(
      definition.defaultModel,
      saved?.provider === providerId ? saved.model : undefined,
      providerId === "azure-openai",
    );

    const result: ProviderSetupResult = {
      provider: providerId,
      model,
      credentials,
    };

    this.configStore.save(result);
    this.prompts.outro(
      `Using ${definition.label} / ${model} (saved under ~/.config/skill-tree-rag/)`,
    );
    return result;
  }

  private async promptProvider(
    initialValue?: ProviderId,
  ): Promise<ProviderId> {
    const value = await this.prompts.selectProvider({
      message: "Select a provider",
      options: this.registry.selectOptions(),
      ...(initialValue !== undefined ? { initialValue } : {}),
    });
    return this.requireValue(value, "provider selection cancelled");
  }

  private async resolveCredentialField(
    field: CredentialFieldSpec,
    savedValue: string | undefined,
  ): Promise<string> {
    if (field.envVar) {
      const fromEnv = this.env.get(field.envVar);
      if (fromEnv !== undefined) {
        this.prompts.logInfo(`Using ${field.envVar} from environment`);
        return fromEnv;
      }
    }

    const initialValue = savedValue ?? field.defaultValue;
    if (field.secret) {
      if (initialValue !== undefined && initialValue !== "") {
        this.prompts.logInfo(`Using saved ${field.key} from config`);
        return initialValue;
      }
      const value = await this.prompts.password({ message: field.label });
      const resolved = this.requireValue(value, `${field.key} cancelled`);
      if (resolved.trim() === "") {
        throw new Error(`missing credential: ${field.key}`);
      }
      return resolved.trim();
    }

    const value = await this.prompts.text({
      message: field.label,
      ...(field.defaultValue !== undefined
        ? { placeholder: field.defaultValue, defaultValue: field.defaultValue }
        : {}),
      ...(initialValue !== undefined ? { initialValue } : {}),
    });
    const resolved = this.requireValue(value, `${field.key} cancelled`).trim();
    if (resolved === "") {
      throw new Error(`missing credential: ${field.key}`);
    }
    return resolved;
  }

  private async promptModel(
    defaultModel: string,
    savedModel: string | undefined,
    azureDeployment: boolean,
  ): Promise<string> {
    const initialValue =
      savedModel && savedModel.trim() !== ""
        ? savedModel
        : defaultModel !== ""
          ? defaultModel
          : undefined;

    const value = await this.prompts.text({
      message: azureDeployment
        ? "Azure OpenAI deployment name (model)"
        : "Model id",
      ...(defaultModel !== ""
        ? { placeholder: defaultModel, defaultValue: defaultModel }
        : {}),
      ...(initialValue !== undefined ? { initialValue } : {}),
    });
    const resolved = this.requireValue(value, "model selection cancelled").trim();
    if (resolved === "") {
      throw new Error("missing model");
    }
    return resolved;
  }

  private requireValue<T>(value: T | symbol, cancelMessage: string): T {
    if (this.prompts.isCancel(value)) {
      this.prompts.cancel(cancelMessage);
      throw new Error(cancelMessage);
    }
    return value as T;
  }
}

/** Interactive provider + credentials + model setup for the TUI. */
export async function promptProviderSetup(
  deps: ProviderSetupDeps = {},
): Promise<ProviderSetupResult> {
  return new ProviderSetup(deps).run();
}
