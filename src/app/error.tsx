"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";

export default function GlobalErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <AlertTriangle className="mx-auto size-9 text-amber-500" />
        <h1 className="mt-4 text-xl font-semibold">
          RepoSense hit a small speed bump
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Nothing dramatic—our server may be busy. Please retry in a moment.
        </p>
        <Button className="mt-5 gap-2" onClick={reset}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
