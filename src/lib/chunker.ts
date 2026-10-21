export interface RepoSkeletonEntry {
  filePath: string;
  directory: string;
  lineCount: number;
  sizeBytes: number;
  imports: Array<{ statement: string; line: number }>;
  exports: Array<{ signature: string; line: number }>;
}

export interface RepoSkeleton {
  generatedAt: string;
  fileCount: number;
  directories: string[];
  files: RepoSkeletonEntry[];
}

export interface CodeChunk {
  filePath: string;
  directory: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  chunkContent: string;
  fullFileContent?: string;
}

export const CHUNK_LINES = 120;
export const CHUNK_OVERLAP = 20;

const IMPORT_PATTERNS = [
  /^\s*import\s.+?from\s+['"].+?['"];?/,
  /^\s*import\s+['"].+?['"];?/,
  /^\s*const\s+\w+\s*=\s*require\(['"].+?['"]\)/,
  /^\s*from\s+\S+\s+import\s+/,
  /^\s*use\s+\S+;/,
];

const EXPORT_PATTERNS = [
  /^\s*export\s+(default\s+)?(async\s+)?function\s+\w+/,
  /^\s*export\s+(default\s+)?class\s+\w+/,
  /^\s*export\s+(const|let|var|type|interface|enum)\s+\w+/,
  /^\s*export\s*\{/,
  /^\s*export\s+default\s+/,
  /^\s*(pub(lic)?\s+)?(async\s+)?fn\s+\w+/,
  /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?(class|interface|enum)\s+\w+/,
  /^\s*def\s+\w+/,
  /^\s*func\s+\w+/,
  /^\s*(app|router)\.(get|post|put|patch|delete)\(/,
];

export function extractSkeletonEntry(
  file: { path: string; content: string; size: number }
): RepoSkeletonEntry {
  const lines = file.content.split('\n');
  const imports: RepoSkeletonEntry['imports'] = [];
  const exports: RepoSkeletonEntry['exports'] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNumber = i + 1;

    if (imports.length < 60 && IMPORT_PATTERNS.some((pattern) => pattern.test(line))) {
      imports.push({ statement: line.trim().slice(0, 240), line: lineNumber });
      continue;
    }

    if (exports.length < 120 && EXPORT_PATTERNS.some((pattern) => pattern.test(line))) {
      exports.push({ signature: line.trim().slice(0, 240), line: lineNumber });
    }
  }

  const directory = file.path.includes('/')
    ? file.path.slice(0, file.path.lastIndexOf('/'))
    : '.';

  return {
    filePath: file.path,
    directory,
    lineCount: lines.length,
    sizeBytes: file.size,
    imports,
    exports,
  };
}

export function buildRepoSkeleton(
  files: Array<{ path: string; content: string; size: number }>
): RepoSkeleton {
  const entries = files.map(extractSkeletonEntry);
  const directories = Array.from(new Set(entries.map((entry) => entry.directory))).sort();

  return {
    generatedAt: new Date().toISOString(),
    fileCount: entries.length,
    directories,
    files: entries,
  };
}

export function formatChunkContent(
  filePath: string,
  startLine: number,
  endLine: number,
  lines: string[]
): string {
  const width = String(endLine).length;
  const numbered = lines.map((line, index) => {
    const lineNumber = String(startLine + index).padStart(width, ' ');
    return `${lineNumber} | ${line}`;
  });

  return `File: ${filePath} (Lines ${startLine}-${endLine})\n${numbered.join('\n')}`;
}

export function chunkFile(file: {
  path: string;
  content: string;
}): CodeChunk[] {
  if (file.content.trim().length === 0) return [];

  const lines = file.content.split('\n');
  const totalLines = lines.length;
  const directory = file.path.includes('/')
    ? file.path.slice(0, file.path.lastIndexOf('/'))
    : '.';

  const chunks: CodeChunk[] = [];
  const step = Math.max(1, CHUNK_LINES - CHUNK_OVERLAP);
  let chunkIndex = 0;

  for (let start = 0; start < totalLines; start += step) {
    const end = Math.min(start + CHUNK_LINES, totalLines);
    const slice = lines.slice(start, end);
    const startLine = start + 1;
    const endLine = end;

    chunks.push({
      filePath: file.path,
      directory,
      chunkIndex,
      startLine,
      endLine,
      chunkContent: formatChunkContent(file.path, startLine, endLine, slice),
      ...(chunkIndex === 0 ? { fullFileContent: file.content } : {}),
    });

    chunkIndex += 1;
    if (end >= totalLines) break;
  }

  return chunks;
}

export function extractHeadings(
  markdown: string
): Array<{ id: string; text: string; level: number }> {
  const headings: Array<{ id: string; text: string; level: number }> = [];
  const used = new Map<string, number>();

  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match?.[1] || !match[2]) continue;

    const level = match[1].length;
    const text = match[2]
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[*_`~]/g, '')
      .trim();
    const base =
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') || 'section';

    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;

    headings.push({ id, text, level });
  }

  return headings;
}

export function extractCitationPaths(markdown: string): string[] {
  const matches = markdown.matchAll(/\[\[([^:\]]+):(\d+)-(\d+)\]\]/g);
  const paths = new Set<string>();
  for (const match of matches) {
    if (match[1]) paths.add(match[1]);
  }
  return Array.from(paths);
}
