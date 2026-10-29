"use client";

import { diffLines, diffWordsWithSpace, type Change } from "diff";
import { ChevronDown, ChevronRight, FileCode2 } from "lucide-react";
import * as React from "react";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";

export interface RevisionDiffFile {
  id: string;
  path: string;
  previous: string;
  current: string;
}

interface RevisionDiffProps {
  previous: string;
  current: string;
  fullHeight?: boolean;
  files?: RevisionDiffFile[];
}

const CONTEXT_LINES = 3;

type DiffRow = {
  kind: "context" | "added" | "deleted";
  text: string;
  oldNumber: number | null;
  newNumber: number | null;
};

function lineRows(changes: Change[]): DiffRow[] {
  let oldLine = 1;
  let newLine = 1;
  const rows: DiffRow[] = [];

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, "").split("\n");
    for (const text of lines) {
      const kind = change.added
        ? "added"
        : change.removed
          ? "deleted"
          : "context";
      rows.push({
        kind,
        text,
        oldNumber: kind === "added" ? null : oldLine++,
        newNumber: kind === "deleted" ? null : newLine++,
      });
    }
  }

  return rows;
}

function hunks(rows: DiffRow[]): DiffRow[][] {
  const changed = rows.flatMap((row, index) =>
    row.kind === "context" ? [] : [index],
  );
  if (changed.length === 0) return rows.length ? [rows] : [];

  const ranges: Array<[number, number]> = [];
  for (const index of changed) {
    const range: [number, number] = [
      Math.max(0, index - CONTEXT_LINES),
      Math.min(rows.length - 1, index + CONTEXT_LINES),
    ];
    const previous = ranges[ranges.length - 1];
    if (previous && range[0] <= previous[1] + 1)
      previous[1] = Math.max(previous[1], range[1]);
    else ranges.push(range);
  }

  return ranges.map(([start, end]) => rows.slice(start, end + 1));
}

function changedStats(file: RevisionDiffFile) {
  return diffLines(file.previous, file.current).reduce(
    (stats, change) => ({
      additions: stats.additions + (change.added ? (change.count ?? 0) : 0),
      deletions: stats.deletions + (change.removed ? (change.count ?? 0) : 0),
    }),
    { additions: 0, deletions: 0 },
  );
}

function InlineChange({
  text,
  kind,
}: {
  text: string;
  kind: "added" | "deleted";
}) {
  return (
    <span>
      {diffWordsWithSpace(
        kind === "added" ? "" : text,
        kind === "added" ? text : "",
      ).map((part, index) => (
        <span
          key={`${index}-${part.value}`}
          className={
            part.added || part.removed ? "rounded-sm bg-current/15" : undefined
          }
        >
          {part.value}
        </span>
      ))}
    </span>
  );
}

function FileDiff({
  file,
  fullHeight,
  files,
  selectedId,
  onSelectFile,
  isOpen,
  onToggle,
}: {
  file: RevisionDiffFile;
  fullHeight: boolean;
  files: RevisionDiffFile[];
  selectedId: string;
  onSelectFile: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const sections = hunks(lineRows(diffLines(file.previous, file.current)));
  const stats = changedStats(file);

  return (
    <div className="bg-card border-border/70 overflow-hidden rounded-xl border">
      <div className="bg-muted/20 border-border/50 flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="hover:bg-muted/40 -my-1.5 flex min-w-0 items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors"
        >
          <ChevronRight
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <FileCode2 className="text-muted-foreground size-4 shrink-0" />
          <span className="truncate font-mono text-xs" title={file.path}>
            {file.path}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          <span className="text-emerald-600">+{stats.additions}</span>
          <span className="text-red-600">-{stats.deletions}</span>
          {files.length > 1 ? (
            <label className="relative flex w-52 items-center">
              <span className="sr-only">Select changed page</span>
              <select
                value={selectedId}
                onChange={(event) => onSelectFile(event.target.value)}
                className="border-input bg-background focus:ring-ring h-8 w-full appearance-none rounded-md border px-2.5 pr-8 font-mono text-xs outline-none focus:ring-2"
              >
                {files.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.path}
                  </option>
                ))}
              </select>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute right-2 size-3.5" />
            </label>
          ) : null}
        </div>
      </div>
      {isOpen ? (
        <ScrollArea
          className={cn(
            "w-full",
            fullHeight ? "max-h-[calc(100vh-19rem)]" : "max-h-96",
          )}
        >
          <div className="text-foreground min-w-max py-1 font-mono text-[13px]">
            {sections.length === 0 ? (
              <div className="text-muted-foreground px-4 py-8 text-center">
                No changes in this file.
              </div>
            ) : (
              sections.map((section, sectionIndex) => (
                <React.Fragment key={`${file.id}-section-${sectionIndex}`}>
                  <div className="bg-muted/40 text-muted-foreground border-b px-4 py-1.5 text-[11px]">
                    @@ {section[0]?.oldNumber ?? "-"},{section.length} →{" "}
                    {section[0]?.newNumber ?? "-"},{section.length} @@
                  </div>
                  {section.map((row, rowIndex) => (
                    <div
                      key={`${file.id}-${sectionIndex}-${rowIndex}`}
                      className={cn(
                        "grid grid-cols-[3.5rem_3.5rem_1.5rem_minmax(0,1fr)] leading-6",
                        row.kind === "added" && "bg-emerald-500/10",
                        row.kind === "deleted" && "bg-red-500/10",
                      )}
                    >
                      <span className="text-muted-foreground/70 bg-muted/20 px-2 text-right select-none">
                        {row.oldNumber}
                      </span>
                      <span className="text-muted-foreground/70 bg-muted/20 px-2 text-right select-none">
                        {row.newNumber}
                      </span>
                      <span
                        className={cn(
                          "text-center select-none",
                          row.kind === "added" &&
                            "text-emerald-700 dark:text-emerald-300",
                          row.kind === "deleted" &&
                            "text-red-700 dark:text-red-300",
                        )}
                      >
                        {row.kind === "added"
                          ? "+"
                          : row.kind === "deleted"
                            ? "−"
                            : " "}
                      </span>
                      <span className="px-3 whitespace-pre">
                        {row.kind === "context" ? (
                          row.text || " "
                        ) : (
                          <InlineChange
                            text={row.text || " "}
                            kind={row.kind}
                          />
                        )}
                      </span>
                    </div>
                  ))}
                </React.Fragment>
              ))
            )}
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );
}

export function RevisionDiff({
  previous,
  current,
  fullHeight = false,
  files,
}: RevisionDiffProps) {
  const availableFiles = files?.length
    ? files
    : [{ id: "revision", path: "wiki-page.md", previous, current }];
  const [selectedId, setSelectedId] = React.useState(
    availableFiles[0]?.id ?? "",
  );
  const selectedFile =
    availableFiles.find((file) => file.id === selectedId) ?? availableFiles[0];
  const [openFileId, setOpenFileId] = React.useState(
    availableFiles[0]?.id ?? "",
  );

  React.useEffect(() => {
    if (!availableFiles.some((file) => file.id === selectedId))
      setSelectedId(availableFiles[0]?.id ?? "");
  }, [availableFiles, selectedId]);

  return selectedFile ? (
    <FileDiff
      file={selectedFile}
      fullHeight={fullHeight}
      files={availableFiles}
      selectedId={selectedFile.id}
      onSelectFile={(id) => {
        setSelectedId(id);
        setOpenFileId(id);
      }}
      isOpen={openFileId === selectedFile.id}
      onToggle={() =>
        setOpenFileId((id) => (id === selectedFile.id ? "" : selectedFile.id))
      }
    />
  ) : null;
}
