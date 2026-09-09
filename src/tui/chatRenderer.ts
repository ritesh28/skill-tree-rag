import type { TimingRecord, ToolCallRecord } from "../store/types.js";
import { TimingFormatter } from "./timingFormatter.js";

export type ChatOutputPort = {
  write(text: string): void;
  writeLine(text: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

export class ConsoleChatOutput implements ChatOutputPort {
  write(text: string): void {
    process.stdout.write(text);
  }

  writeLine(text: string): void {
    process.stdout.write(`${text}\n`);
  }

  info(message: string): void {
    process.stderr.write(`ℹ ${message}\n`);
  }

  warn(message: string): void {
    process.stderr.write(`⚠ ${message}\n`);
  }

  error(message: string): void {
    process.stderr.write(`✖ ${message}\n`);
  }
}

/**
 * Renders streaming assistant text, reasoning, tool events, and timings.
 */
export class ChatRenderer {
  private readonly out: ChatOutputPort;
  private readonly timing: TimingFormatter;
  private textOpen = false;
  private reasoningOpen = false;

  constructor(
    out: ChatOutputPort = new ConsoleChatOutput(),
    timing: TimingFormatter = new TimingFormatter(),
  ) {
    this.out = out;
    this.timing = timing;
  }

  beginAssistant(): void {
    this.textOpen = false;
    this.reasoningOpen = false;
  }

  onReasoningDelta(text: string): void {
    if (!this.reasoningOpen) {
      this.closeText();
      this.out.writeLine("reasoning:");
      this.reasoningOpen = true;
    }
    this.out.write(text);
  }

  onTextDelta(text: string): void {
    if (this.reasoningOpen) {
      this.out.writeLine("");
      this.reasoningOpen = false;
    }
    if (!this.textOpen) {
      this.out.writeLine("assistant:");
      this.textOpen = true;
    }
    this.out.write(text);
  }

  onToolCall(name: string, args: unknown): void {
    this.closeStreams();
    this.out.info(`tool ${name}(${this.compact(args)})`);
  }

  onToolResult(name: string, result: unknown): void {
    this.closeStreams();
    this.out.info(`tool ${name} → ${this.compact(result)}`);
  }

  onToolError(name: string, error: unknown): void {
    this.closeStreams();
    this.out.error(`tool ${name} failed: ${this.compact(error)}`);
  }

  onError(error: unknown): void {
    this.closeStreams();
    const message = error instanceof Error ? error.message : String(error);
    this.out.error(message);
  }

  endAssistant(): void {
    this.closeStreams();
  }

  printInterrupted(): void {
    this.closeStreams();
    this.out.warn("interrupted");
  }

  printTimings(timings: TimingRecord[]): void {
    if (timings.length === 0) {
      return;
    }
    for (const timing of timings) {
      this.out.info(
        `timing ${timing.label}: ${this.timing.formatMs(timing.durationMs)}`,
      );
    }
  }

  printToolSummary(toolCalls: ToolCallRecord[]): void {
    for (const call of toolCalls) {
      const duration =
        call.endedAt !== undefined
          ? this.timing.formatMs(call.endedAt - call.startedAt)
          : "?";
      this.out.info(`tool ${call.name} [${call.status}] ${duration}`);
    }
  }

  private closeText(): void {
    if (this.textOpen) {
      this.out.writeLine("");
      this.textOpen = false;
    }
  }

  private closeStreams(): void {
    if (this.reasoningOpen) {
      this.out.writeLine("");
      this.reasoningOpen = false;
    }
    this.closeText();
  }

  private compact(value: unknown): string {
    try {
      const json = JSON.stringify(value);
      if (json === undefined) {
        return String(value);
      }
      return json.length > 240 ? `${json.slice(0, 237)}...` : json;
    } catch {
      return String(value);
    }
  }
}
