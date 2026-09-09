import {
  stepCountIs,
  streamText,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { AgentContext } from "../agent/agentContext.js";
import type { SessionStore } from "../store/sessionStore.js";
import type { AskQuestionPort } from "../tools/askQuestion.js";
import { ClackAskQuestion } from "./askQuestionPrompt.js";
import { ChatRenderer } from "./chatRenderer.js";
import { GenerationInterrupt } from "./generationInterrupt.js";
import { ClackPromptAdapter, type PromptPort } from "./promptPort.js";

export type StreamTextFn = typeof streamText;

export type ChatLoopDeps = {
  store: SessionStore;
  model: LanguageModel;
  askQuestion?: AskQuestionPort;
  prompts?: PromptPort;
  renderer?: ChatRenderer;
  interrupt?: GenerationInterrupt;
  streamTextFn?: StreamTextFn;
  maxSteps?: number;
};

/**
 * Interactive chat: user prompts → streamText with skills tools → render UX.
 */
export class ChatLoop {
  private readonly store: SessionStore;
  private readonly model: LanguageModel;
  private readonly askQuestion: AskQuestionPort;
  private readonly prompts: PromptPort;
  private readonly renderer: ChatRenderer;
  private readonly interrupt: GenerationInterrupt;
  private readonly streamTextFn: StreamTextFn;
  private readonly maxSteps: number;
  private readonly messages: ModelMessage[] = [];

  constructor(deps: ChatLoopDeps) {
    this.store = deps.store;
    this.model = deps.model;
    this.prompts = deps.prompts ?? new ClackPromptAdapter();
    this.renderer =
      deps.renderer ??
      new ChatRenderer({
        onThought: (durationMs) => {
          this.store.recordTiming({ label: "think", durationMs });
        },
      });
    this.interrupt = deps.interrupt ?? new GenerationInterrupt();
    this.streamTextFn = deps.streamTextFn ?? streamText;
    this.maxSteps = deps.maxSteps ?? 20;
    this.askQuestion = this.wrapAskQuestion(
      deps.askQuestion ?? new ClackAskQuestion(),
    );
  }

  async run(): Promise<void> {
    this.prompts.intro("skill-tree-rag — chat (Ctrl+C interrupts a reply; /exit to quit)");

    for (;;) {
      const input = await this.prompts.text({
        message: "You",
        placeholder: "message, or /exit",
      });

      if (this.prompts.isCancel(input)) {
        this.prompts.cancel("bye");
        return;
      }

      const text = String(input).trim();
      if (text === "" || text === "/exit" || text === "/quit") {
        this.prompts.outro("bye");
        return;
      }

      await this.handleTurn(text);
    }
  }

  async handleTurn(userText: string): Promise<void> {
    this.store.setInterrupted(false);
    this.store.appendMessage({ role: "user", content: userText });
    this.messages.push({ role: "user", content: userText });

    const agent = new AgentContext({
      store: this.store,
      askQuestion: this.askQuestion,
    }).build();

    const started = Date.now();

    const signal = this.interrupt.begin(() => {
      this.store.setInterrupted(true);
    });

    this.renderer.beginAssistant();
    let assistantText = "";

    try {
      const result = this.streamTextFn({
        model: this.model,
        system: agent.system,
        messages: this.messages,
        tools: agent.tools,
        stopWhen: stepCountIs(this.maxSteps),
        abortSignal: signal,
      });

      for await (const part of result.stream) {
        switch (part.type) {
          case "reasoning-delta":
            this.renderer.onReasoningDelta(part.text);
            break;
          case "text-delta":
            assistantText += part.text;
            this.renderer.onTextDelta(part.text);
            break;
          case "tool-call":
            this.renderer.onToolCall(part.toolName, part.input);
            break;
          case "tool-result":
            this.renderer.onToolResult(part.toolName, part.output);
            break;
          case "tool-error":
            this.renderer.onToolError(part.toolName, part.error);
            break;
          case "error":
            this.renderer.onError(part.error);
            break;
          case "abort":
            this.renderer.printInterrupted();
            break;
          default:
            break;
        }
      }

      this.renderer.endAssistant();

      const responseMessages = await result.responseMessages;
      this.messages.push(...responseMessages);

      if (assistantText.trim() !== "") {
        this.store.appendMessage({
          role: "assistant",
          content: assistantText,
        });
      }

      this.store.recordTiming({
        label: "request",
        durationMs: Date.now() - started,
      });
    } catch (error) {
      this.renderer.endAssistant();
      if (this.isAbortError(error) || this.store.isInterrupted()) {
        this.renderer.printInterrupted();
      } else {
        this.renderer.onError(error);
      }
      this.store.recordTiming({
        label: "request",
        durationMs: Date.now() - started,
      });
    } finally {
      this.interrupt.end();
    }
  }

  private wrapAskQuestion(inner: AskQuestionPort): AskQuestionPort {
    return {
      ask: async (request) => {
        this.renderer.clearThinking();
        this.interrupt.pause();
        try {
          return await inner.ask(request);
        } finally {
          this.interrupt.resume();
        }
      },
    };
  }

  private isAbortError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }
    const name = "name" in error ? String(error.name) : "";
    const message =
      "message" in error ? String((error as { message: unknown }).message) : "";
    return (
      name === "AbortError" ||
      message.toLowerCase().includes("abort") ||
      this.interrupt.aborted
    );
  }
}
