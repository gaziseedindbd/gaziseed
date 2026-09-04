import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand)] text-2xl font-extrabold text-white">
          SB
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
          SEED BARI
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">পৃষ্ঠা পাওয়া যায়নি</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-black/60 sm:text-base">
          আপনি যে পেজটি খুঁজছেন সেটি হয় সরানো হয়েছে, নয়তো ঠিকানা পরিবর্তন করা হয়েছে।
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            হোমে ফিরুন
          </Link>
          <Link
            href="/shop"
            className="rounded-xl border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-black/[0.03]"
          >
            সব পণ্য দেখুন
          </Link>
        </div>
      </div>
    </main>
  );
}
