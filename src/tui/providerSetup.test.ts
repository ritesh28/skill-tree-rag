import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderConfigStore } from "./providerConfigStore.js";
import { ProviderRegistry } from "./providerRegistry.js";
import {
  ProviderSetup,
  defaultProviderConfigPath,
  promptProviderSetup,
} from "./providerSetup.js";
import type { PromptPort } from "./promptPort.js";
import type { ProviderId, ProviderSetupResult } from "./types.js";

const cancel = Symbol("cancel");

function createPromptMock(overrides: Partial<PromptPort> = {}): PromptPort {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    isCancel: (value) => value === cancel,
    logInfo: vi.fn(),
    selectProvider: vi.fn(),
    text: vi.fn(),
    password: vi.fn(),
    ...overrides,
  };
}

function createConfigStore(saved: ProviderSetupResult | null = null) {
  return {
    load: vi.fn(() => saved),
    save: vi.fn(),
  } as unknown as ProviderConfigStore;
}

describe("defaultProviderConfigPath", () => {
  it("points at ~/.config/skill-tree-rag/config.json", () => {
    expect(defaultProviderConfigPath()).toContain(".config/skill-tree-rag");
    expect(defaultProviderConfigPath()).toContain("config.json");
  });
});

describe("ProviderSetup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("can be constructed with default dependencies", () => {
    expect(() => new ProviderSetup()).not.toThrow();
  });

  it("uses env credentials and saves the result", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("openai"),
      text: vi.fn().mockResolvedValue("gpt-5.6-luna"),
    });
    const configStore = createConfigStore();
    const setup = new ProviderSetup({
      registry: new ProviderRegistry(),
      prompts,
      configStore,
      env: {
        get: (name) => (name === "OPENAI_API_KEY" ? "sk-env" : undefined),
      },
    });

    const result = await setup.run();
    expect(result).toEqual({
      provider: "openai",
      model: "gpt-5.6-luna",
      credentials: { apiKey: "sk-env" },
    });
    expect(prompts.logInfo).toHaveBeenCalledWith(
      "Using OPENAI_API_KEY from environment",
    );
    expect(configStore.save).toHaveBeenCalledWith(result);
  });

  it("reads credentials from process.env via the default env port", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-process");
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("openai"),
      text: vi.fn().mockResolvedValue("gpt-5.6-luna"),
    });
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore(),
    });

    await expect(setup.run()).resolves.toMatchObject({
      credentials: { apiKey: "sk-process" },
    });
  });

  it("ignores blank process.env values", async () => {
    vi.stubEnv("OPENAI_API_KEY", "   ");
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("openai"),
      password: vi.fn().mockResolvedValue("sk-typed"),
      text: vi.fn().mockResolvedValue("gpt-5.6-luna"),
    });
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore(),
    });

    await expect(setup.run()).resolves.toMatchObject({
      credentials: { apiKey: "sk-typed" },
    });
  });

  it("uses saved secret credentials without re-prompting", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("anthropic"),
      text: vi.fn().mockResolvedValue("claude-opus-4-20250514"),
    });
    const saved: ProviderSetupResult = {
      provider: "anthropic",
      model: "claude-opus-4-20250514",
      credentials: { apiKey: "sk-saved" },
    };
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore(saved),
      env: { get: () => undefined },
    });

    const result = await setup.run();
    expect(result.credentials.apiKey).toBe("sk-saved");
    expect(prompts.password).not.toHaveBeenCalled();
    expect(prompts.logInfo).toHaveBeenCalledWith(
      "Using saved apiKey from config",
    );
  });

  it("prompts for ollama base URL and model", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("ollama"),
      text: vi
        .fn()
        .mockResolvedValueOnce("http://127.0.0.1:11434")
        .mockResolvedValueOnce("deepseek-r1"),
    });
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore(),
      env: { get: () => undefined },
    });

    await expect(setup.run()).resolves.toEqual({
      provider: "ollama",
      model: "deepseek-r1",
      credentials: { baseUrl: "http://127.0.0.1:11434" },
    });
  });

  it("prompts password when switching away from a saved provider", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("groq"),
      password: vi.fn().mockResolvedValue("groq-key"),
      text: vi.fn().mockResolvedValue("openai/gpt-oss-120b"),
    });
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore({
        provider: "openai",
        model: "gpt-5.6-luna",
        credentials: { apiKey: "other" },
      }),
      env: { get: () => undefined },
    });

    await expect(setup.run()).resolves.toMatchObject({
      provider: "groq",
      credentials: { apiKey: "groq-key" },
    });
  });

  it("prompts azure deployment name as the model", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("azure-openai"),
      password: vi.fn().mockResolvedValue("azure-key"),
      text: vi
        .fn()
        .mockResolvedValueOnce("https://example.openai.azure.com")
        .mockResolvedValueOnce("2024-10-01-preview")
        .mockResolvedValueOnce("my-deployment"),
    });
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore(),
      env: { get: () => undefined },
    });

    const result = await setup.run();
    expect(result.model).toBe("my-deployment");
    expect(prompts.text).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Azure OpenAI deployment name (model)",
        defaultValue: "gpt-5.6-luna",
      }),
    );
  });

  it("throws when password is empty", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("mistral"),
      password: vi.fn().mockResolvedValue("   "),
    });
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore(),
      env: { get: () => undefined },
    });

    await expect(setup.run()).rejects.toThrow("missing credential: apiKey");
  });

  it("throws when text credential is empty", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("ollama"),
      text: vi.fn().mockResolvedValue("   "),
    });
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore(),
      env: { get: () => undefined },
    });

    await expect(setup.run()).rejects.toThrow("missing credential: baseUrl");
  });

  it("throws when model is empty", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("openai"),
      password: vi.fn().mockResolvedValue("sk"),
      text: vi.fn().mockResolvedValue("  "),
    });
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore(),
      env: { get: () => undefined },
    });

    await expect(setup.run()).rejects.toThrow("missing model");
  });

  it("cancels provider selection", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue(cancel),
    });
    const setup = new ProviderSetup({
      prompts,
      configStore: createConfigStore(),
      env: { get: () => undefined },
    });

    await expect(setup.run()).rejects.toThrow("provider selection cancelled");
    expect(prompts.cancel).toHaveBeenCalled();
  });

  it("cancels credential and model prompts", async () => {
    await expect(
      new ProviderSetup({
        prompts: createPromptMock({
          selectProvider: vi.fn().mockResolvedValue("openai" as ProviderId),
          password: vi.fn().mockResolvedValue(cancel),
        }),
        configStore: createConfigStore(),
        env: { get: () => undefined },
      }).run(),
    ).rejects.toThrow("apiKey cancelled");

    await expect(
      new ProviderSetup({
        prompts: createPromptMock({
          selectProvider: vi.fn().mockResolvedValue("ollama" as ProviderId),
          text: vi.fn().mockResolvedValue(cancel),
        }),
        configStore: createConfigStore(),
        env: { get: () => undefined },
      }).run(),
    ).rejects.toThrow("baseUrl cancelled");

    await expect(
      new ProviderSetup({
        prompts: createPromptMock({
          selectProvider: vi.fn().mockResolvedValue("openai" as ProviderId),
          password: vi.fn().mockResolvedValue("sk"),
          text: vi.fn().mockResolvedValue(cancel),
        }),
        configStore: createConfigStore(),
        env: { get: () => undefined },
      }).run(),
    ).rejects.toThrow("model selection cancelled");
  });

  it("prompts fields that have no env var", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("openai"),
      password: vi.fn().mockResolvedValue("token-value"),
      text: vi.fn().mockResolvedValue("gpt-5.6-luna"),
    });
    const registry = {
      list: () => [],
      selectOptions: () => [{ value: "openai" as const, label: "OpenAI" }],
      get: () => ({
        id: "openai" as const,
        label: "OpenAI",
        defaultModel: "gpt-5.6-luna",
        fields: [{ key: "token", label: "Token", secret: true }],
      }),
    } as unknown as ProviderRegistry;

    const result = await new ProviderSetup({
      registry,
      prompts,
      configStore: createConfigStore(),
      env: { get: () => undefined },
    }).run();

    expect(result.credentials).toEqual({ token: "token-value" });
  });

  it("exposes promptProviderSetup helper", async () => {
    const prompts = createPromptMock({
      selectProvider: vi.fn().mockResolvedValue("deepseek"),
      password: vi.fn().mockResolvedValue("ds-key"),
      text: vi.fn().mockResolvedValue("deepseek-reasoner"),
    });
    const result = await promptProviderSetup({
      prompts,
      configStore: createConfigStore(),
      env: { get: () => undefined },
    });
    expect(result.provider).toBe("deepseek");
  });
});
