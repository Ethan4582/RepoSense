'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, ChevronDown, Check, KeyRound } from 'lucide-react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  PROVIDER_METADATA,
  getModelsByProvider,
  getModelInfo,
  type ProviderId,
  type ModelInfo,
} from '~/lib/providers';
import { getPriceBadge } from '~/lib/pricing';

const ALL_PROVIDERS: ProviderId[] = [
  'GEMINI',
  'OPENAI',
  'ANTHROPIC',
  'META',
  'DEEPSEEK',
  'XAI',
  'GROQ',
];

interface ModelSelectorProps {
  selectedProvider: ProviderId;
  selectedModel: string;
  onSelect: (provider: ProviderId, modelId: string) => void;
  userValidProviders?: ProviderId[];
  disabled?: boolean;
}

export function ModelSelector({
  selectedProvider,
  selectedModel,
  onSelect,
  userValidProviders = ['GEMINI', 'OPENAI', 'ANTHROPIC', 'META', 'DEEPSEEK', 'XAI', 'GROQ'],
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<ProviderId | 'ALL'>('ALL');
  const [favorites, setFavorites] = React.useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('reposense_favorite_models');
        return stored ? JSON.parse(stored) : ['gemini-2.5-flash', 'gpt-5-mini', 'claude-3-7-sonnet'];
      } catch {
        return ['gemini-2.5-flash'];
      }
    }
    return ['gemini-2.5-flash'];
  });

  const toggleFavorite = (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId];
      try {
        localStorage.setItem('reposense_favorite_models', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const currentInfo = getModelInfo(selectedModel);
  const currentProviderMeta = PROVIDER_METADATA[selectedProvider];
  const currentBadge = currentInfo ? getPriceBadge(currentInfo.outputCostPerMillion) : '$';

  // Visible models in active tab
  const models = React.useMemo(() => {
    if (activeTab === 'ALL') {
      return ALL_PROVIDERS.flatMap((p) => getModelsByProvider(p));
    }
    return getModelsByProvider(activeTab);
  }, [activeTab]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 gap-2 px-2.5 rounded-full border border-border/80 bg-background/90 text-xs font-medium shadow-none hover:bg-muted/70 transition-all"
        >
          {currentProviderMeta && (
            <div className="relative size-4 shrink-0 overflow-hidden rounded-full">
              <Image
                src={currentProviderMeta.logoAsset}
                alt={currentProviderMeta.displayName}
                fill
                className="object-contain"
              />
            </div>
          )}
          <span className="truncate max-w-[140px] font-medium text-foreground">
            {currentInfo?.name || selectedModel}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {currentBadge}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[460px] p-0 shadow-xl border rounded-xl overflow-hidden"
      >
        <div className="flex h-[380px]">
          {/* Left Vertical Rail for Providers */}
          <div className="w-[110px] shrink-0 border-r bg-muted/40 p-2 flex flex-col gap-1 overflow-y-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors text-left',
                activeTab === 'ALL'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Star className="size-3.5" />
              <span>All Models</span>
            </button>

            <div className="my-1 border-t border-border" />

            {ALL_PROVIDERS.map((provider) => {
              const meta = PROVIDER_METADATA[provider];
              const hasKey = userValidProviders.includes(provider);
              const isActive = activeTab === provider;

              return (
                <button
                  key={provider}
                  onClick={() => setActiveTab(provider)}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors text-left group',
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : hasKey
                      ? 'text-foreground hover:bg-muted'
                      : 'text-muted-foreground/60 hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative size-4 shrink-0 overflow-hidden">
                      <Image
                        src={meta.logoAsset}
                        alt={meta.displayName}
                        fill
                        className={cn('object-contain', !hasKey && 'opacity-50 grayscale')}
                      />
                    </div>
                    <span className="truncate text-[11px]">{meta.displayName}</span>
                  </div>

                  {!hasKey && (
                    <KeyRound className="size-3 text-muted-foreground/60 shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Panel: Search & Command List */}
          <div className="flex-1 flex flex-col min-w-0">
            <Command className="border-0">
              <CommandInput placeholder="Search models or providers..." className="h-10 text-xs" />
              <CommandList className="flex-1 max-h-[330px] overflow-y-auto p-1.5">
                <CommandEmpty className="p-4 text-center text-xs text-muted-foreground">
                  No models found.
                </CommandEmpty>

                <CommandGroup>
                  {models.map((model: ModelInfo) => {
                    const isSelected = selectedModel === model.id;
                    const hasKey = userValidProviders.includes(model.provider);
                    const isFav = favorites.includes(model.id);
                    const badge = getPriceBadge(model.outputCostPerMillion);
                    const provMeta = PROVIDER_METADATA[model.provider];

                    return (
                      <CommandItem
                        key={model.id}
                        value={`${model.name} ${model.id} ${model.provider}`}
                        onSelect={() => {
                          if (hasKey) {
                            onSelect(model.provider, model.id);
                            setOpen(false);
                          }
                        }}
                        className={cn(
                          'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer',
                          isSelected && 'bg-primary/10 text-primary font-medium',
                          !hasKey && 'opacity-50 cursor-not-allowed hover:bg-transparent'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="relative size-4 shrink-0">
                            <Image
                              src={provMeta.logoAsset}
                              alt={provMeta.displayName}
                              fill
                              className="object-contain"
                            />
                          </div>

                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground truncate">
                                {model.name}
                              </span>
                              {model.isRecommended && (
                                <span className="rounded bg-emerald-500/10 text-emerald-600 px-1 py-0.2 text-[9px] font-semibold">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {model.description}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold"
                          >
                            {badge}
                          </Badge>

                          {hasKey ? (
                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(model.id, e)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-amber-500 transition-colors"
                            >
                              <Star
                                className={cn('size-3.5', isFav && 'fill-amber-400 text-amber-400')}
                              />
                            </button>
                          ) : (
                            <Link
                              href="/settings?tab=api"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                            >
                              Add key
                            </Link>
                          )}

                          {isSelected && <Check className="size-4 text-primary shrink-0 ml-1" />}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
