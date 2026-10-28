"use client";

import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PROVIDER_METADATA } from "~/lib/providers/catalog";
import type { ProviderId } from "~/lib/providers/types";

interface ApiKeyRequiredCardProps {
  providers: ProviderId[];
  compact?: boolean;
}

export function ApiKeyRequiredCard({
  providers,
  compact = false,
}: ApiKeyRequiredCardProps) {
  const uniqueProviders = Array.from(new Set(providers));

  return (
    <Card className={compact ? "gap-3 py-4" : "gap-4 py-5 shadow-lg"}>
      <CardHeader className="gap-2 px-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
            <KeyRound />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">Add your own API key</CardTitle>
            <CardDescription>
              RepoSense never uses the wiki owner&apos;s key for your questions.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        <p className="text-muted-foreground text-sm">
          Add a validated key for the required provider before asking this
          public wiki a question.
        </p>
        <div className="flex flex-wrap gap-2">
          {uniqueProviders.map((provider) => (
            <Badge key={provider} variant="outline">
              {PROVIDER_METADATA[provider]?.displayName ?? provider}
            </Badge>
          ))}
        </div>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ShieldCheck className="size-4" />
          Your key is encrypted and is only used for requests made by your
          account.
        </p>
      </CardContent>
      <CardFooter className="px-4">
        <Button asChild>
          <Link href="/settings">
            <KeyRound data-icon="inline-start" />
            Configure my API key
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
