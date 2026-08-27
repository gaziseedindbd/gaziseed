'use client';

import { useEffect, useState } from 'react';
import { getServices } from '@/lib/data';
import type { Service } from '@/lib/supabase/types';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Sprout,
} from 'lucide-react';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServices().then((s) => {
      setServices(s);
      setLoading(false);
    });
  }, []);

  return (
    <main className="min-h-screen bg-background">
      {/* Compact premium hero — keeps the service content above the fold. */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/[0.08] via-background to-background">
        <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="container-custom relative py-9 sm:py-12 lg:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary shadow-sm backdrop-blur">
              <Sprout className="h-3.5 w-3.5" />
              SEED BARI • CUSTOMER CARE
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              আমাদের সেবাসমূহ
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              ভালো বীজের পাশাপাশি আপনার চাষাবাদ ও বাগানের প্রতিটি গুরুত্বপূর্ণ ধাপে
              SEED BARI আপনার পাশে।
            </p>
          </div>

          <div className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['বিশ্বস্ত পরামর্শ', 'সঠিক সিদ্ধান্তে সহায়তা'],
              ['সহজ যোগাযোগ', 'প্রয়োজনে দ্রুত কথা বলুন'],
              ['গ্রাহক-কেন্দ্রিক সেবা', 'আপনার প্রয়োজনই অগ্রাধিকার'],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3 text-center shadow-sm backdrop-blur"
              >
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-custom py-9 sm:py-12 lg:py-14">
        <div className="mb-7 flex items-end justify-between gap-4 sm:mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">HOW WE HELP</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              আপনার প্রয়োজন, আমাদের সহায়তা
            </h2>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <ShieldCheck className="h-4 w-4 text-primary" />
            বিশ্বস্ত সেবা
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl border border-border bg-secondary/60" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <Sprout className="mx-auto h-10 w-10 text-primary/60" />
            <h3 className="mt-4 text-lg font-semibold">সেবাসমূহ শীঘ্রই আসছে</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              SEED BARI-এর নতুন সেবাগুলো খুব শিগগির এখানে প্রকাশ করা হবে।
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {services.map((svc, index) => (
              <article
                key={svc.id}
                className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl"
              >
                <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-primary/[0.05] blur-2xl transition-transform duration-500 group-hover:scale-150" />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                    <Sprout className="h-7 w-7" />
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                <h3 className="relative mt-5 text-xl font-bold tracking-tight text-foreground">
                  {svc.title}
                </h3>
                <p className="relative mt-2 min-h-[72px] text-sm leading-6 text-muted-foreground">
                  {svc.short_description}
                </p>

                <div className="my-4 h-px bg-border/70" />

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    প্রয়োজন অনুযায়ী সহায়তা
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    সহজ ও সরাসরি যোগাযোগ
                  </div>
                </div>

                {svc.cta_text && (
                  <a
                    href={svc.cta_url || '#'}
                    className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                  >
                    {svc.cta_text}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="container-custom pb-12 sm:pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-9 text-primary-foreground shadow-xl sm:px-10 sm:py-10">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
                Need help?
              </p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                আপনার প্রশ্ন আছে? আমরা কথা বলতে প্রস্তুত।
              </h2>
              <p className="mt-2 text-sm leading-6 text-primary-foreground/80 sm:text-base">
                পণ্য, বীজ নির্বাচন বা চাষাবাদ নিয়ে জানতে সরাসরি আমাদের সঙ্গে যোগাযোগ করুন।
              </p>
            </div>

            <a
              href="https://wa.me/9196002768881"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-background px-5 py-3 text-sm font-bold text-foreground shadow-lg transition hover:opacity-90"
            >
              <MessageCircle className="h-5 w-5" />
              WhatsApp-এ যোগাযোগ করুন
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
