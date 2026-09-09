import * as clack from "@clack/prompts";
import type { ProviderId } from "./types.js";

export type SelectOption = { value: ProviderId; label: string };

export type PromptPort = {
  intro(message: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  isCancel(value: unknown): boolean;
  logInfo(message: string): void;
  selectProvider(input: {
    message: string;
    options: SelectOption[];
    initialValue?: ProviderId;
  }): Promise<ProviderId | symbol>;
  text(input: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
    initialValue?: string;
  }): Promise<string | symbol>;
  password(input: { message: string }): Promise<string | symbol>;
};

export class ClackPromptAdapter implements PromptPort {
  intro(message: string): void {
    clack.intro(message);
  }

  outro(message: string): void {
    clack.outro(message);
  }

  cancel(message: string): void {
    clack.cancel(message);
  }

  isCancel(value: unknown): boolean {
    return clack.isCancel(value);
  }

  logInfo(message: string): void {
    clack.log.info(message);
  }

  selectProvider(input: {
    message: string;
    options: SelectOption[];
    initialValue?: ProviderId;
  }): Promise<ProviderId | symbol> {
    return clack.select({
      message: input.message,
      options: input.options,
      ...(input.initialValue !== undefined
        ? { initialValue: input.initialValue }
        : {}),
    }) as Promise<ProviderId | symbol>;
  }

  text(input: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
    initialValue?: string;
  }): Promise<string | symbol> {
    return clack.text({
      message: input.message,
      ...(input.placeholder !== undefined
        ? { placeholder: input.placeholder }
        : {}),
      ...(input.defaultValue !== undefined
        ? { defaultValue: input.defaultValue }
        : {}),
      ...(input.initialValue !== undefined
        ? { initialValue: input.initialValue }
        : {}),
    });
  }

  password(input: { message: string }): Promise<string | symbol> {
    return clack.password({
      message: input.message,
    });
  }
}
