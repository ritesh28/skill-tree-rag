import * as clack from "@clack/prompts";
import { BusySpinner } from "./busySpinner.js";
import { TimingFormatter } from "./timingFormatter.js";

export type ChatOutputPort = {
  write(text: string): void;
  writeLine(text: string): void;
  /** Clack-style Agent line (blue ●), same shape as ask_question prompts. */
  agent(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

/** Plain stdout/stderr — used in tests. */
export class ConsoleChatOutput implements ChatOutputPort {
  write(text: string): void {
    process.stdout.write(text);
  }

  writeLine(text: string): void {
    process.stdout.write(`${text}\n`);
  }

  agent(message: string): void {
    const lines = message.split("\n");
    process.stdout.write(`●  Agent\n`);
    for (const line of lines) {
      process.stdout.write(`│  ${line}\n`);
    }
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

/** Clack-styled output for the live TUI. */
export class ClackChatOutput implements ChatOutputPort {
  write(text: string): void {
    process.stdout.write(text);
  }

  writeLine(text: string): void {
    process.stdout.write(`${text}\n`);
  }

  agent(message: string): void {
    clack.log.info(`Agent\n${message}`);
  }

  info(message: string): void {
    clack.log.info(message);
  }

  warn(message: string): void {
    clack.log.warn(message);
  }

  error(message: string): void {
    clack.log.error(message);
  }
}

export type ChatRendererDeps = {
  out?: ChatOutputPort;
  timing?: TimingFormatter;
  spinner?: BusySpinner;
  /** Called whenever a thinking period ends and `thought …` is printed. */
  onThought?: (durationMs: number) => void;
};

/**
 * Renders streaming assistant text, reasoning, and thinking spinner/thought lines.
 * Thinking is only for: start of turn, and after the user answers ask_question.
 */
export class ChatRenderer {
  private readonly out: ChatOutputPort;
  private readonly timing: TimingFormatter;
  private readonly spinner: BusySpinner;
  private readonly onThought?: (durationMs: number) => void;
  private textOpen = false;
  private textBuffer = "";
  private reasoningOpen = false;
  private thinkingStartedAt: number | null = null;

  constructor(
    outOrDeps: ChatOutputPort | ChatRendererDeps = {},
    timing?: TimingFormatter,
  ) {
    if (this.isOutputPort(outOrDeps)) {
      this.out = outOrDeps;
      this.timing = timing ?? new TimingFormatter();
      this.spinner = new BusySpinner({ write: () => undefined });
    } else {
      this.out = outOrDeps.out ?? new ClackChatOutput();
      this.timing = outOrDeps.timing ?? new TimingFormatter();
      this.spinner = outOrDeps.spinner ?? new BusySpinner();
      this.onThought = outOrDeps.onThought;
    }
  }

  beginAssistant(): void {
    this.textOpen = false;
    this.textBuffer = "";
    this.reasoningOpen = false;
    this.startThinking();
  }

  /** @deprecated use startThinking / finishThinking / clearThinking */
  startBusy(label = "thinking"): void {
    this.startThinking(label);
  }

  /** @deprecated use finishThinking or clearThinking */
  stopBusy(): void {
    this.clearThinking();
  }

  startThinking(label = "thinking"): void {
    this.thinkingStartedAt = Date.now();
    this.spinner.start(label);
  }

  /** End a thinking period and print `thought …` if one was active. */
  finishThinking(): void {
    if (this.thinkingStartedAt === null) {
      this.spinner.stop();
      return;
    }
    const durationMs = Date.now() - this.thinkingStartedAt;
    this.thinkingStartedAt = null;
    this.spinner.stop();
    this.out.info(`thought ${this.timing.formatMs(durationMs)}`);
    this.onThought?.(durationMs);
  }

  /** Stop spinner without printing a thought line. */
  clearThinking(): void {
    this.thinkingStartedAt = null;
    this.spinner.stop();
  }

  onReasoningDelta(text: string): void {
    this.finishThinking();
    this.flushAgentText();
    if (!this.reasoningOpen) {
      this.out.writeLine("reasoning:");
      this.reasoningOpen = true;
    }
    this.out.write(text);
  }

  onTextDelta(text: string): void {
    this.finishThinking();
    if (this.reasoningOpen) {
      this.out.writeLine("");
      this.reasoningOpen = false;
    }
    this.textOpen = true;
    this.textBuffer += text;
  }

  onToolCall(_name: string, _args: unknown): void {
    this.finishThinking();
    this.closeStreams();
  }

  onToolResult(name: string, _result: unknown): void {
    this.clearThinking();
    this.closeStreams();
    if (name === "ask_question") {
      this.startThinking();
    }
  }

  onToolError(_name: string, _error: unknown): void {
    this.clearThinking();
    this.closeStreams();
  }

  onError(error: unknown): void {
    this.clearThinking();
    this.closeStreams();
    const message = error instanceof Error ? error.message : String(error);
    this.out.error(message);
  }

  endAssistant(): void {
    this.finishThinking();
    this.closeStreams();
  }

  printInterrupted(): void {
    this.clearThinking();
    this.closeStreams();
    this.out.warn("interrupted");
  }

  private flushAgentText(): void {
    if (!this.textOpen) {
      return;
    }
    const message = this.textBuffer.replace(/\s+$/u, "");
    this.textBuffer = "";
    this.textOpen = false;
    if (message.length > 0) {
      this.out.agent(message);
    }
  }

  private isOutputPort(
    value: ChatOutputPort | ChatRendererDeps,
  ): value is ChatOutputPort {
    return (
      typeof (value as ChatOutputPort).write === "function" &&
      typeof (value as ChatOutputPort).writeLine === "function" &&
      typeof (value as ChatOutputPort).agent === "function"
    );
  }

  private closeStreams(): void {
    if (this.reasoningOpen) {
      this.out.writeLine("");
      this.reasoningOpen = false;
    }
    this.flushAgentText();
  }
}
