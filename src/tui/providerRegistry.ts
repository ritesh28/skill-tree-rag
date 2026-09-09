import type { ProviderDefinition, ProviderId } from "./types.js";

const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-5.6-luna",
    fields: [
      {
        key: "apiKey",
        label: "OpenAI API key",
        envVar: "OPENAI_API_KEY",
        secret: true,
      },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-opus-4-20250514",
    fields: [
      {
        key: "apiKey",
        label: "Anthropic API key",
        envVar: "ANTHROPIC_API_KEY",
        secret: true,
      },
    ],
  },
  {
    id: "google",
    label: "Google (Gemini)",
    defaultModel: "gemini-2.5-pro",
    fields: [
      {
        key: "apiKey",
        label: "Google Generative AI API key",
        envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
        secret: true,
      },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    defaultModel: "openai/gpt-oss-120b",
    fields: [
      {
        key: "apiKey",
        label: "Groq API key",
        envVar: "GROQ_API_KEY",
        secret: true,
      },
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    defaultModel: "magistral-medium-latest",
    fields: [
      {
        key: "apiKey",
        label: "Mistral API key",
        envVar: "MISTRAL_API_KEY",
        secret: true,
      },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-reasoner",
    fields: [
      {
        key: "apiKey",
        label: "DeepSeek API key",
        envVar: "DEEPSEEK_API_KEY",
        secret: true,
      },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-5.6-luna",
    fields: [
      {
        key: "apiKey",
        label: "OpenRouter API key",
        envVar: "OPENROUTER_API_KEY",
        secret: true,
      },
    ],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    defaultModel: "deepseek-r1",
    fields: [
      {
        key: "baseUrl",
        label: "Ollama base URL",
        envVar: "OLLAMA_BASE_URL",
        defaultValue: "http://localhost:11434",
      },
    ],
  },
  {
    id: "azure-openai",
    label: "Azure OpenAI",
    defaultModel: "gpt-5.6-luna",
    fields: [
      {
        key: "apiKey",
        label: "Azure OpenAI API key",
        envVar: "AZURE_OPENAI_API_KEY",
        secret: true,
      },
      {
        key: "endpoint",
        label: "Azure OpenAI endpoint",
        envVar: "AZURE_OPENAI_ENDPOINT",
      },
      {
        key: "apiVersion",
        label: "Azure OpenAI API version",
        envVar: "AZURE_OPENAI_API_VERSION",
        defaultValue: "2024-10-01-preview",
      },
    ],
  },
];

export class ProviderRegistry {
  list(): ProviderDefinition[] {
    return [...PROVIDERS];
  }

  get(id: ProviderId): ProviderDefinition {
    const found = PROVIDERS.find((provider) => provider.id === id);
    if (!found) {
      throw new Error(`unknown provider: ${id}`);
    }
    return found;
  }

  selectOptions(): { value: ProviderId; label: string }[] {
    return PROVIDERS.map((provider) => ({
      value: provider.id,
      label: provider.label,
    }));
  }
}
