/**
 * Installs a temporary SIGINT handler that aborts the current generation.
 * While active, Node will not exit on Ctrl+C (custom listener present).
 */
export class GenerationInterrupt {
  private controller: AbortController | null = null;
  private handler: (() => void) | null = null;
  private onAbort: (() => void) | null = null;

  begin(onAbort?: () => void): AbortSignal {
    this.end();
    this.controller = new AbortController();
    this.onAbort = onAbort ?? null;
    this.handler = () => {
      this.onAbort?.();
      this.controller?.abort();
    };
    process.on("SIGINT", this.handler);
    return this.controller.signal;
  }

  /** Temporarily remove SIGINT while nested prompts (ask_question) run. */
  pause(): void {
    if (this.handler) {
      process.off("SIGINT", this.handler);
    }
  }

  resume(): void {
    if (this.handler && this.controller && !this.controller.signal.aborted) {
      process.on("SIGINT", this.handler);
    }
  }

  end(): void {
    if (this.handler) {
      process.off("SIGINT", this.handler);
    }
    this.handler = null;
    this.controller = null;
    this.onAbort = null;
  }

  get signal(): AbortSignal | undefined {
    return this.controller?.signal;
  }

  get aborted(): boolean {
    return this.controller?.signal.aborted ?? false;
  }
}
