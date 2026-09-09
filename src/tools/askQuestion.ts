/**
 * Pause/resume contract for `ask_question`.
 * The TUI (plan 07) implements this by prompting the user and resolving the promise.
 */
export type AskQuestionChoice = {
  /** Stable choice id shown to the model/user (A, B, or C for free-form). */
  id: "A" | "B" | "C";
  label: string;
};

export type AskQuestionRequest = {
  question: string;
  choices: AskQuestionChoice[];
  /**
   * When true, choice C is free-form text from the user.
   * Binary questions should set this false and only pass A/B.
   */
  allowFreeform: boolean;
};

export type AskQuestionPort = {
  ask(request: AskQuestionRequest): Promise<string>;
};
