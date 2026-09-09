import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { ProviderSetupResult } from "./types.js";

/**
 * Builds a Vercel AI SDK language model from provider setup credentials.
 */
export class ModelFactory {
  create(selection: ProviderSetupResult): LanguageModel {
    const { provider, model, credentials } = selection;

    switch (provider) {
      case "openai":
        return createOpenAI({
          apiKey: this.require(credentials, "apiKey"),
        })(model);
      case "anthropic":
        return createAnthropic({
          apiKey: this.require(credentials, "apiKey"),
        })(model);
      case "google":
        return createGoogleGenerativeAI({
          apiKey: this.require(credentials, "apiKey"),
        })(model);
      case "groq":
        return createGroq({
          apiKey: this.require(credentials, "apiKey"),
        })(model);
      case "mistral":
        return createMistral({
          apiKey: this.require(credentials, "apiKey"),
        })(model);
      case "deepseek":
        return createOpenAICompatible({
          name: "deepseek",
          baseURL: "https://api.deepseek.com/v1",
          apiKey: this.require(credentials, "apiKey"),
        })(model);
      case "openrouter":
        return createOpenAICompatible({
          name: "openrouter",
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: this.require(credentials, "apiKey"),
        })(model);
      case "ollama": {
        const baseUrl = (
          credentials.baseUrl ?? "http://localhost:11434"
        ).replace(/\/$/, "");
        return createOpenAICompatible({
          name: "ollama",
          baseURL: `${baseUrl}/v1`,
          apiKey: "ollama",
        })(model);
      }
      case "azure-openai":
        return createAzure({
          apiKey: this.require(credentials, "apiKey"),
          baseURL: this.require(credentials, "endpoint"),
          ...(credentials.apiVersion
            ? { apiVersion: credentials.apiVersion }
            : {}),
        })(model);
      default: {
        const _exhaustive: never = provider;
        throw new Error(`unsupported provider: ${_exhaustive}`);
      }
    }
  }

  private require(
    credentials: Record<string, string>,
    key: string,
  ): string {
    const value = credentials[key];
    if (value === undefined || value.trim() === "") {
      throw new Error(`missing credential: ${key}`);
    }
    return value;
  }
}
