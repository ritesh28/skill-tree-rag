/**
 * Formats durations for TUI display using print-request-timing rules:
 * under 0.5s → ~0s, otherwise ceil to whole seconds.
 */
export class TimingFormatter {
  formatMs(durationMs: number): string {
    if (durationMs < 500) {
      return "~0s";
    }
    return `${Math.ceil(durationMs / 1000)}s`;
  }
}
