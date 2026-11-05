import type { MatchedChunk } from "./embeddings";
import { extractAllCitationRanges, type SourceLineRange } from "./citations";

export interface CitationVerification {
  valid: boolean;
  citations: SourceLineRange[];
  invalid: Array<SourceLineRange & { reason: string }>;
  missing: boolean;
}

function coversRange(
  chunks: MatchedChunk[],
  citation: SourceLineRange,
): boolean {
  const intervals = chunks
    .filter((chunk) => chunk.filePath === citation.filePath)
    .map((chunk) => [chunk.startLine, chunk.endLine] as const)
    .sort((left, right) => left[0] - right[0]);

  let cursor = citation.startLine;
  for (const [start, end] of intervals) {
    if (end < cursor) continue;
    if (start > cursor) return false;
    cursor = Math.max(cursor, end + 1);
    if (cursor > citation.endLine) return true;
  }
  return false;
}

export function verifyAnswerCitations(
  answer: string,
  chunks: MatchedChunk[],
): CitationVerification {
  const citations = extractAllCitationRanges(answer);
  const invalid: CitationVerification["invalid"] = [];

  for (const citation of citations) {
    if (!coversRange(chunks, citation)) {
      invalid.push({
        ...citation,
        reason:
          "The citation is not fully covered by retrieved source context.",
      });
    }
  }

  return {
    valid: citations.length > 0 && invalid.length === 0,
    citations,
    invalid,
    missing: citations.length === 0,
  };
}
