export type BusySpinnerDeps = {
  write?: (text: string) => void;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  frames?: string[];
  intervalMs?: number;
};

/**
 * In-place spinner on stderr (or injected writer) while the agent is busy.
 */
export class BusySpinner {
  private readonly write: (text: string) => void;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private readonly frames: string[];
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private label = "thinking";
  private active = false;

  constructor(deps: BusySpinnerDeps = {}) {
    this.write = deps.write ?? ((text) => process.stderr.write(text));
    this.setIntervalFn = deps.setIntervalFn ?? setInterval;
    this.clearIntervalFn = deps.clearIntervalFn ?? clearInterval;
    this.frames = deps.frames ?? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    this.intervalMs = deps.intervalMs ?? 80;
  }

  start(label = "thinking"): void {
    this.label = label;
    if (this.active) {
      this.render();
      return;
    }
    this.active = true;
    this.frameIndex = 0;
    this.render();
    this.timer = this.setIntervalFn(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, this.intervalMs);
  }

  setLabel(label: string): void {
    this.label = label;
    if (this.active) {
      this.render();
    }
  }

  stop(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    if (this.timer !== null) {
      this.clearIntervalFn(this.timer);
      this.timer = null;
    }
    this.write("\r\x1b[K");
  }

  get isActive(): boolean {
    return this.active;
  }

  private render(): void {
    const frame = this.frames[this.frameIndex] ?? "•";
    this.write(`\r\x1b[K${frame} ${this.label}`);
  }
}
