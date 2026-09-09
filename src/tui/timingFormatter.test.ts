import { describe, expect, it } from "vitest";
import { TimingFormatter } from "./timingFormatter.js";

describe("TimingFormatter", () => {
  const formatter = new TimingFormatter();

  it("formats under 500ms as briefly", () => {
    expect(formatter.formatMs(0)).toBe("briefly");
    expect(formatter.formatMs(499)).toBe("briefly");
  });

  it("ceils to whole seconds at 500ms+", () => {
    expect(formatter.formatMs(500)).toBe("1s");
    expect(formatter.formatMs(1001)).toBe("2s");
    expect(formatter.formatMs(2000)).toBe("2s");
  });
});
