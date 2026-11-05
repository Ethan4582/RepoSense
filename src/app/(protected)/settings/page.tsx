"use client";

import * as React from "react";
import Image from "next/image";
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  PROVIDER_METADATA,
  getDefaultChatModel,
  getModelsByProvider,
  type ProviderId,
} from "~/lib/providers";
import { client } from "~/lib/api-client";
import { cn } from "~/lib/utils";

const ALL_PROVIDERS: ProviderId[] = [
  "OPENAI",
  "GEMINI",
  "ANTHROPIC",
  "META",
  "DEEPSEEK",
  "XAI",
  "GROQ",
];

const NON_EMBEDDING_PROVIDERS: ProviderId[] = [
  "ANTHROPIC",
  "META",
  "DEEPSEEK",
  "XAI",
  "GROQ",
];

interface ApiKeyItem {
  id: string;
  provider: ProviderId;
  keyLast4: string;
  status: "UNVERIFIED" | "VALID" | "INVALID" | "QUOTA_EXHAUSTED";
  lastVerifiedAt?: string | null;
  lastUsedAt?: string | null;
}

interface VerificationResult {
  valid: boolean;
  error?: { code?: string; message?: string };
}

interface VerificationBody {
  verification?: VerificationResult;
  valid?: boolean;
}

interface ErrorBody {
  error?: string;
}

interface KeysBody {
  keys?: ApiKeyItem[];
}

interface MeBody {
  user?: {
    defaultChatProvider?: ProviderId;
    defaultChatModel?: string;
    defaultEmbeddingProvider?: "GEMINI" | "OPENAI";
  };
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function SettingsPage() {
  const [keys, setKeys] = React.useState<ApiKeyItem[]>([]);
  const [loadingKeys, setLoadingKeys] = React.useState(true);
  const [testingProvider, setTestingProvider] =
    React.useState<ProviderId | null>(null);

  // Key modal state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [targetProvider, setTargetProvider] =
    React.useState<ProviderId>("OPENAI");
  const [inputKey, setInputKey] = React.useState("");
  const [savingKey, setSavingKey] = React.useState(false);

  // Remove confirmation
  const [removeConfirmProvider, setRemoveConfirmProvider] =
    React.useState<ProviderId | null>(null);

  // Defaults state - default pre-selected options
  const [defaultChatProvider, setDefaultChatProvider] =
    React.useState<ProviderId>("OPENAI");
  const [defaultChatModel, setDefaultChatModel] =
    React.useState<string>("gpt-6.1-sol");
  const [defaultEmbeddingProvider, setDefaultEmbeddingProvider] =
    React.useState<"GEMINI" | "OPENAI">("OPENAI");
  const [savingDefaults, setSavingDefaults] = React.useState(false);

  const fetchKeysAndMe = React.useCallback(async () => {
    try {
      setLoadingKeys(true);
      const [keysRes, meRes] = await Promise.all([
        client.keys.$get(),
        client.me.$get(),
      ]);

      if (keysRes.ok) {
        const data = (await keysRes.json()) as KeysBody;
        if (data.keys) {
          setKeys(data.keys);
        }
      }

      if (meRes.ok) {
        const meData = (await meRes.json()) as MeBody;
        if (meData.user) {
          if (meData.user.defaultChatProvider) {
            setDefaultChatProvider(meData.user.defaultChatProvider);
          }
          if (meData.user.defaultChatModel) {
            setDefaultChatModel(meData.user.defaultChatModel);
          }
          if (
            meData.user.defaultChatProvider &&
            meData.user.defaultEmbeddingProvider
          ) {
            setDefaultEmbeddingProvider(meData.user.defaultEmbeddingProvider);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load settings data:", err);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchKeysAndMe();
  }, [fetchKeysAndMe]);

  const hasActiveEmbeddingKey = React.useMemo(() => {
    return keys.some(
      (k) =>
        (k.provider === "OPENAI" || k.provider === "GEMINI") &&
        (k.status === "VALID" || k.status === "UNVERIFIED"),
    );
  }, [keys]);

  const handleOpenAddKey = (provider: ProviderId = "OPENAI") => {
    setTargetProvider(provider);
    setInputKey("");
    setDialogOpen(true);
  };

  const handleSaveKey = async () => {
    if (!inputKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    try {
      setSavingKey(true);
      const res = await client.keys.$post({
        json: {
          provider: targetProvider,
          apiKey: inputKey.trim(),
        },
      });

      if (!res.ok) {
        const err = (await res.json()) as ErrorBody;
        toast.error(err.error ?? "Failed to save key");
        return;
      }

      const data = (await res.json()) as VerificationBody;
      const verification = data.verification ?? null;
      const providerMeta = PROVIDER_METADATA[targetProvider];

      if (verification) {
        if (verification.valid) {
          toast.success(
            `${providerMeta.displayName} key verified and saved successfully!`,
          );
        } else if (verification.error?.code === "QUOTA_EXHAUSTED") {
          toast.error(
            `Key saved, but ${providerMeta.displayName} quota is exhausted or credit balance is zero.`,
          );
        } else if (verification.error?.code === "RATE_LIMITED") {
          toast.warning(
            `Key saved, but ${providerMeta.displayName} is temporarily rate-limited. Concurrency limit reached.`,
          );
        } else {
          toast.error(
            `Key saved, but verification failed: ${verification.error?.message ?? "Invalid API key"}`,
          );
        }
      } else {
        toast.success(`${providerMeta.displayName} key saved`);
      }

      setInputKey("");
      setDialogOpen(false);

      if (
        NON_EMBEDDING_PROVIDERS.includes(targetProvider) &&
        !hasActiveEmbeddingKey
      ) {
        toast.warning(
          "Please add an OpenAI or Gemini API key to enable code embeddings and RAG.",
          {
            duration: 6000,
          },
        );
      }

      await fetchKeysAndMe();
    } catch (err) {
      toast.error(errorMessage(err, "Error saving key"));
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestKey = async (provider: ProviderId) => {
    try {
      setTestingProvider(provider);
      const res = await client.keys[":provider"].test.$post({
        param: { provider },
      });

      if (!res.ok) {
        const err = (await res.json()) as ErrorBody;
        toast.error(err.error ?? "Key test failed");
        return;
      }

      const data = (await res.json()) as VerificationBody;
      const verification = data.verification ?? null;
      const isKeyValid = verification
        ? verification.valid
        : data.valid === true;
      const providerMeta = PROVIDER_METADATA[provider];

      if (isKeyValid) {
        toast.success(
          `${providerMeta.displayName} key is active and verified!`,
        );
      } else if (verification?.error?.code === "QUOTA_EXHAUSTED") {
        toast.error(
          `${providerMeta.displayName} quota is exhausted: account has zero credits or exceeded limit.`,
        );
      } else if (verification?.error?.code === "RATE_LIMITED") {
        toast.warning(
          `${providerMeta.displayName} is temporarily rate-limited. Please retry shortly.`,
        );
      } else {
        toast.error(
          `${providerMeta.displayName} key test failed: ${verification?.error?.message ?? "Invalid API key"}`,
        );
      }
      await fetchKeysAndMe();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to test key"));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleRemoveKey = async (provider: ProviderId) => {
    try {
      const res = await client.keys[":provider"].$delete({
        param: { provider },
      });

      if (!res.ok) {
        const err = (await res.json()) as ErrorBody;
        toast.error(err.error ?? "Failed to delete key");
        return;
      }

      toast.success(`${PROVIDER_METADATA[provider].displayName} key removed`);
      setRemoveConfirmProvider(null);
      await fetchKeysAndMe();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove key"));
    }
  };

  const handleSaveDefaults = async () => {
    try {
      setSavingDefaults(true);
      const res = await client.me.defaults.$patch({
        json: {
          defaultChatProvider,
          defaultChatModel,
          defaultEmbeddingProvider,
        },
      });

      if (!res.ok) {
        const err = (await res.json()) as ErrorBody;
        toast.error(err.error ?? "Failed to save defaults");
        return;
      }

      toast.success("Default model preferences saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save defaults"));
    } finally {
      setSavingDefaults(false);
    }
  };

  const availableModelsForProvider = getModelsByProvider(defaultChatProvider);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-foreground flex items-center gap-2 text-xl font-bold tracking-tight">
          <KeyRound className="text-primary size-5" />
          API Keys
        </h1>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Manage your AI provider keys and model preferences.
        </p>
      </div>

      {/* Provider API Keys Card */}
      <Card>
        <CardHeader className="border-border/50 bg-muted/20 border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">
                Provider API Keys
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                Configure your API keys to enable models across your projects.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenAddKey("OPENAI")}
              className="h-7 gap-1 text-xs"
            >
              <Plus className="size-3" />
              Add Key
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium">Provider</TableHead>
                <TableHead className="text-xs font-medium">Status</TableHead>
                <TableHead className="text-xs font-medium">Key</TableHead>
                <TableHead className="text-right text-xs font-medium">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALL_PROVIDERS.map((provider) => {
                const meta = PROVIDER_METADATA[provider];
                const existing = keys.find((k) => k.provider === provider);
                const isTesting = testingProvider === provider;

                return (
                  <TableRow key={provider} className="hover:bg-muted/40">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative size-5 shrink-0">
                          <Image
                            src={meta.logoAsset}
                            alt={meta.displayName}
                            fill
                            className={cn(
                              "object-contain",
                              meta.id === "XAI" && "dark:invert",
                            )}
                          />
                        </div>
                        <span className="text-foreground text-xs font-medium">
                          {meta.displayName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-2.5">
                      {existing ? (
                        existing.status === "VALID" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-[11px] font-normal text-emerald-600"
                          >
                            <CheckCircle2 className="size-3" />
                            Connected
                          </Badge>
                        ) : existing.status === "INVALID" ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/20 bg-destructive/10 text-destructive gap-1 text-[11px] font-normal"
                          >
                            <XCircle className="size-3" />
                            Invalid Key
                          </Badge>
                        ) : existing.status === "QUOTA_EXHAUSTED" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-500/20 bg-amber-500/10 text-[11px] font-normal text-amber-600"
                          >
                            <AlertCircle className="size-3" />
                            Quota Exhausted
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-normal"
                          >
                            Unverified
                          </Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground/70 text-xs">
                          Not configured
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-muted-foreground py-2.5 font-mono text-xs">
                      {existing ? `••••••••${existing.keyLast4}` : "—"}
                    </TableCell>

                    <TableCell className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {existing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTestKey(provider)}
                              disabled={isTesting}
                              className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
                              title="Verify key validity"
                            >
                              <RefreshCw
                                className={`size-3 ${isTesting ? "animate-spin" : ""}`}
                              />
                              <span>{isTesting ? "Testing..." : "Test"}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAddKey(provider)}
                              className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
                            >
                              Replace
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRemoveConfirmProvider(provider)}
                              className="text-muted-foreground hover:text-destructive size-7"
                              title="Remove Key"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAddKey(provider)}
                            className="h-7 gap-1 text-xs"
                          >
                            <Plus className="size-3" />
                            Add Key
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Default Model Preferences Card */}
      <Card>
        <CardHeader className="border-border/50 bg-muted/20 border-b px-5 py-4">
          <CardTitle className="text-sm font-semibold">
            Default Model Preferences
          </CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            Choose your preferred chat and embedding models across all new
            projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Default Chat Provider */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Default Chat Provider
              </Label>
              <Select
                value={defaultChatProvider}
                onValueChange={(val: ProviderId) => {
                  setDefaultChatProvider(val);
                  setDefaultChatModel(getDefaultChatModel(val));
                }}
              >
                <SelectTrigger className="h-8 rounded-lg text-xs">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {PROVIDER_METADATA[p].displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default Chat Model */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Default Chat Model
              </Label>
              <Select
                value={defaultChatModel}
                onValueChange={(val: string) => setDefaultChatModel(val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModelsForProvider.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default Embedding Provider */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Default Embedding Provider
              </Label>
              <Select
                value={defaultEmbeddingProvider}
                onValueChange={(val: "GEMINI" | "OPENAI") =>
                  setDefaultEmbeddingProvider(val)
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Embedding Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPENAI" className="text-xs">
                    OpenAI (text-embedding-3-small · 1536 dim)
                  </SelectItem>
                  <SelectItem value="GEMINI" className="text-xs">
                    Google Gemini (gemini-embedding-001 · 768 dim)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={handleSaveDefaults}
              disabled={savingDefaults}
              className="h-8 text-xs"
            >
              {savingDefaults ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Add or Replace API Key */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <KeyRound className="text-primary size-4" />
              Configure{" "}
              {PROVIDER_METADATA[targetProvider]?.displayName ?? "API"} Key
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Keys are encrypted at rest with AES-GCM and probed directly with{" "}
              {PROVIDER_METADATA[targetProvider]?.displayName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Provider</Label>
              <Select
                value={targetProvider}
                onValueChange={(val: ProviderId) => setTargetProvider(val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {PROVIDER_METADATA[p].displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">API Key</Label>
              <Input
                type="password"
                placeholder="sk-... or paste your key here"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="font-mono text-xs"
                autoFocus
              />
            </div>

            {/* Embedding Guard Warning Inside Dialog */}
            {NON_EMBEDDING_PROVIDERS.includes(targetProvider) &&
              !hasActiveEmbeddingKey && (
                <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>Embedding Provider Required</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Please add an OpenAI or Gemini API key to enable code
                    embeddings and RAG.
                  </p>
                </div>
              )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={savingKey}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveKey}
              disabled={savingKey || !inputKey.trim()}
              className="h-8 gap-1.5 text-xs"
            >
              {savingKey ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  <span>Verifying & Saving...</span>
                </>
              ) : (
                "Save Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Key Confirmation */}
      <AlertDialog
        open={!!removeConfirmProvider}
        onOpenChange={(open) => !open && setRemoveConfirmProvider(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Remove{" "}
              {removeConfirmProvider &&
                PROVIDER_METADATA[removeConfirmProvider].displayName}{" "}
              Key?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs">
              Projects relying on this provider will not be able to generate
              responses until a new key is added.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                removeConfirmProvider && handleRemoveKey(removeConfirmProvider)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs"
            >
              Remove Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
