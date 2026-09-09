import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "./providerRegistry.js";
import type { ProviderId } from "./types.js";

describe("ProviderRegistry", () => {
  const registry = new ProviderRegistry();

  it("lists curated providers", () => {
    const ids = registry.list().map((provider) => provider.id);
    expect(ids).toEqual([
      "openai",
      "anthropic",
      "google",
      "groq",
      "mistral",
      "deepseek",
      "openrouter",
      "ollama",
      "azure-openai",
    ]);
  });

  it("returns a provider by id", () => {
    expect(registry.get("ollama").fields[0]?.key).toBe("baseUrl");
  });

  it("throws for an unknown provider id", () => {
    expect(() => registry.get("nope" as ProviderId)).toThrow(
      "unknown provider: nope",
    );
  });

  it("builds select options", () => {
    expect(registry.selectOptions()[0]).toEqual({
      value: "openai",
      label: "OpenAI",
    });
  });

  it("defaults to reasoning-oriented models", () => {
    expect(registry.get("openai").defaultModel).toBe("gpt-5.6-luna");
    expect(registry.get("anthropic").defaultModel).toBe(
      "claude-opus-4-20250514",
    );
    expect(registry.get("google").defaultModel).toBe("gemini-2.5-pro");
    expect(registry.get("groq").defaultModel).toBe("openai/gpt-oss-120b");
    expect(registry.get("mistral").defaultModel).toBe(
      "magistral-medium-latest",
    );
    expect(registry.get("deepseek").defaultModel).toBe("deepseek-reasoner");
    expect(registry.get("openrouter").defaultModel).toBe(
      "openai/gpt-5.6-luna",
    );
    expect(registry.get("ollama").defaultModel).toBe("deepseek-r1");
    expect(registry.get("azure-openai").defaultModel).toBe("gpt-5.6-luna");
  });
});
