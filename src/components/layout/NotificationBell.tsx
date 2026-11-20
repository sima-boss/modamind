"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  CalendarSync,
  Coins,
  Gauge,
  Package,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { countProducts } from "@/lib/supabase/queries";
import type { SubscriptionWithPlan } from "@/lib/supabase/types";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/events";
import {
  buildNotifications,
  loadReadIds,
  saveReadIds,
  type NotificationIcon,
  type NotificationKind,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationIcon, LucideIcon> = {
  usage: Gauge,
  credits: Coins,
  products: Package,
  plan: CalendarClock,
  renewal: CalendarSync,
};

const ICON_COLORS: Record<NotificationKind, string> = {
  danger: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-primary",
};

interface NotificationBellProps {
  subscription: SubscriptionWithPlan | null;
  userId: string | undefined;
}

export function NotificationBell({ subscription, userId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Product count isn't on the subscription row; refresh it alongside it.
  useEffect(() => {
    function loadCount() {
      countProducts(createClient())
        .then(setProductCount)
        .catch(() => setProductCount(0));
    }
    loadCount();
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, loadCount);
    return () => window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, loadCount);
  }, []);

  useEffect(() => {
    if (userId) setReadIds(loadReadIds(userId));
  }, [userId]);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const notifications = useMemo(
    () => (subscription ? buildNotifications(subscription, productCount) : []),
    [subscription, productCount]
  );
  const hasUnread = notifications.some((n) => !readIds.has(n.id));

  function markAllRead() {
    const ids = new Set(notifications.map((n) => n.id));
    setReadIds(ids);
    if (userId) saveReadIds(userId, ids);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={hasUnread ? "Notifications (unread)" : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {hasUnread && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up
            </p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {notifications.map((n) => {
                const Icon = ICONS[n.icon];
                const unread = !readIds.has(n.id);
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 hover:bg-accent"
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_COLORS[n.kind])} />
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>
                          {n.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={n.detail}>
                          {n.detail}
                        </p>
                      </div>
                      {unread && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
