import { describe, expect, it } from "vitest";
import { diffLineCounts, hasProjectRole } from "./project-access";

describe("project access", () => {
  it("keeps contributors below direct-publish access", () => {
    expect(hasProjectRole("CONTRIBUTOR", "EDITOR")).toBe(false);
    expect(hasProjectRole("EDITOR", "CONTRIBUTOR")).toBe(true);
  });

  it("counts changed lines for revision summaries", () => {
    expect(diffLineCounts("one\ntwo", "one\nthree")).toEqual({
      additions: 1,
      deletions: 1,
    });
  });

  it("counts repeated lines by position instead of treating them as a set", () => {
    expect(diffLineCounts("same\nsame", "same\nchanged")).toEqual({
      additions: 1,
      deletions: 1,
    });
  });
});
