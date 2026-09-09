export const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "mistral",
  "deepseek",
  "openrouter",
  "ollama",
  "azure-openai",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type CredentialFieldSpec = {
  /** Key stored on `credentials` */
  key: string;
  label: string;
  /** Prefer this env var when set */
  envVar?: string;
  /** Mask input when prompting */
  secret?: boolean;
  /** Shown/used when empty */
  defaultValue?: string;
};

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  defaultModel: string;
  fields: CredentialFieldSpec[];
};

/** Result of provider setup — ready for session store / model factory. */
export type ProviderSetupResult = {
  provider: ProviderId;
  model: string;
  credentials: Record<string, string>;
};
