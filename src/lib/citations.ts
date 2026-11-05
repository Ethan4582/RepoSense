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
  const regex =
    /\[\[((?:\[\[[^\]\n]+\]\]|\[[^\]\n]+\]|[^:\]\n])+?):(\d+)(?:-(\d+))?\]\]/g;
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

export function extractAllCitationRanges(markdown: string): SourceLineRange[] {
  const ranges: SourceLineRange[] = [];
  const regex =
    /\[\[((?:\[\[[^\]\n]+\]\]|\[[^\]\n]+\]|[^:\]\n])+?):(\d+)(?:-(\d+))?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const filePath = match[1]?.trim();
    const startLine = Number(match[2]);
    const endLine = match[3] ? Number(match[3]) : startLine;
    if (!filePath || startLine < 1 || endLine < startLine) continue;
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
  markdownFallback?: string,
): SourceLineRange[] {
  const parsedFromMarkdown = markdownFallback
    ? extractCitationRanges(markdownFallback)
    : [];
  const markdownMap = new Map(
    parsedFromMarkdown.map((item) => [item.filePath, item]),
  );

  const ranges: SourceLineRange[] = [];
  const seen = new Set<string>();

  if (Array.isArray(rawReferences)) {
    for (const item of rawReferences) {
      const fromStored = rangeFromStoredReference(item);
      if (!fromStored) continue;

      const matchingMarkdown = markdownMap.get(fromStored.filePath);
      const startLine =
        fromStored.startLine ?? matchingMarkdown?.startLine ?? 1;
      const endLine =
        fromStored.endLine ?? matchingMarkdown?.endLine ?? startLine;

      if (!seen.has(fromStored.filePath)) {
        seen.add(fromStored.filePath);
        ranges.push({
          filePath: fromStored.filePath,
          startLine,
          endLine: Math.max(startLine, endLine),
        });
      }
    }
  }

  for (const item of parsedFromMarkdown) {
    if (!seen.has(item.filePath)) {
      seen.add(item.filePath);
      ranges.push(item);
    }
  }

  return ranges;
}
