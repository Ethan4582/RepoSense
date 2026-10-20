'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import {
  PROVIDER_METADATA,
  getModelsByProvider,
  type ProviderId,
} from '~/lib/providers';
import { client } from '~/lib/api-client';

const ALL_PROVIDERS: ProviderId[] = [
  'OPENAI',
  'GEMINI',
  'ANTHROPIC',
  'META',
  'DEEPSEEK',
  'XAI',
  'GROQ',
];

const NON_EMBEDDING_PROVIDERS: ProviderId[] = [
  'ANTHROPIC',
  'META',
  'DEEPSEEK',
  'XAI',
  'GROQ',
];

interface ApiKeyItem {
  id: string;
  provider: ProviderId;
  keyLast4: string;
  label?: string | null;
  status: 'UNVERIFIED' | 'VALID' | 'INVALID' | 'QUOTA_EXHAUSTED' | 'REVOKED';
  lastVerifiedAt?: string | null;
  lastUsedAt?: string | null;
}

export default function SettingsPage() {
  const [keys, setKeys] = React.useState<ApiKeyItem[]>([]);
  const [loadingKeys, setLoadingKeys] = React.useState(true);
  const [testingProvider, setTestingProvider] = React.useState<ProviderId | null>(null);

  // Key modal state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [targetProvider, setTargetProvider] = React.useState<ProviderId>('OPENAI');
  const [inputKey, setInputKey] = React.useState('');
  const [savingKey, setSavingKey] = React.useState(false);

  // Remove confirmation
  const [removeConfirmProvider, setRemoveConfirmProvider] = React.useState<ProviderId | null>(null);

  // Defaults state - switched default pre-selected options from Gemini to OpenAI
  const [defaultChatProvider, setDefaultChatProvider] = React.useState<ProviderId>('OPENAI');
  const [defaultChatModel, setDefaultChatModel] = React.useState<string>('gpt-4o');
  const [defaultEmbeddingProvider, setDefaultEmbeddingProvider] = React.useState<'GEMINI' | 'OPENAI'>('OPENAI');
  const [savingDefaults, setSavingDefaults] = React.useState(false);

  const fetchKeysAndMe = React.useCallback(async () => {
    try {
      setLoadingKeys(true);
      const [keysRes, meRes] = await Promise.all([
        client.keys.$get(),
        client.me.$get(),
      ]);

      if (keysRes.ok) {
        const data = await keysRes.json();
        if ('keys' in data && Array.isArray(data.keys)) {
          setKeys(data.keys);
        }
      }

      if (meRes.ok) {
        const meData = await meRes.json();
        if ('user' in meData && meData.user) {
          if (meData.user.defaultChatProvider) {
            setDefaultChatProvider(meData.user.defaultChatProvider);
          }
          if (meData.user.defaultChatModel) {
            setDefaultChatModel(meData.user.defaultChatModel);
          }
          if (meData.user.defaultChatProvider && meData.user.defaultEmbeddingProvider) {
            setDefaultEmbeddingProvider(meData.user.defaultEmbeddingProvider);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  React.useEffect(() => {
    fetchKeysAndMe();
  }, [fetchKeysAndMe]);

  const hasActiveEmbeddingKey = React.useMemo(() => {
    return keys.some(
      (k) =>
        (k.provider === 'OPENAI' || k.provider === 'GEMINI') &&
        (k.status === 'VALID' || k.status === 'UNVERIFIED')
    );
  }, [keys]);

  const handleOpenAddKey = (provider: ProviderId = 'OPENAI') => {
    setTargetProvider(provider);
    setInputKey('');
    setDialogOpen(true);
  };

  const handleSaveKey = async () => {
    if (!inputKey.trim()) {
      toast.error('Please enter an API key');
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
        const err = await res.json();
        toast.error((err as any)?.error || 'Failed to save key');
        return;
      }

      toast.success(`${PROVIDER_METADATA[targetProvider].displayName} key saved securely`);
      setInputKey('');
      setDialogOpen(false);

      // Embedding Guard: Trigger toast if user adds a key from Anthropic, Meta, DeepSeek, xAI, or Groq while lacking an active OpenAI or Gemini key
      if (NON_EMBEDDING_PROVIDERS.includes(targetProvider) && !hasActiveEmbeddingKey) {
        toast.warning('Please add an OpenAI or Gemini API key to enable code embeddings and RAG.', {
          duration: 6000,
        });
      }

      await fetchKeysAndMe();
    } catch (err: any) {
      toast.error(err?.message || 'Error saving key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestKey = async (provider: ProviderId) => {
    try {
      setTestingProvider(provider);
      const res = await client.keys[':provider'].test.$post({
        param: { provider },
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error((err as any)?.error || 'Key test failed');
        return;
      }

      const data = await res.json();
      if ('valid' in data && data.valid) {
        toast.success(`${PROVIDER_METADATA[provider].displayName} key is valid!`);
      } else {
        toast.error(`${PROVIDER_METADATA[provider].displayName} key is invalid or quota exhausted`);
      }
      await fetchKeysAndMe();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to test key');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleRemoveKey = async (provider: ProviderId) => {
    try {
      const res = await client.keys[':provider'].$delete({
        param: { provider },
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error((err as any)?.error || 'Failed to delete key');
        return;
      }

      toast.success(`${PROVIDER_METADATA[provider].displayName} key removed`);
      setRemoveConfirmProvider(null);
      await fetchKeysAndMe();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove key');
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
        const err = await res.json();
        toast.error((err as any)?.error || 'Failed to save defaults');
        return;
      }

      toast.success('Default model preferences saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save defaults');
    } finally {
      setSavingDefaults(false);
    }
  };

  const availableModelsForProvider = getModelsByProvider(defaultChatProvider);

  return (
    <div className="space-y-4 max-w-5xl mx-auto px-4 py-5 md:px-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          API Keys 
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your AI provider keys and model preferences.
        </p>
      </div>

      {/* Provider API Keys Card */}
      <Card className="shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Provider API Keys</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Configure your API keys to enable models across your projects.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenAddKey('OPENAI')}
              className="h-7 text-xs gap-1"
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
                <TableHead className="text-xs font-medium">Stored Key</TableHead>
                <TableHead className="text-right text-xs font-medium">Actions</TableHead>
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
                            className="object-contain"
                          />
                        </div>
                        <span className="font-medium text-xs text-foreground">
                          {meta.displayName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-2.5">
                      {existing ? (
                        existing.status === 'VALID' ? (
                          <Badge variant="outline" className="gap-1 text-[11px] font-normal border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                            <CheckCircle2 className="size-3" />
                            Connected
                          </Badge>
                        ) : existing.status === 'INVALID' ? (
                          <Badge variant="outline" className="gap-1 text-[11px] font-normal border-destructive/20 bg-destructive/10 text-destructive">
                            <XCircle className="size-3" />
                            Invalid Key
                          </Badge>
                        ) : existing.status === 'QUOTA_EXHAUSTED' ? (
                          <Badge variant="outline" className="gap-1 text-[11px] font-normal border-amber-500/20 bg-amber-500/10 text-amber-600">
                            <AlertCircle className="size-3" />
                            Quota Exhausted
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[11px] font-normal">
                            Unverified
                          </Badge>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground/70">Not configured</span>
                      )}
                    </TableCell>

                    <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                      {existing ? `••••••••${existing.keyLast4}` : '—'}
                    </TableCell>

                    <TableCell className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {existing ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestKey(provider)}
                              disabled={isTesting}
                              className="h-7 text-xs gap-1"
                            >
                              {isTesting ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <RefreshCw className="size-3" />
                              )}
                              Test
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAddKey(provider)}
                              className="h-7 text-xs"
                            >
                              Replace
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRemoveConfirmProvider(provider)}
                              className="size-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenAddKey(provider)}
                            className="h-7 text-xs gap-1"
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
      <Card className="shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/20">
          <CardTitle className="text-sm font-semibold">Default Model Preferences</CardTitle>
          <CardDescription className="text-xs">
            Select your preferred models for chat conversation and vector embedding generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Default Chat Provider</Label>
              <Select
                value={defaultChatProvider}
                onValueChange={(val) => {
                  const prov = val as ProviderId;
                  setDefaultChatProvider(prov);
                  const models = getModelsByProvider(prov);
                  if (prov === 'OPENAI') {
                    setDefaultChatModel('gpt-4o');
                  } else if (models[0]) {
                    setDefaultChatModel(models[0].id);
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select provider" />
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
              <Label className="text-xs font-semibold">Default Chat Model</Label>
              <Select
                value={defaultChatModel}
                onValueChange={setDefaultChatModel}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select model" />
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

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">
                Default Embedding Provider (OpenAI or Gemini only)
              </Label>
              <Select
                value={defaultEmbeddingProvider}
                onValueChange={(val) => setDefaultEmbeddingProvider(val as 'GEMINI' | 'OPENAI')}
              >
                <SelectTrigger className="h-8 text-xs max-w-sm">
                  <SelectValue placeholder="Select embedding provider" />
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
              <p className="text-[11px] text-muted-foreground mt-1">
                Embedding keys are required for project code indexing. Once indexing begins, the project&apos;s embedding provider is permanently locked.
              </p>
            </div>
          </div>

          <div className="pt-1">
            <Button
              size="sm"
              onClick={handleSaveDefaults}
              disabled={savingDefaults}
              className="h-8 text-xs"
            >
              {savingDefaults ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add / Replace Key Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              Configure {PROVIDER_METADATA[targetProvider]?.displayName} Key
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter your personal API key from the {PROVIDER_METADATA[targetProvider]?.displayName} developer console.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <Select
                value={targetProvider}
                onValueChange={(val) => setTargetProvider(val as ProviderId)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select provider" />
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
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                placeholder={
                  targetProvider === 'OPENAI'
                    ? 'sk-...'
                    : targetProvider === 'ANTHROPIC'
                    ? 'sk-ant-...'
                    : targetProvider === 'GEMINI'
                    ? 'AIzaSy...'
                    : 'Paste your API key here'
                }
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="font-mono text-xs h-8"
              />
            </div>

            {NON_EMBEDDING_PROVIDERS.includes(targetProvider) && !hasActiveEmbeddingKey && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>Please add an OpenAI or Gemini API key to enable code embeddings and RAG.</span>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Your key is encrypted securely and never exposed in plain text.
            </p>
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
              className="h-8 text-xs"
            >
              {savingKey ? 'Saving...' : 'Save Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Key Alert Dialog */}
      <AlertDialog
        open={!!removeConfirmProvider}
        onOpenChange={(open) => !open && setRemoveConfirmProvider(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your {removeConfirmProvider && PROVIDER_METADATA[removeConfirmProvider]?.displayName} API key? Any active projects using this provider will fail until a new key is supplied.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeConfirmProvider && handleRemoveKey(removeConfirmProvider)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
