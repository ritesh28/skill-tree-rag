import * as clack from "@clack/prompts";
import type {
  AskQuestionPort,
  AskQuestionRequest,
} from "../tools/askQuestion.js";

export type AskQuestionPromptDeps = {
  select?: typeof clack.select;
  text?: typeof clack.text;
  isCancel?: typeof clack.isCancel;
  cancel?: typeof clack.cancel;
  logInfo?: (message: string) => void;
};

/**
 * Clack-backed pause/resume for the `ask_question` tool.
 */
export class ClackAskQuestion implements AskQuestionPort {
  private readonly select: typeof clack.select;
  private readonly text: typeof clack.text;
  private readonly isCancel: typeof clack.isCancel;
  private readonly cancel: typeof clack.cancel;
  private readonly logInfo: (message: string) => void;

  constructor(deps: AskQuestionPromptDeps = {}) {
    this.select = deps.select ?? clack.select;
    this.text = deps.text ?? clack.text;
    this.isCancel = deps.isCancel ?? clack.isCancel;
    this.cancel = deps.cancel ?? clack.cancel;
    this.logInfo = deps.logInfo ?? ((message) => clack.log.info(message));
  }

  async ask(request: AskQuestionRequest): Promise<string> {
    this.logInfo(request.question);

    const options = request.choices.map((choice) => ({
      value: choice.id,
      label: `${choice.id}: ${choice.label}`,
    }));

    const selected = await this.select({
      message: "Choose an option",
      options,
    });

    if (this.isCancel(selected)) {
      this.cancel("question cancelled");
      throw new Error("ask_question cancelled");
    }

    const choiceId = selected as "A" | "B" | "C";
    if (choiceId === "C" && request.allowFreeform) {
      const freeform = await this.text({
        message: "Your answer (C)",
        placeholder: "type freely…",
      });
      if (this.isCancel(freeform)) {
        this.cancel("question cancelled");
        throw new Error("ask_question cancelled");
      }
      const trimmed = String(freeform).trim();
      if (trimmed === "") {
        throw new Error("ask_question free-form answer was empty");
      }
      return trimmed;
    }

    const match = request.choices.find((choice) => choice.id === choiceId);
    return match ? `${choiceId}: ${match.label}` : choiceId;
  }
}
