"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, BellRing, CheckCheck, RefreshCw } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationCenter() {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  const load = React.useCallback(async () => {
    const response = await fetch("/api/me/notifications", {
      cache: "no-store",
    });
    if (!response.ok) {
      setFailed(true);
      setLoading(false);
      return;
    }
    const body = (await response.json()) as {
      notifications?: NotificationItem[];
    };
    setItems(body.notifications ?? []);
    setFailed(false);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const unread = items.filter((item) => !item.readAt).length;

  const markAllRead = async () => {
    await fetch("/api/me/notifications/read-all", { method: "POST" });
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    );
  };

  const markRead = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
          : item,
      ),
    );
    void fetch(`/api/me/notifications/${id}/read`, { method: "PATCH" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 min-w-5 justify-center px-1 text-[10px]">
              {Math.min(unread, 99)}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] rounded-xl p-2"
      >
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-muted-foreground text-xs">
              Indexing, access, and review updates
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void markAllRead()}
            >
              <CheckCheck data-icon="inline-start" />
              Mark all read
            </Button>
          )}
        </div>
        {loading ? (
          <Empty className="min-h-44 gap-3 p-6">
            <EmptyMedia variant="icon">
              <RefreshCw className="animate-spin" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-sm">Loading updates</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : failed ? (
          <Empty className="min-h-44 gap-3 p-6">
            <EmptyMedia variant="icon">
              <BellRing />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-sm">Updates unavailable</EmptyTitle>
              <EmptyDescription>
                We could not load notifications right now.
              </EmptyDescription>
            </EmptyHeader>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw data-icon="inline-start" />
              Try again
            </Button>
          </Empty>
        ) : items.length === 0 ? (
          <Empty className="min-h-44 gap-3 p-6">
            <EmptyMedia variant="icon">
              <BellRing />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-sm">
                You&apos;re all caught up
              </EmptyTitle>
              <EmptyDescription>
                Wiki updates, reviews, and access changes will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea className="h-96">
            <div className="flex flex-col">
              {items.map((item) => {
                const content = (
                  <div className="hover:bg-muted/50 flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors">
                    <div className="flex items-center gap-2">
                      {!item.readAt && (
                        <span className="bg-primary size-2 rounded-full" />
                      )}
                      <p className="text-sm font-medium">{item.title}</p>
                    </div>
                    <p className="text-muted-foreground text-xs leading-5">
                      {item.message}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                );
                return item.href ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => markRead(item.id)}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    className="text-left"
                    onClick={() => markRead(item.id)}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
