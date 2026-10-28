export interface SourceLineRange {
  filePath: string;
  startLine: number;
  endLine: number;
}

function positiveLine(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

export function extractCitationRanges(markdown: string): SourceLineRange[] {
  const ranges: SourceLineRange[] = [];
  const seen = new Set<string>();
  const regex = /\[\[([^:\]\n]+):(\d+)(?:-(\d+))?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const filePath = match[1]?.trim();
    const startLine = Number(match[2]);
    const endLine = match[3] ? Number(match[3]) : startLine;
    if (!filePath || seen.has(filePath) || startLine < 1 || endLine < startLine)
      continue;
    seen.add(filePath);
    ranges.push({ filePath, startLine, endLine });
  }

  return ranges;
}

function rangeFromStoredReference(value: unknown): SourceLineRange | null {
  if (!value || typeof value !== "object") return null;
  const reference = value as {
    fileName?: unknown;
    filePath?: unknown;
    startLine?: unknown;
    endLine?: unknown;
    summary?: unknown;
  };
  const filePath =
    typeof reference.fileName === "string"
      ? reference.fileName
      : typeof reference.filePath === "string"
        ? reference.filePath
        : "";
  if (!filePath) return null;

  let startLine = positiveLine(reference.startLine);
  let endLine = positiveLine(reference.endLine);

  // Older saved questions stored the range only inside summary text.
  if (!startLine && typeof reference.summary === "string") {
    const legacyRange = /(?:lines?\s+|:)(\d+)-(\d+)/i.exec(reference.summary);
    if (legacyRange) {
      startLine = Number(legacyRange[1]);
      endLine = Number(legacyRange[2]);
    }
  }

  if (!startLine) return null;
  return {
    filePath,
    startLine,
    endLine: endLine && endLine >= startLine ? endLine : startLine,
  };
}

export function restoreCitationRanges(
  rawReferences: unknown,
  answer: string,
): SourceLineRange[] {
  // The answer contains the exact ranges the user sees, so it takes precedence
  // over broader retrieval ranges saved with the question.
  const ranges = extractCitationRanges(answer);
  const seen = new Set(ranges.map((range) => range.filePath));
  const references = Array.isArray(rawReferences)
    ? rawReferences
    : rawReferences &&
        typeof rawReferences === "object" &&
        Array.isArray((rawReferences as { citations?: unknown[] }).citations)
      ? (rawReferences as { citations: unknown[] }).citations
      : [];

  for (const reference of references) {
    const range = rangeFromStoredReference(reference);
    if (!range || seen.has(range.filePath)) continue;
    seen.add(range.filePath);
    ranges.push(range);
  }

  return ranges;
}
