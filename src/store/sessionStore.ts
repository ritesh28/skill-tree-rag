import { randomUUID } from "node:crypto";
import type {
  AppendMessageInput,
  FinishToolCallInput,
  ProviderSelection,
  RecordTimingInput,
  SessionMessage,
  SessionSnapshot,
  StartToolCallInput,
  TimingRecord,
  ToolCallRecord,
} from "./types.js";

export class SessionStore {
  private messages: SessionMessage[] = [];
  private toolCalls: ToolCallRecord[] = [];
  private timings: TimingRecord[] = [];
  private provider: ProviderSelection | null = null;
  private interrupted = false;

  reset(): void {
    this.messages = [];
    this.toolCalls = [];
    this.timings = [];
    this.provider = null;
    this.interrupted = false;
  }

  getSnapshot(): SessionSnapshot {
    return {
      messages: [...this.messages],
      toolCalls: [...this.toolCalls],
      timings: [...this.timings],
      provider: this.provider
        ? {
            provider: this.provider.provider,
            model: this.provider.model,
            credentials: { ...this.provider.credentials },
          }
        : null,
      interrupted: this.interrupted,
    };
  }

  setProviderSelection(selection: ProviderSelection): void {
    this.provider = {
      provider: selection.provider,
      model: selection.model,
      credentials: { ...selection.credentials },
    };
  }

  getProviderSelection(): ProviderSelection | null {
    if (!this.provider) {
      return null;
    }
    return {
      provider: this.provider.provider,
      model: this.provider.model,
      credentials: { ...this.provider.credentials },
    };
  }

  appendMessage(input: AppendMessageInput): SessionMessage {
    const message: SessionMessage = {
      id: randomUUID(),
      role: input.role,
      content: input.content,
      createdAt: Date.now(),
      ...(input.toolCallId !== undefined
        ? { toolCallId: input.toolCallId }
        : {}),
    };
    this.messages.push(message);
    return message;
  }

  startToolCall(input: StartToolCallInput): ToolCallRecord {
    const record: ToolCallRecord = {
      id: randomUUID(),
      name: input.name,
      args: input.args ?? {},
      status: "running",
      startedAt: Date.now(),
    };
    this.toolCalls.push(record);
    return record;
  }

  finishToolCall(
    toolCallId: string,
    input: FinishToolCallInput,
  ): ToolCallRecord {
    const record = this.requireToolCall(toolCallId);
    record.status = input.status;
    record.endedAt = Date.now();
    if (input.result !== undefined) {
      record.result = input.result;
    }
    if (input.error !== undefined) {
      record.error = input.error;
    }
    return record;
  }

  recordTiming(input: RecordTimingInput): TimingRecord {
    const timing: TimingRecord = {
      id: randomUUID(),
      label: input.label,
      durationMs: input.durationMs,
      recordedAt: Date.now(),
      ...(input.toolCallId !== undefined
        ? { toolCallId: input.toolCallId }
        : {}),
    };
    this.timings.push(timing);
    return timing;
  }

  setInterrupted(interrupted: boolean): void {
    this.interrupted = interrupted;
  }

  isInterrupted(): boolean {
    return this.interrupted;
  }

  private requireToolCall(toolCallId: string): ToolCallRecord {
    const record = this.toolCalls.find((item) => item.id === toolCallId);
    if (!record) {
      throw new Error(`unknown tool call id: ${toolCallId}`);
    }
    return record;
  }
}

export function createSessionStore(): SessionStore {
  return new SessionStore();
}
