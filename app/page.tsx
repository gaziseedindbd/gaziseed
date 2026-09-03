'use client';

import { useState } from 'react';
import { Search, ShoppingCart, UserRound, MapPin, Sprout, Truck, ShieldCheck, Headphones } from 'lucide-react';
import { COUNTRY_CONFIG, type CountryCode, formatMoney } from '@/lib/country';

const demoProducts = [
  { name: 'Premium Tomato Seeds', category: 'Vegetable Seeds', price: 120, country: 'BD' as CountryCode },
  { name: 'Hybrid Chilli Seeds', category: 'Vegetable Seeds', price: 95, country: 'BD' as CountryCode },
  { name: 'High Yield Coriander', category: 'Herb Seeds', price: 80, country: 'BD' as CountryCode },
  { name: 'Premium Marigold Seeds', category: 'Flower Seeds', price: 70, country: 'BD' as CountryCode },
];

export default function HomePage() {
  const [country, setCountry] = useState<CountryCode>('BD');
  const cfg = COUNTRY_CONFIG[country];

  return (
    <main className="min-h-screen">
      <div className="bg-[#123c23] px-4 py-2 text-center text-sm text-white">Premium seeds • Trusted quality • Delivery across {cfg.name}</div>
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <div className="flex items-center gap-2 text-2xl font-black text-[#1f6b3b]"><Sprout /> GAZI SEED</div>
          <div className="hidden flex-1 items-center rounded-xl border bg-gray-50 px-4 md:flex"><Search className="mr-2 text-gray-400" size={20}/><input className="w-full bg-transparent py-2 outline-none" placeholder="Search seeds, varieties, brands..." /></div>
          <select value={country} onChange={e => setCountry(e.target.value as CountryCode)} className="rounded-lg border px-3 py-2 text-sm font-semibold"><option value="BD">🇧🇩 Bangladesh</option><option value="IN">🇮🇳 India</option></select>
          <button className="hidden items-center gap-2 rounded-lg px-2 py-2 sm:flex"><UserRound size={20}/> Account</button>
          <button className="relative rounded-lg p-2"><ShoppingCart size={22}/><span className="absolute -right-1 -top-1 rounded-full bg-[#1f6b3b] px-1.5 text-xs text-white">0</span></button>
        </div>
        <nav className="hidden border-t md:block"><div className="mx-auto flex max-w-7xl gap-7 px-4 py-3 text-sm font-semibold"><span>All Categories</span><span>Vegetable Seeds</span><span>Flower Seeds</span><span>Fruit Seeds</span><span>Herb Seeds</span><span>Offers</span><span>Seed Guide</span></div></nav>
      </header>

      <section className="bg-gradient-to-br from-[#e8f3e8] via-white to-[#f4ead9]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div><p className="mb-3 font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">Grow better. Grow smarter.</p><h1 className="text-4xl font-black leading-tight text-[#172018] md:text-6xl">Premium seeds for a <span className="text-[#1f6b3b]">better harvest.</span></h1><p className="mt-5 max-w-xl text-lg text-gray-600">Discover carefully selected seeds, reliable varieties and practical cultivation guidance — built for growers in India and Bangladesh.</p><div className="mt-8 flex flex-wrap gap-3"><button className="rounded-xl bg-[#1f6b3b] px-6 py-3 font-bold text-white shadow-lg">Shop Seeds</button><button className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold">Find Your Seed</button></div></div>
          <div className="rounded-3xl bg-[#1f6b3b] p-8 text-white shadow-2xl"><div className="text-7xl">🌱</div><p className="mt-6 text-sm uppercase tracking-widest opacity-80">GAZI SEED</p><h2 className="mt-2 text-3xl font-bold">Quality in every packet.</h2><p className="mt-3 opacity-85">Country-aware pricing, delivery and product availability.</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Feature icon={<Truck/>} title="Reliable Delivery" text={`Across ${cfg.name}`} /><Feature icon={<ShieldCheck/>} title="Quality Focused" text="Selected seed varieties" /><Feature icon={<Sprout/>} title="Grower Friendly" text="Practical seed guidance" /><Feature icon={<Headphones/>} title="Customer Support" text="We're here to help" /></div></section>

      <section className="mx-auto max-w-7xl px-4 pb-16"><div className="mb-6 flex items-end justify-between"><div><p className="font-semibold text-[#1f6b3b]">Featured collection</p><h2 className="text-3xl font-black">Popular seeds</h2></div><button className="font-bold text-[#1f6b3b]">View all →</button></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{demoProducts.map((p) => <article key={p.name} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex h-44 items-center justify-center bg-[#edf5e9] text-6xl">🌿</div><div className="p-4"><p className="text-xs font-semibold text-gray-500">{p.category}</p><h3 className="mt-1 font-bold">{p.name}</h3><div className="mt-4 flex items-center justify-between"><strong className="text-xl text-[#1f6b3b]">{formatMoney(p.price, country)}</strong><button className="rounded-lg bg-[#1f6b3b] px-3 py-2 text-sm font-bold text-white">Add</button></div></div></article>)}</div></section>
      <footer className="bg-[#123c23] px-4 py-10 text-center text-sm text-white/80">© {new Date().getFullYear()} GAZI SEED. Premium seeds & agriculture.</footer>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex gap-3 rounded-2xl border bg-white p-5"><div className="text-[#1f6b3b]">{icon}</div><div><h3 className="font-bold">{title}</h3><p className="text-sm text-gray-500">{text}</p></div></div>; }
