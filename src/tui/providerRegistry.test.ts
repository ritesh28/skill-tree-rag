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
});
