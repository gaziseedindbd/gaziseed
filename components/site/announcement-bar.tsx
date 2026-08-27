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
    <div className="bg-primary text-primary-foreground">
      <div className="container-custom flex items-center justify-center py-2 text-center text-sm font-medium">
        {current.link ? (
          <a href={current.link} className="hover:underline">
            {current.message}
          </a>
        ) : (
          <span>{current.message}</span>
        )}
      </div>
    </div>
  );
}
