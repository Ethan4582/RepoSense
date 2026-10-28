"use client";

import * as React from "react";
import { Clock3, RefreshCw, Server } from "lucide-react";
import { Button } from "~/components/ui/button";

function remainingLabel(retryAt?: string | null) {
  if (!retryAt) return "a little while";
  const milliseconds = new Date(retryAt).getTime() - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "a moment";
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function ServerBusyNotice({
  message,
  retryAt,
  onRetry,
}: {
  message?: string | null;
  retryAt?: string | null;
  onRetry?: () => void;
}) {
  const [label, setLabel] = React.useState(() => remainingLabel(retryAt));

  React.useEffect(() => {
    setLabel(remainingLabel(retryAt));
    const timer = window.setInterval(
      () => setLabel(remainingLabel(retryAt)),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, [retryAt]);

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-left">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Server className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold">
            Our server is taking a quick breather
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {message ??
              "RepoSense is catching its breath on the free-plan treadmill. Please try again shortly."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Clock3 className="size-3.5" /> Try again in about {label}
            </span>
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={onRetry}
              >
                <RefreshCw className="size-3" /> Retry now
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
