'use client';

import './videos.css';
import { useEffect, useState } from 'react';
import { PlayCircle, Youtube, Sprout, ArrowUpRight, Loader2 } from 'lucide-react';
import { supabase, getVisitorCountry } from '@/lib/supabase/client';
import { getYouTubeEmbedUrl } from '@/lib/youtube';

type Video = { id: string; title: string; description: string | null; youtube_url: string; thumbnail_url: string | null; category: string | null };

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const country = getVisitorCountry();
      const { data } = await supabase.from('videos').select('id,title,description,youtube_url,thumbnail_url,category').eq('country_code', country).eq('is_active', true).order('display_order', { ascending: true });
      setVideos((data || []) as Video[]);
      setLoading(false);
    };
    load();
  }, []);

  return <main className="videos-page min-h-screen">
    <section className="videos-hero">
      <div className="videos-orb videos-orb-one" /><div className="videos-orb videos-orb-two" />
      <div className="container-custom relative z-10 px-4 py-12 sm:py-16 lg:py-20"><div className="mx-auto max-w-3xl text-center">
        <span className="videos-kicker"><Youtube className="h-4 w-4" /> GAZI SEED VIDEOS</span>
        <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">কৃষি, বীজ ও চাষাবাদের ভিডিও</h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-emerald-50 sm:text-base">বীজ বাছাই, বপন, পরিচর্যা এবং আধুনিক চাষাবাদ সম্পর্কে সহজ ও দরকারি ভিডিও এক জায়গায়।</p>
      </div></div>
    </section>
    <section className="container-custom px-4 py-10 sm:py-14 lg:py-16">
      {loading ? <div className="flex items-center justify-center gap-2 py-20 text-sm font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-emerald-700" />ভিডিও লোড হচ্ছে...</div> : videos.length > 0 ? <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => { const embedUrl = getYouTubeEmbedUrl(video.youtube_url); if (!embedUrl) return null; return <article key={video.id} className="video-card group">
          <div className="video-frame-wrap"><iframe src={embedUrl} title={video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="video-frame" /></div>
          <div className="p-5 sm:p-6"><div className="mb-3 flex items-center justify-between gap-3"><span className="video-chip"><PlayCircle className="h-3.5 w-3.5" /> {video.category || 'চাষাবাদ'}</span><a href={video.youtube_url} target="_blank" rel="noopener noreferrer" className="video-external-link" aria-label="YouTube-এ ভিডিও দেখুন"><ArrowUpRight className="h-4 w-4" /></a></div><h2 className="text-xl font-black leading-tight tracking-[-0.02em] text-slate-900">{video.title}</h2>{video.description && <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{video.description}</p>}</div>
        </article>; })}
      </div> : <div className="mx-auto max-w-2xl rounded-[2rem] border border-emerald-100 bg-white px-6 py-16 text-center shadow-[0_30px_80px_-50px_rgba(5,100,55,.4)]"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Sprout className="h-8 w-8" /></div><h2 className="mt-5 text-2xl font-black text-slate-900">ভিডিও শিগগিরই আসছে</h2><p className="mt-2 text-sm leading-6 text-slate-500">আমাদের নতুন কৃষি ও চাষাবাদ বিষয়ক ভিডিও এখানে যোগ করা হবে।</p></div>}
    </section>
  </main>;
}
