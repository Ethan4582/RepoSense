"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, GitCompareArrows } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { RevisionDiff } from "~/components/wiki/revision-diff";

interface Revision {
  id: string;
  status: "PUBLISHED" | "PENDING";
  additions: number;
  deletions: number;
  createdAt: string;
  content: string;
  page: { id: string; title: string };
  actor: { firstName: string | null; lastName: string | null } | null;
}

export default function RevisionDiffPage() {
  const { projectId, revisionId } = useParams<{
    projectId: string;
    revisionId: string;
  }>();
  const [revisions, setRevisions] = React.useState<Revision[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void fetch(`/api/projects/${projectId}/revisions`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load revision");
        return (await response.json()) as { revisions?: Revision[] };
      })
      .then((body) => setRevisions(body.revisions ?? []))
      .finally(() => setLoading(false));
  }, [projectId]);

  const revisionIndex = revisions.findIndex((item) => item.id === revisionId);
  const revision = revisions[revisionIndex];
  const previousRevision = revision
    ? revisions
        .slice(revisionIndex + 1)
        .find((item) => item.page.id === revision.page.id)
    : undefined;

  if (loading) {
    return (
      <div className="text-muted-foreground p-6 text-sm">Loading diff...</div>
    );
  }

  if (!revision) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">Revision not found</h1>
        <Button variant="outline" asChild className="w-fit">
          <Link href={`/settings/projects/${projectId}?tab=history`}>
            <ArrowLeft data-icon="inline-start" />
            Back to versions
          </Link>
        </Button>
      </div>
    );
  }

  const author = revision.actor
    ? [revision.actor.firstName, revision.actor.lastName]
        .filter(Boolean)
        .join(" ") || "Member"
    : "Automatic update";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" asChild className="mb-1 w-fit">
            <Link href={`/settings/projects/${projectId}?tab=history`}>
              <ArrowLeft data-icon="inline-start" />
              Versions
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <GitCompareArrows className="text-primary" />
            {revision.page.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {author} · {new Date(revision.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">+{revision.additions}</Badge>
          <Badge variant="outline">-{revision.deletions}</Badge>
          <Badge
            variant={revision.status === "PENDING" ? "outline" : "secondary"}
          >
            {revision.status === "PENDING" ? "Needs review" : "Published"}
          </Badge>
        </div>
      </div>

      <Card className="min-h-0 flex-1 gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle>Wiki changes</CardTitle>
          <CardDescription>
            The complete page comparison is isolated here so the versions list
            stays compact.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 px-4">
          <RevisionDiff
            previous={previousRevision?.content ?? ""}
            current={revision.content}
            fullHeight
          />
        </CardContent>
      </Card>
    </main>
  );
}
