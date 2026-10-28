"use client";

import { diffLines } from "diff";
import { Minus, Plus } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";

interface RevisionDiffProps {
  previous: string;
  current: string;
  fullHeight?: boolean;
}

export function RevisionDiff({
  previous,
  current,
  fullHeight = false,
}: RevisionDiffProps) {
  const changes = diffLines(previous, current);
  let oldLine = 1;
  let newLine = 1;

  return (
    <div className="bg-muted/20 border-border/50 overflow-hidden rounded-lg border">
      <div className="border-border/50 flex items-center gap-2 border-b px-3 py-2">
        <Badge variant="outline" className="bg-red-500/10">
          <Plus data-icon="inline-start" />
          Added
        </Badge>
        <Badge variant="outline" className="bg-destructive/15">
          <Minus data-icon="inline-start" />
          Deleted
        </Badge>
      </div>
      <ScrollArea
        className={fullHeight ? "h-[calc(100vh-17rem)] min-h-96" : "max-h-96"}
      >
        <div className="min-w-max py-1 font-mono text-xs">
          {changes.flatMap((change, changeIndex) =>
            change.value
              .replace(/\n$/, "")
              .split("\n")
              .map((line, lineIndex) => {
                const deleted = Boolean(change.removed);
                const added = Boolean(change.added);
                const oldNumber = added ? null : oldLine++;
                const newNumber = deleted ? null : newLine++;

                return (
                  <div
                    key={`${changeIndex}-${lineIndex}`}
                    className={cn(
                      "grid grid-cols-[3rem_3rem_1.5rem_minmax(0,1fr)] px-2 leading-6",
                      added && "text-foreground bg-red-500/10",
                      deleted && "bg-destructive/15 text-foreground",
                    )}
                  >
                    <span className="text-muted-foreground/60 text-right select-none">
                      {oldNumber}
                    </span>
                    <span className="text-muted-foreground/60 text-right select-none">
                      {newNumber}
                    </span>
                    <span className="text-center select-none">
                      {added ? "+" : deleted ? "-" : " "}
                    </span>
                    <span className="pr-4 whitespace-pre">{line || " "}</span>
                  </div>
                );
              }),
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
