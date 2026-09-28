"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Bell,
  CheckCheck,
  Clock,
  Gavel,
  Heart,
  Megaphone,
  MessageSquare,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@juryza/ui/components/ui/popover";
import { ScrollArea } from "@juryza/ui/components/ui/scroll-area";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { cn } from "@juryza/ui/lib/utils";

import type { NotificationItem } from "@/app/api/me/notifications/route";
import type { Viewer } from "@/components/viewer";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";

const STORAGE_KEY = "juryza_read_notifications";

export function NotificationPanel({ viewer: _viewer }: { viewer?: Viewer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Load read notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setReadIds(new Set(JSON.parse(stored) as string[]));
      }
    } catch {}
  }, []);

  const saveRead = (ids: Set<string>) => {
    setReadIds(ids);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {}
  };

  const { data, isLoading } = useQuery({
    queryKey: ["me", "notifications"],
    queryFn: () => api.get<{ notifications: NotificationItem[] }>("/api/me/notifications"),
    refetchInterval: 30_000, // poll every 30s for updates
  });

  const allItems = data?.notifications ?? [];
  const unreadCount = allItems.filter((i) => !readIds.has(i.id)).length;

  const markAsRead = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    saveRead(next);
  };

  const markAllAsRead = () => {
    const next = new Set(readIds);
    for (const item of allItems) next.add(item.id);
    saveRead(next);
  };

  const displayedItems =
    filter === "unread" ? allItems.filter((i) => !readIds.has(i.id)) : allItems;

  const iconFor = (type: NotificationItem["type"]) => {
    switch (type) {
      case "team":
        return <UsersRound className="size-4 text-blue-500" />;
      case "announcement":
        return <Megaphone className="size-4 text-amber-500" />;
      case "deadline":
        return <Clock className="size-4 text-rose-500" />;
      case "vote":
        return <Heart className="size-4 text-pink-500" />;
      case "comment":
        return <MessageSquare className="size-4 text-emerald-500" />;
      case "certificate":
        return <Award className="size-4 text-yellow-500" />;
      case "assignment":
        return <Gavel className="size-4 text-indigo-500" />;
      default:
        return <Sparkles className="size-4 text-primary" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Notifications (${unreadCount} unread)`}
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 sm:w-96 p-0 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={markAllAsRead}
              >
                <CheckCheck className="size-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-1.5 text-xs">
          <button
            type="button"
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              filter === "all"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setFilter("all")}
          >
            All ({allItems.length})
          </button>
          <button
            type="button"
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              filter === "unread"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setFilter("unread")}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <ScrollArea className="max-h-[420px]">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : displayedItems.length === 0 ? (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell className="size-6 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-medium">
                  {filter === "unread" ? "No unread notifications" : "All caught up!"}
                </EmptyTitle>
                <EmptyDescription className="text-xs">
                  {filter === "unread"
                    ? "You've read all your notifications."
                    : "Team joins, announcements, votes, and deadlines will appear here."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y">
              {displayedItems.map((item) => {
                const isRead = readIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      markAsRead(item.id);
                      setOpen(false);
                      router.push(item.href);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/60",
                      !isRead && "bg-primary/5 font-normal"
                    )}
                  >
                    <div className="mt-0.5 shrink-0 rounded-full border bg-background p-1.5 shadow-xs">
                      {iconFor(item.type)}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "truncate text-xs font-semibold",
                            !isRead ? "text-foreground" : "text-foreground/80"
                          )}
                        >
                          {item.title}
                        </span>
                        {item.badge && (
                          <Badge
                            variant={item.type === "deadline" ? "destructive" : "outline"}
                            className="px-1.5 py-0 text-[10px] shrink-0 font-normal"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{relativeTime(item.createdAt)}</span>
                        {!isRead && (
                          <span className="flex items-center gap-1 text-primary text-[10px] font-medium">
                            <span className="size-1.5 rounded-full bg-primary" /> Unread
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
