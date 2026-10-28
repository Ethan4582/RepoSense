'use client';

import * as React from 'react';
import { Send, Loader2, Zap, ChevronDown, Check, Search, LockKeyhole, Star } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { MODEL_CATALOG, getModelInfo, PROVIDER_METADATA } from '~/lib/providers/catalog';
import type { ProviderId } from '~/lib/providers/types';
import { cn } from '~/lib/utils';

interface WikiComposerProps {
  question: string;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
  streaming: boolean;
  repoName: string;
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
  availableKeys?: string[];
  placeholder?: string;
  tocWidth?: number;
  navigationWidth?: number;
}

export function WikiComposer({
  question,
  onQuestionChange,
  onSubmit,
  streaming,
  repoName,
  selectedModel,
  onModelSelect,
  availableKeys = [],
  placeholder,
  tocWidth = 0,
  navigationWidth = 0,
}: WikiComposerProps) {
  const [modelOpen, setModelOpen] = React.useState(false);
  const [providerFilter, setProviderFilter] = React.useState<string>('FAVORITES');
  const [modelSearch, setModelSearch] = React.useState('');
  const [favorites, setFavorites] = React.useState<string[]>(() => {
    if (typeof window === 'undefined') return ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022'];
    try {
      const saved = localStorage.getItem('reposense_favorite_models');
      return saved ? JSON.parse(saved) : ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022'];
    } catch {
      return ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022'];
    }
  });

  const toggleFavorite = (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId];
      try {
        localStorage.setItem('reposense_favorite_models', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const modelInfo = getModelInfo(selectedModel);
  const displayName = modelInfo?.name ?? 'Fast';

  // Filter available models
  const eligibleModels = React.useMemo(() => {
    return MODEL_CATALOG.filter((m) => {
      if (m.isEmbedding) return false;
      const matchesSearch = m.name.toLowerCase().includes(modelSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (providerFilter === 'FAVORITES') {
        return favorites.includes(m.id);
      }
      return m.provider === providerFilter;
    });
  }, [modelSearch, providerFilter, favorites]);

  const providers = Object.values(PROVIDER_METADATA);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (question.trim() && !streaming) {
        onSubmit();
      }
    }
  };

  const providerMeta = modelInfo?.provider
    ? PROVIDER_METADATA[modelInfo.provider as keyof typeof PROVIDER_METADATA]
    : undefined;

  return (
    <div className="pointer-events-none w-full flex justify-center">
      <div className="group bg-background/85 focus-within:border-primary/30 pointer-events-auto w-full rounded-2xl border border-border/70 shadow-lg backdrop-blur-xl transition-colors">
        <textarea
          ref={textareaRef}
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? `Ask about ${repoName}...`}
          rows={2}
          className="min-h-18 w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 outline-none"
        />

        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <Popover open={modelOpen} onOpenChange={setModelOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground/90 backdrop-blur-sm transition-colors hover:bg-muted/40"
              >
                {providerMeta?.logoAsset ? (
                  <img src={providerMeta.logoAsset} alt={providerMeta.displayName} className="size-3.5 object-contain" />
                ) : (
                  <span className="size-2 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                )}
                <span className="max-w-[120px] truncate">{displayName}</span>
                <ChevronDown className="size-2.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
              <div className="border-b border-border/60 px-3.5 py-2.5">
                <div className="mb-1.5 text-xs font-semibold text-foreground">Choose a model</div>
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5"><Search className="size-3.5 text-muted-foreground" /><input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Search models..." className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" /></div>
              </div>
              <div className="grid max-h-72 grid-cols-[7.5rem_1fr] overflow-hidden">
                <div className="space-y-1 overflow-y-auto border-r border-border/60 bg-muted/20 p-1.5">
                  <button
                    type="button"
                    onClick={() => setProviderFilter('FAVORITES')}
                    className={cn(
                      'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                      providerFilter === 'FAVORITES' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    <span>Favorites</span>
                  </button>
                  {providers.map((item) => {
                    const enabled = availableKeys.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setProviderFilter(item.id)}
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                          providerFilter === item.id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <img src={item.logoAsset} alt="" className="size-3.5 object-contain" />
                        <span className="min-w-0 flex-1 truncate">{item.displayName}</span>
                        {!enabled ? <LockKeyhole className="size-2.5 opacity-50" /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-1 overflow-y-auto p-2">
                  {eligibleModels.map((m) => {
                    const isSelected = m.id === selectedModel;
                    const hasKey = availableKeys.includes(m.provider);
                    const isFav = favorites.includes(m.id);
                    const provider = PROVIDER_METADATA[m.provider as keyof typeof PROVIDER_METADATA];
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (!hasKey) return;
                          onModelSelect(m.id);
                          setModelOpen(false);
                        }}
                        className={cn(
                          'group flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                          isSelected
                            ? 'bg-primary/10 font-medium text-primary'
                            : hasKey ? 'text-muted-foreground hover:bg-muted hover:text-foreground' : 'cursor-not-allowed text-muted-foreground/40'
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-1.5 truncate">
                          {provider?.logoAsset ? <img src={provider.logoAsset} alt="" className="size-3.5 shrink-0 object-contain" /> : null}
                          <span className="truncate">{m.name}</span>
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                            onClick={(e) => toggleFavorite(e, m.id)}
                            className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-amber-400 group-hover:opacity-100"
                          >
                            <Star className={cn('size-3.5', isFav ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                          </button>
                          {!hasKey ? <span className="text-[9px] text-muted-foreground/60">Add key</span> : null}
                          {isSelected ? <Check className="size-3 text-primary shrink-0" /> : null}
                        </div>
                      </div>
                    );
                  })}
                  {eligibleModels.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      {providerFilter === 'FAVORITES' ? 'No favorite models yet. Star models to quickly access them here.' : 'No models match your search.'}
                    </div>
                  ) : null}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!question.trim() || streaming}
            aria-label="Send message"
            className="inline-flex size-7 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-foreground dark:text-background"
          >
            {streaming ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
