'use client';

import { useEffect, useState } from 'react';
import { getAnnouncements } from '@/lib/data';
import type { Announcement } from '@/lib/supabase/types';

export function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    getAnnouncements().then(setAnnouncements);
  }, []);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [announcements.length]);

  if (announcements.length === 0) return null;

  const current = announcements[currentIdx];

  return (
    <div className="relative overflow-hidden bg-foreground text-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,hsl(var(--primary)/.28),transparent_32%),radial-gradient(circle_at_80%_50%,hsl(var(--accent)/.18),transparent_30%)]" />
      <div className="container-custom relative flex min-h-9 items-center justify-center px-4 py-2 text-center text-[11px] font-bold tracking-wide sm:text-xs">
        <span className="mr-2 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/.14)]" aria-hidden="true" />
        {current.link ? (
          <a href={current.link} className="transition-opacity hover:opacity-80 hover:underline underline-offset-4">
            {current.message}
          </a>
        ) : (
          <span>{current.message}</span>
        )}
      </div>
    </div>
  );
}
