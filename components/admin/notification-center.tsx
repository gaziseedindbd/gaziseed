'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { AdminNotification } from '@/lib/supabase/types';

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) {
      setNotifications(data as AdminNotification[]);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: adminCheck } = await supabase.rpc('is_admin');
      if (!adminCheck) return;
      fetchNotifications();
      interval = setInterval(fetchNotifications, 30000);
    })();
    return () => { if (interval) clearInterval(interval); };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id: string) => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
    fetchNotifications();
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'এখন';
    if (mins < 60) return `${mins} মিনিট আগে`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ঘণ্টা আগে`;
    return `${Math.floor(hours / 24)} দিন আগে`;
  };

  const iconForType = (type: string) => {
    switch (type) {
      case 'order': return '🛒';
      case 'review': return '⭐';
      case 'contact': return '✉️';
      case 'support': return '🎧';
      default: return '🔔';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[60]" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card border border-border shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-14 w-80 max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border p-3">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-medium text-primary hover:underline">
                  Mark All Read
                </button>
              )}
              <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
          </div>
          <div className="max-h-[55vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No notifications</p>
            ) : (
              notifications.map((n) => (
                <a
                  key={n.id}
                  href={n.link}
                  onClick={() => markRead(n.id)}
                  className={`flex items-start gap-3 border-b border-border/50 p-3 transition-colors hover:bg-secondary/30 ${
                    !n.is_read ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="text-lg">{iconForType(n.type)}</span>
                  <div className="flex-1">
                    <p className={`text-sm ${!n.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
