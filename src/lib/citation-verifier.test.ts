import { describe, expect, it } from "vitest";
import { verifyAnswerCitations } from "./citation-verifier";

const chunks = [
  {
    id: "1",
    filePath: "src/app.ts",
    directory: "src",
    startLine: 10,
    endLine: 20,
    chunkContent: "",
    similarity: 0.9,
  },
];

describe("verifyAnswerCitations", () => {
  it("accepts citations covered by retrieved chunks", () => {
    expect(
      verifyAnswerCitations(
        "The route is protected [[src/app.ts:12-18]].",
        chunks,
      ),
    ).toMatchObject({ valid: true, missing: false, invalid: [] });
  });

  it("rejects unknown files and uncovered line ranges", () => {
    const result = verifyAnswerCitations(
      "The claim [[src/missing.ts:1]] and [[src/app.ts:9-21]] are invalid.",
      chunks,
    );
    expect(result.valid).toBe(false);
    expect(result.invalid).toHaveLength(2);
  });

  it("rejects answers without evidence", () => {
    expect(
      verifyAnswerCitations("This answer has no source.", chunks),
    ).toMatchObject({
      valid: false,
      missing: true,
    });
  });
});
