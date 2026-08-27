'use client';

import { Check, Clock3, MapPin, MessageCircle, PackageCheck, ShieldCheck, Truck } from 'lucide-react';

const deliveryRules = [
  { title: 'অর্ডার ৳৬০০ বা তার বেশি', subtitle: 'আপনার অর্ডারের ডেলিভারি সম্পূর্ণ ফ্রি 🎉', charge: 'ফ্রি', featured: true },
  { title: 'অর্ডার ৳৪০০ – ৳৫৯৯', subtitle: 'সাশ্রয়ী ডেলিভারি চার্জ', charge: '৳৫০' },
  { title: 'অর্ডার ৳২০০ – ৳৩৯৯', subtitle: 'নিয়মিত ডেলিভারি চার্জ', charge: '৳৭০' },
  { title: 'অর্ডার ৳২০০ এর কম', subtitle: 'ছোট অর্ডারের জন্য প্রযোজ্য', charge: '৳১২০' },
];

const WHATSAPP_NUMBER = '8801XXXXXXXXX';
const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('আসসালামু আলাইকুম, SEED BARI-এর ডেলিভারি চার্জ সম্পর্কে জানতে চাই।')}`;

export default function ChargesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/70 via-white to-white">
      <div className="container-custom py-8 sm:py-10 lg:py-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 px-6 py-10 text-white shadow-xl sm:px-10 lg:px-14 lg:py-14">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-lime-300/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
              <Truck className="h-4 w-4" />
              সারা বাংলাদেশে হোম ডেলিভারি
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              সহজ ও স্বচ্ছ <span className="text-lime-200">ডেলিভারি চার্জ</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 sm:text-base">
              আপনার অর্ডারের মোট মূল্যের ভিত্তিতে ডেলিভারি চার্জ নির্ধারিত হয়। অর্ডার করার আগে এখানে সহজেই জেনে নিন আপনার জন্য প্রযোজ্য চার্জ।
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-emerald-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50">
                <MessageCircle className="h-5 w-5" />
                WhatsApp-এ জিজ্ঞাসা করুন
              </a>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur">
                <PackageCheck className="h-5 w-5" />
                নিরাপদ হোম ডেলিভারি
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 sm:text-2xl">ডেলিভারি চার্জ তালিকা</h2>
                <p className="mt-1 text-sm text-gray-500">অর্ডারের মোট মূল্য অনুযায়ী প্রযোজ্য চার্জ</p>
              </div>
            </div>

            <div className="space-y-3">
              {deliveryRules.map((rule) => (
                <div key={rule.title} className={`flex items-center justify-between gap-4 rounded-2xl border p-4 sm:px-5 sm:py-4 ${rule.featured ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50/70'}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-900">{rule.title}</h3>
                      {rule.featured && <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-extrabold text-white">BEST VALUE</span>}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{rule.subtitle}</p>
                  </div>
                  <div className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-extrabold ${rule.featured ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-800 shadow-sm'}`}>
                    {rule.charge}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Clock3 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-gray-900">আনুমানিক ডেলিভারি সময়</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="flex items-center gap-2 text-gray-600"><MapPin className="h-4 w-4 text-emerald-700" /> ঢাকার ভিতরে</span>
                  <span className="font-bold text-gray-900">১ – ২ দিন</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="flex items-center gap-2 text-gray-600"><MapPin className="h-4 w-4 text-emerald-700" /> ঢাকার বাইরে</span>
                  <span className="font-bold text-gray-900">২ – ৩ দিন</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
              <ShieldCheck className="h-8 w-8 text-emerald-700" />
              <h3 className="mt-4 text-lg font-extrabold text-gray-900">স্বচ্ছ ও নির্ভরযোগ্য</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">চেকআউটে আপনার অর্ডারের জন্য প্রযোজ্য ডেলিভারি চার্জ স্বয়ংক্রিয়ভাবে হিসাব করা হবে।</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">গুরুত্বপূর্ণ তথ্য</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-gray-600 sm:grid-cols-2">
                <li>• ডেলিভারি চার্জ অর্ডারের মোট মূল্যের ভিত্তিতে নির্ধারিত হয়।</li>
                <li>• ৳৬০০ বা তার বেশি অর্ডারে ডেলিভারি সম্পূর্ণ ফ্রি।</li>
                <li>• অ্যাডমিন থেকে Free Delivery অফার চালু থাকলে চার্জ ৳০ হবে।</li>
                <li>• বিশেষ এলাকা বা পরিস্থিতিতে চার্জ/সময় পরিবর্তিত হলে অর্ডারের সময় জানানো হবে।</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl bg-gray-900 px-6 py-8 text-white shadow-lg sm:px-8 sm:py-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold text-emerald-300">কোনো প্রশ্ন আছে?</p>
              <h2 className="mt-1 text-2xl font-extrabold">ডেলিভারি চার্জ নিয়ে সরাসরি কথা বলুন</h2>
              <p className="mt-2 text-sm text-gray-300">আপনার এলাকা ও অর্ডার সম্পর্কে জানালে আমরা সাহায্য করতে পারি।</p>
            </div>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-500 px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-emerald-400">
              <MessageCircle className="h-5 w-5" />
              WhatsApp-এ যোগাযোগ করুন
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
