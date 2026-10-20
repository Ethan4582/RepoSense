'use client';

import * as React from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import {
  KeyRound,
  User,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '~/components/ui/tabs';
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
  const { user, isLoaded } = useUser();
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

  // Defaults state
  const [defaultChatProvider, setDefaultChatProvider] = React.useState<ProviderId>('GEMINI');
  const [defaultChatModel, setDefaultChatModel] = React.useState<string>('gemini-2.5-flash');
  const [defaultEmbeddingProvider, setDefaultEmbeddingProvider] = React.useState<'GEMINI' | 'OPENAI'>('GEMINI');
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
          setKeys(data.keys as any);
        }
      }

      if (meRes.ok) {
        const meData = await meRes.json();
        if ('user' in meData && meData.user) {
          if (meData.user.defaultChatProvider) {
            setDefaultChatProvider(meData.user.defaultChatProvider as ProviderId);
          }
          if (meData.user.defaultChatModel) {
            setDefaultChatModel(meData.user.defaultChatModel);
          }
          if (meData.user.defaultEmbeddingProvider) {
            setDefaultEmbeddingProvider(meData.user.defaultEmbeddingProvider as any);
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
      const res = await client.me.$patch({
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account profile, Bring-Your-Own-Key (BYOK) vault, and default AI models.
        </p>
      </div>

      <Tabs defaultValue="api" className="space-y-6">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="api" className="gap-2 text-xs font-medium">
            <KeyRound className="size-3.5" />
            API & Models (BYOK)
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2 text-xs font-medium">
            <User className="size-3.5" />
            Profile
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: API & Models (BYOK) */}
        <TabsContent value="api" className="space-y-6">
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Provider API Keys</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Keys are AES-256-GCM encrypted in your vault and never exposed back in plain text.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <span>Hardware-isolated Vault</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stored Key</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_PROVIDERS.map((provider) => {
                    const meta = PROVIDER_METADATA[provider];
                    const existing = keys.find((k) => k.provider === provider);
                    const isTesting = testingProvider === provider;

                    return (
                      <TableRow key={provider} className="hover:bg-muted/40">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="relative size-6 shrink-0">
                              <Image
                                src={meta.logoPath}
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

                        <TableCell>
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

                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {existing ? `••••••••${existing.keyLast4}` : '—'}
                        </TableCell>

                        <TableCell className="text-right">
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
                                  onClick={() => {
                                    setTargetProvider(provider);
                                    setInputKey('');
                                    setDialogOpen(true);
                                  }}
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
                                onClick={() => {
                                  setTargetProvider(provider);
                                  setInputKey('');
                                  setDialogOpen(true);
                                }}
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

          {/* Default AI Models Selection */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-semibold">Default Model Preferences</CardTitle>
              <CardDescription className="text-xs">
                Select your preferred models for chat conversation and vector embedding generation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Chat Provider</Label>
                  <Select
                    value={defaultChatProvider}
                    onValueChange={(val) => {
                      const prov = val as ProviderId;
                      setDefaultChatProvider(prov);
                      const models = getModelsByProvider(prov);
                      if (models[0]) {
                        setDefaultChatModel(models[0].id);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
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
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModelsForProvider.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.displayName}
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
                    onValueChange={(val) => setDefaultEmbeddingProvider(val as any)}
                  >
                    <SelectTrigger className="h-9 text-xs max-w-sm">
                      <SelectValue placeholder="Select embedding provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GEMINI" className="text-xs">
                        Google Gemini (gemini-embedding-001 · 768 dim)
                      </SelectItem>
                      <SelectItem value="OPENAI" className="text-xs">
                        OpenAI (text-embedding-3-small · 1536 dim)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Embedding keys are required for project code indexing. Once indexing begins, the project&apos;s embedding provider is permanently locked.
                  </p>
                </div>
              </div>

              <div className="pt-2">
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
        </TabsContent>

        {/* Tab 2: Profile */}
        <TabsContent value="profile">
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-semibold">User Profile</CardTitle>
              <CardDescription className="text-xs">
                Your identity is managed securely via Clerk Authentication.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4 max-w-md">
              <div className="flex items-center gap-4">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.fullName ?? 'Avatar'}
                    className="size-16 rounded-full border shadow-xs"
                  />
                ) : (
                  <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                    {user?.firstName?.[0] ?? 'U'}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {user?.fullName ?? 'RepoSense User'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">First Name</Label>
                <Input readOnly value={user?.firstName ?? ''} className="h-9 text-xs bg-muted/30" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Last Name</Label>
                <Input readOnly value={user?.lastName ?? ''} className="h-9 text-xs bg-muted/30" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Primary Email</Label>
                <Input
                  readOnly
                  value={user?.primaryEmailAddress?.emailAddress ?? ''}
                  className="h-9 text-xs bg-muted/30"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                className="font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Your key is encrypted on write with AES-256-GCM. We never log or transmit raw keys.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={savingKey}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveKey}
              disabled={savingKey || !inputKey.trim()}
            >
              {savingKey ? 'Encrypting & Saving...' : 'Save Key'}
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
