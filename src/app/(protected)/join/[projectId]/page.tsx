"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function JoinProjectPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const accept = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/projects/access/invitations/${encodeURIComponent(params.projectId)}/accept`,
      { method: "POST" },
    );
    const body = (await response.json()) as {
      projectId?: string;
      error?: string;
    };
    if (!response.ok || !body.projectId) {
      setError(body.error ?? "Could not accept this invitation.");
      setBusy(false);
      return;
    }
    router.replace(`/wiki/${body.projectId}`);
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join this RepoSense project</CardTitle>
          <CardDescription>
            Accept the invitation to receive the access level selected by the
            project owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => void accept()}
          >
            {busy ? "Accepting..." : "Accept invitation"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
