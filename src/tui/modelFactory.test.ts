import { describe, expect, it } from "vitest";
import { ModelFactory } from "./modelFactory.js";
import type { ProviderId, ProviderSetupResult } from "./types.js";

function selection(
  provider: ProviderId,
  credentials: Record<string, string>,
  model = "test-model",
): ProviderSetupResult {
  return { provider, model, credentials };
}

describe("ModelFactory", () => {
  const factory = new ModelFactory();

  it("creates models for each curated provider", () => {
    const cases: ProviderSetupResult[] = [
      selection("openai", { apiKey: "k" }),
      selection("anthropic", { apiKey: "k" }),
      selection("google", { apiKey: "k" }),
      selection("groq", { apiKey: "k" }),
      selection("mistral", { apiKey: "k" }),
      selection("deepseek", { apiKey: "k" }),
      selection("openrouter", { apiKey: "k" }),
      selection("ollama", { baseUrl: "http://localhost:11434" }),
      selection("ollama", {}),
      selection("azure-openai", {
        apiKey: "k",
        endpoint: "https://example.openai.azure.com",
        apiVersion: "2024-10-01-preview",
      }),
      selection("azure-openai", {
        apiKey: "k",
        endpoint: "https://example.openai.azure.com",
      }),
    ];

    for (const setup of cases) {
      expect(factory.create(setup)).toBeTruthy();
    }
  });

  it("rejects missing credentials", () => {
    expect(() => factory.create(selection("openai", {}))).toThrow(
      /missing credential: apiKey/,
    );
  });
});
