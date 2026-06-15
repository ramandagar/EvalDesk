import { describe, it, expect } from "vitest";
import { createId, formatDuration } from "@/lib/utils";

// Smoke test — proves the Vitest harness + @/ path resolution work end to end.
describe("lib/utils", () => {
  it("createId returns unique 21-char ids", () => {
    const a = createId();
    const b = createId();
    expect(a).toHaveLength(21);
    expect(b).toHaveLength(21);
    expect(a).not.toBe(b);
  });

  it("formatDuration formats sub-second as ms", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formatDuration formats >= 1s with one decimal", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(1500)).toBe("1.5s");
  });
});
