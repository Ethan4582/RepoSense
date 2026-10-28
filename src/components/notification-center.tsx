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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  ListPagination,
  usePaginatedItems,
} from "~/components/list-pagination";
import { cn } from "~/lib/utils";

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
  const notificationPagination = usePaginatedItems(items, 5);

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
        className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl p-0"
      >
        <div className="border-border/50 flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
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
          <div className="max-h-[22rem] scrollbar-none overflow-y-auto">
            <div className="divide-border/40 flex flex-col divide-y">
              {notificationPagination.paginatedItems.map((item) => {
                const content = (
                  <div
                    className={cn(
                      "hover:bg-muted/50 flex flex-col gap-1.5 px-4 py-3 transition-colors",
                      !item.readAt && "bg-primary/[0.035]",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {!item.readAt && (
                        <span className="bg-primary size-1.5 shrink-0 rounded-full" />
                      )}
                      <p className="text-sm font-semibold">{item.title}</p>
                    </div>
                    <p className="text-muted-foreground text-xs leading-4.5">
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
          </div>
        )}
        {items.length > notificationPagination.pageSize ? (
          <div className="border-border/50 border-t px-2 py-2">
            <ListPagination
              page={notificationPagination.page}
              pageSize={notificationPagination.pageSize}
              totalItems={items.length}
              onPageChange={notificationPagination.setPage}
            />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
