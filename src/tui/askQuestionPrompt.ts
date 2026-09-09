import * as clack from "@clack/prompts";
import type {
  AskQuestionItem,
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
 * Prompts every question in the batch before returning.
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

  async ask(request: AskQuestionRequest): Promise<string[]> {
    if (request.questions.length === 0) {
      throw new Error("ask_question requires at least one question");
    }

    const answers: string[] = [];
    const total = request.questions.length;
    for (let index = 0; index < total; index++) {
      const item = request.questions[index]!;
      answers.push(await this.askOne(item, index, total));
    }
    return answers;
  }

  private async askOne(
    item: AskQuestionItem,
    index: number,
    total: number,
  ): Promise<string> {
    const prefix = total > 1 ? `(${index + 1}/${total}) ` : "";
    this.logInfo(`Agent\n${prefix}${item.question}`);

    const options = item.choices.map((choice) => ({
      value: choice.id,
      label: `${choice.id}: ${choice.label}`,
    }));

    const selected = await this.select({
      message: total > 1 ? `Choose an option (${index + 1}/${total})` : "Choose an option",
      options,
    });

    if (this.isCancel(selected)) {
      this.cancel("question cancelled");
      throw new Error("ask_question cancelled");
    }

    const choiceId = selected as "A" | "B" | "C";
    if (choiceId === "C" && item.allowFreeform) {
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

    const match = item.choices.find((choice) => choice.id === choiceId);
    return match ? `${choiceId}: ${match.label}` : choiceId;
  }
}
