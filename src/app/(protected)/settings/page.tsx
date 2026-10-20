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
      const [keysRes, meRes] = await Promise.all([\n        client.keys.$get(),
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

      const data = await res.json();
      const verification = ('verification' in data ? (data as any).verification : null) as {
        valid: boolean;
        error?: { code?: string; message?: string };
      } | null;
      const providerMeta = PROVIDER_METADATA[targetProvider];

      if (verification) {
        if (verification.valid) {
          toast.success(`${providerMeta.displayName} key verified and saved successfully!`);
        } else if (verification.error?.code === 'QUOTA_EXHAUSTED') {
          toast.error(`Key saved, but ${providerMeta.displayName} quota is exhausted or credit balance is zero.`);
        } else if (verification.error?.code === 'RATE_LIMITED') {
          toast.warning(`Key saved, but ${providerMeta.displayName} is temporarily rate-limited. Concurrency limit reached.`);
        } else {
          toast.error(`Key saved, but verification failed: ${verification.error?.message || 'Invalid API key'}`);
        }
      } else {
        toast.success(`${providerMeta.displayName} key saved`);
      }

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
      const verification = ('verification' in data ? (data as any).verification : null) as {
        valid: boolean;
        error?: { code?: string; message?: string };
      } | null;
      const isKeyValid = verification ? verification.valid : (data as any).valid === true;
      const providerMeta = PROVIDER_METADATA[provider];

      if (isKeyValid) {
        toast.success(`${providerMeta.displayName} key is active and verified!`);
      } else if (verification?.error?.code === 'QUOTA_EXHAUSTED') {
        toast.error(`${providerMeta.displayName} quota is exhausted: account has zero credits or exceeded limit.`);
      } else if (verification?.error?.code === 'RATE_LIMITED') {
        toast.warning(`${providerMeta.displayName} is temporarily rate-limited. Please retry shortly.`);
      } else {
        toast.error(`${providerMeta.displayName} key test failed: ${verification?.error?.message || 'Invalid API key'}`);
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

                return (\n                  <TableRow key={provider} className=\"hover:bg-muted/40\">\n                    <TableCell className=\"py-2.5\">\n                      <div className=\"flex items-center gap-2.5\">\n                        <div className=\"relative size-5 shrink-0\">\n                          <Image\n                            src={meta.logoAsset}\n                            alt={meta.displayName}\n                            fill\n                            className=\"object-contain\"\n                          />\n                        </div>\n                        <span className=\"font-medium text-xs text-foreground\">\n                          {meta.displayName}\n                        </span>\n                      </div>\n                    </TableCell>\n\n                    <TableCell className=\"py-2.5\">\n                      {existing ? (\n                        existing.status === 'VALID' ? (\n                          <Badge variant=\"outline\" className=\"gap-1 text-[11px] font-normal border-emerald-500/20 bg-emerald-500/10 text-emerald-600\">\n                            <CheckCircle2 className=\"size-3\" />\n                            Connected\n                          </Badge>\n                        ) : existing.status === 'INVALID' ? (\n                          <Badge variant=\"outline\" className=\"gap-1 text-[11px] font-normal border-destructive/20 bg-destructive/10 text-destructive\">\n                            <XCircle className=\"size-3\" />\n                            Invalid Key\n                          </Badge>\n                        ) : existing.status === 'QUOTA_EXHAUSTED' ? (\n                          <Badge variant=\"outline\" className=\"gap-1 text-[11px] font-normal border-amber-500/20 bg-amber-500/10 text-amber-600\">\n                            <AlertCircle className=\"size-3\" />\n                            Quota Exhausted\n                          </Badge>\n                        ) : (\n                          <Badge variant=\"secondary\" className=\"text-[11px] font-normal\">\n                            Unverified\n                          </Badge>\n                        )\n                      ) : (\n                        <span className=\"text-xs text-muted-foreground/70\">Not configured</span>\n                      )}\n                    </TableCell>\n\n                    <TableCell className=\"py-2.5 font-mono text-xs text-muted-foreground\">\n                      {existing ? `••••••••${existing.keyLast4}` : '—'}\n                    </TableCell>\n\n                    <TableCell className=\"py-2.5 text-right\">\n                      <div className=\"flex items-center justify-end gap-1.5\">\n                        {existing ? (\n                          <>\n                            <Button\n                              variant=\"ghost\"\n                              size=\"sm\"\n                              onClick={() => handleTestKey(provider)}\n                              disabled={isTesting}\n                              className=\"h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground\"\n                              title=\"Verify key validity\"\n                            >\n                              <RefreshCw className={`size-3 ${isTesting ? 'animate-spin' : ''}`} />\n                              <span>{isTesting ? 'Testing...' : 'Test'}</span>\n                            </Button>\n                            <Button\n                              variant=\"ghost\"\n                              size=\"sm\"\n                              onClick={() => handleOpenAddKey(provider)}\n                              className=\"h-7 px-2 text-xs text-muted-foreground hover:text-foreground\"\n                            >\n                              Replace\n                            </Button>\n                            <Button\n                              variant=\"ghost\"\n                              size=\"icon\"\n                              onClick={() => setRemoveConfirmProvider(provider)}\n                              className=\"size-7 text-muted-foreground hover:text-destructive\"\n                              title=\"Remove Key\"\n                            >\n                              <Trash2 className=\"size-3.5\" />\n                            </Button>\n                          </>\n                        ) : (\n                          <Button\n                            variant=\"outline\"\n                            size=\"sm\"\n                            onClick={() => handleOpenAddKey(provider)}\n                            className=\"h-7 text-xs gap-1\"\n                          >\n                            <Plus className=\"size-3\" />\n                            Add Key\n                          </Button>\n                        )}\n                      </div>\n                    </TableCell>\n                  </TableRow>\n                );\n              })}\n            </TableBody>\n          </Table>\n        </CardContent>\n      </Card>\n\n      {/* Default Model Preferences Card */}\n      <Card className=\"shadow-xs\">\n        <CardHeader className=\"py-3 px-4 border-b bg-muted/20\">\n          <CardTitle className=\"text-sm font-semibold\">Default Model Preferences</CardTitle>\n          <CardDescription className=\"text-xs mt-0.5\">\n            Choose your preferred chat and embedding models across all new projects.\n          </CardDescription>\n        </CardHeader>\n        <CardContent className=\"p-4 space-y-4\">\n          <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">\n            {/* Default Chat Provider */}\n            <div className=\"space-y-1.5\">\n              <Label className=\"text-xs font-semibold\">Default Chat Provider</Label>\n              <Select\n                value={defaultChatProvider}\n                onValueChange={(val: ProviderId) => {\n                  setDefaultChatProvider(val);\n                  const models = getModelsByProvider(val);\n                  if (models[0]) {\n                    setDefaultChatModel(models[0].id);\n                  }\n                }}\n              >\n                <SelectTrigger className=\"h-8 text-xs\">\n                  <SelectValue placeholder=\"Select Provider\" />\n                </SelectTrigger>\n                <SelectContent>\n                  {ALL_PROVIDERS.map((p) => (\n                    <SelectItem key={p} value={p} className=\"text-xs\">\n                      {PROVIDER_METADATA[p].displayName}\n                    </SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>\n\n            {/* Default Chat Model */}\n            <div className=\"space-y-1.5\">\n              <Label className=\"text-xs font-semibold\">Default Chat Model</Label>\n              <Select\n                value={defaultChatModel}\n                onValueChange={(val: string) => setDefaultChatModel(val)}\n              >\n                <SelectTrigger className=\"h-8 text-xs\">\n                  <SelectValue placeholder=\"Select Model\" />\n                </SelectTrigger>\n                <SelectContent>\n                  {availableModelsForProvider.map((m) => (\n                    <SelectItem key={m.id} value={m.id} className=\"text-xs\">\n                      {m.name}\n                    </SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>\n\n            {/* Default Embedding Provider */}\n            <div className=\"space-y-1.5\">\n              <Label className=\"text-xs font-semibold\">Default Embedding Provider</Label>\n              <Select\n                value={defaultEmbeddingProvider}\n                onValueChange={(val: 'GEMINI' | 'OPENAI') => setDefaultEmbeddingProvider(val)}\n              >\n                <SelectTrigger className=\"h-8 text-xs\">\n                  <SelectValue placeholder=\"Select Embedding Provider\" />\n                </SelectTrigger>\n                <SelectContent>\n                  <SelectItem value=\"OPENAI\" className=\"text-xs\">\n                    OpenAI (text-embedding-3-small · 1536 dim)\n                  </SelectItem>\n                  <SelectItem value=\"GEMINI\" className=\"text-xs\">\n                    Google Gemini (gemini-embedding-001 · 768 dim)\n                  </SelectItem>\n                </SelectContent>\n              </Select>\n            </div>\n          </div>\n\n          <div className=\"pt-2 flex justify-end\">\n            <Button\n              size=\"sm\"\n              onClick={handleSaveDefaults}\n              disabled={savingDefaults}\n              className=\"h-8 text-xs\"\n            >\n              {savingDefaults ? 'Saving...' : 'Save Preferences'}\n            </Button>\n          </div>\n        </CardContent>\n      </Card>\n\n      {/* Modal: Add or Replace API Key */}\n      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>\n        <DialogContent className=\"sm:max-w-md\">\n          <DialogHeader>\n            <DialogTitle className=\"text-base font-semibold flex items-center gap-2\">\n              <KeyRound className=\"size-4 text-primary\" />\n              Configure {PROVIDER_METADATA[targetProvider]?.displayName ?? 'API'} Key\n            </DialogTitle>\n            <DialogDescription className=\"text-xs text-muted-foreground\">\n              Keys are encrypted at rest with AES-GCM and probed directly with {PROVIDER_METADATA[targetProvider]?.displayName}.\n            </DialogDescription>\n          </DialogHeader>\n\n          <div className=\"space-y-3 py-2\">\n            <div className=\"space-y-1.5\">\n              <Label className=\"text-xs font-semibold\">Provider</Label>\n              <Select\n                value={targetProvider}\n                onValueChange={(val: ProviderId) => setTargetProvider(val)}\n              >\n                <SelectTrigger className=\"h-8 text-xs\">\n                  <SelectValue placeholder=\"Select Provider\" />\n                </SelectTrigger>\n                <SelectContent>\n                  {ALL_PROVIDERS.map((p) => (\n                    <SelectItem key={p} value={p} className=\"text-xs\">\n                      {PROVIDER_METADATA[p].displayName}\n                    </SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>\n\n            <div className=\"space-y-1.5\">\n              <Label className=\"text-xs font-semibold\">API Key</Label>\n              <Input\n                type=\"password\"\n                placeholder=\"sk-... or paste your key here\"\n                value={inputKey}\n                onChange={(e) => setInputKey(e.target.value)}\n                className=\"text-xs font-mono\"\n                autoFocus\n              />\n            </div>\n\n            {/* Embedding Guard Warning Inside Dialog */}\n            {NON_EMBEDDING_PROVIDERS.includes(targetProvider) && !hasActiveEmbeddingKey && (\n              <div className=\"p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 space-y-1\">\n                <div className=\"flex items-center gap-1.5 font-medium\">\n                  <AlertCircle className=\"size-3.5 shrink-0\" />\n                  <span>Embedding Provider Required</span>\n                </div>\n                <p className=\"text-[11px] leading-relaxed\">\n                  Please add an OpenAI or Gemini API key to enable code embeddings and RAG.\n                </p>\n              </div>\n            )}\n          </div>\n\n          <DialogFooter>\n            <Button\n              variant=\"outline\"\n              size=\"sm\"\n              onClick={() => setDialogOpen(false)}\n              disabled={savingKey}\n              className=\"h-8 text-xs\"\n            >\n              Cancel\n            </Button>\n            <Button\n              size=\"sm\"\n              onClick={handleSaveKey}\n              disabled={savingKey || !inputKey.trim()}\n              className=\"h-8 text-xs gap-1.5\"\n            >\n              {savingKey ? (\n                <>\n                  <Loader2 className=\"size-3 animate-spin\" />\n                  <span>Verifying & Saving...</span>\n                </>\n              ) : (\n                'Save Key'\n              )}\n            </Button>\n          </DialogFooter>\n        </DialogContent>\n      </Dialog>\n\n      {/* Remove Key Confirmation */}\n      <AlertDialog\n        open={!!removeConfirmProvider}\n        onOpenChange={(open) => !open && setRemoveConfirmProvider(null)}\n      >\n        <AlertDialogContent>\n          <AlertDialogHeader>\n            <AlertDialogTitle className=\"text-base font-semibold\">\n              Remove {removeConfirmProvider && PROVIDER_METADATA[removeConfirmProvider].displayName} Key?\n            </AlertDialogTitle>\n            <AlertDialogDescription className=\"text-xs text-muted-foreground\">\n              Projects relying on this provider will not be able to generate responses until a new key is added.\n            </AlertDialogDescription>\n          </AlertDialogHeader>\n          <AlertDialogFooter>\n            <AlertDialogCancel className=\"h-8 text-xs\">Cancel</AlertDialogCancel>\n            <AlertDialogAction\n              onClick={() => removeConfirmProvider && handleRemoveKey(removeConfirmProvider)}\n              className=\"h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90\"\n            >\n              Remove Key\n            </AlertDialogAction>\n          </AlertDialogFooter>\n        </AlertDialogContent>\n      </AlertDialog>\n    </div>\n  );\n}\n