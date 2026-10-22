'use client';

import * as React from 'react';
import { ArrowDown } from 'lucide-react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';

// --- MessageScroller Context & Provider ---
interface MessageScrollerContextType {
  autoScroll: boolean;
  scrollToBottom: () => void;
  isAtBottom: boolean;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}

const MessageScrollerContext = React.createContext<MessageScrollerContextType>({
  autoScroll: true,
  scrollToBottom: () => undefined,
  isAtBottom: true,
  viewportRef: { current: null },
});

export function useMessageScroller() {
  return React.useContext(MessageScrollerContext);
}

export function MessageScrollerProvider({
  autoScroll = true,
  children,
}: {
  autoScroll?: boolean;
  children: React.ReactNode;
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  const scrollToBottom = React.useCallback(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setIsAtBottom(atBottom);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <MessageScrollerContext.Provider
      value={{ autoScroll, scrollToBottom, isAtBottom, viewportRef }}
    >
      {children}
    </MessageScrollerContext.Provider>
  );
}

export function MessageScroller({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('relative flex h-full w-full flex-col overflow-hidden', className)} {...props}>
      {children}
    </div>
  );
}

export function MessageScrollerViewport({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { viewportRef, autoScroll } = useMessageScroller();

  React.useEffect(() => {
    if (autoScroll && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  });

  return (
    <div
      ref={viewportRef}
      className={cn('h-full w-full overflow-y-auto overflow-x-hidden p-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function MessageScrollerContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-6 max-w-4xl mx-auto pb-6', className)} {...props}>
      {children}
    </div>
  );
}

export function MessageScrollerItem({
  messageId,
  scrollAnchor,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  messageId?: string;
  scrollAnchor?: boolean;
}) {
  return (
    <div
      data-message-id={messageId}
      data-scroll-anchor={scrollAnchor ? 'true' : undefined}
      className={cn('w-full', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function MessageScrollerButton({
  direction = 'end',
  className,
}: {
  direction?: 'start' | 'end';
  className?: string;
}) {
  const { isAtBottom, scrollToBottom } = useMessageScroller();

  if (isAtBottom) return null;

  return (
    <div className={cn('absolute bottom-4 right-6 z-20', className)}>
      <Button
        variant="secondary"
        size="icon"
        className="rounded-full shadow-md hover:shadow-lg border bg-background/95 backdrop-blur-sm"
        onClick={scrollToBottom}
        aria-label="Scroll to latest messages"
      >
        <ArrowDown className="size-4" />
      </Button>
    </div>
  );
}

// --- Message Row Layout ---
export function Message({
  align = 'start',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: 'start' | 'end';
}) {
  return (
    <div
      className={cn(
        'flex w-full gap-3',
        align === 'end' ? 'flex-row-reverse items-start' : 'flex-row items-start',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function MessageAvatar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex size-8 shrink-0 select-none items-center justify-center rounded-full', className)} {...props}>
      {children}
    </div>
  );
}

export function MessageContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1 max-w-[85%]', className)} {...props}>
      {children}
    </div>
  );
}

export function MessageHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-xs font-medium text-muted-foreground px-1', className)} {...props}>
      {children}
    </div>
  );
}

export function MessageFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-[11px] text-muted-foreground px-1', className)} {...props}>
      {children}
    </div>
  );
}

// --- Bubble Surface ---
export function Bubble({
  variant = 'default',
  align = 'start',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'secondary' | 'muted' | 'tinted' | 'outline' | 'ghost' | 'destructive';
  align?: 'start' | 'end';
}) {
  const variantStyles = {
    default: align === 'end' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    muted: 'bg-muted text-muted-foreground',
    tinted: 'bg-primary/10 text-primary border border-primary/20',
    outline: 'border border-border bg-card text-card-foreground',
    ghost: 'bg-transparent text-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
  };

  return (
    <div
      className={cn(
        'relative rounded-2xl px-4 py-3 text-sm shadow-sm transition-all',
        align === 'end' ? 'rounded-br-sm' : 'rounded-bl-sm',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function BubbleContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('leading-relaxed break-words', className)} {...props}>
      {children}
    </div>
  );
}

export function BubbleReactions({
  side = 'bottom',
  align = 'end',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 mt-1',
        align === 'end' ? 'justify-end' : 'justify-start',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// --- System Notes & Markers ---
export function Marker({
  variant = 'separator',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'separator' | 'border';
}) {
  if (variant === 'separator') {
    return (
      <div className={cn('relative my-4 flex items-center justify-center', className)} {...props}>
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative bg-background px-3 text-xs text-muted-foreground">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 py-2 text-xs text-muted-foreground', className)} {...props}>
      {children}
    </div>
  );
}

export function MarkerContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('font-medium', className)} {...props}>
      {children}
    </span>
  );
}

// --- Attachment ---
export function AttachmentGroup({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      {children}
    </div>
  );
}

export function Attachment({
  state = 'done',
  size = 'default',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  state?: 'idle' | 'uploading' | 'processing' | 'error' | 'done';
  size?: 'default' | 'sm' | 'xs';
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-card p-2.5 text-xs text-card-foreground shadow-sm transition-colors hover:bg-muted/50 cursor-pointer',
        state === 'uploading' || state === 'processing' ? 'animate-pulse' : '',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AttachmentMedia({
  variant = 'icon',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'icon' | 'image';
}) {
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AttachmentContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col min-w-0 flex-1', className)} {...props}>
      {children}
    </div>
  );
}

export function AttachmentTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('font-medium text-foreground truncate', className)} {...props}>
      {children}
    </p>
  );
}

export function AttachmentDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-[11px] text-muted-foreground truncate', className)} {...props}>
      {children}
    </p>
  );
}

export function AttachmentActions({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-1 shrink-0', className)} {...props}>
      {children}
    </div>
  );
}
