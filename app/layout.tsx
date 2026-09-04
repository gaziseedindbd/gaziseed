import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getStoreCountry } from '@/lib/seed-bari/context';

export const metadata: Metadata = {
  title: {
    default: 'SEED BARI — Premium Seeds & Agriculture',
    template: '%s | SEED BARI',
  },
  description:
    'SEED BARI provides genuine premium seed varieties and agriculture products for growers in Bangladesh and India.',
  keywords: [
    'SEED BARI',
    'seed shop',
    'premium seeds',
    'vegetable seeds',
    'agriculture seeds',
    'Bangladesh seeds',
    'India seeds',
  ],
  applicationName: 'SEED BARI',
  category: 'agriculture',
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const country = await getStoreCountry('BD');
  const isBangladesh = country === 'BD';

  return (
    <html lang={isBangladesh ? 'bn-BD' : 'en-IN'} dir="ltr">
      <body>
        <div className="min-h-screen">{children}</div>

        <footer className="border-t bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-lg font-black text-[#1f6b3b]">SEED BARI</p>
              <p className="mt-2 max-w-xs text-sm text-gray-600">
                Genuine seeds and agriculture products for growers in Bangladesh and India.
              </p>
            </div>

            <div>
              <h2 className="font-bold text-gray-900">Shop</h2>
              <nav className="mt-3 flex flex-col gap-2 text-sm text-gray-600" aria-label="Shop links">
                <Link href="/shop" className="hover:text-[#1f6b3b]">All Products</Link>
                <Link href="/" className="hover:text-[#1f6b3b]">Home</Link>
              </nav>
            </div>

            <div>
              <h2 className="font-bold text-gray-900">Learn</h2>
              <nav className="mt-3 flex flex-col gap-2 text-sm text-gray-600" aria-label="Learning links">
                <Link href="/blog" className="hover:text-[#1f6b3b]">Blog</Link>
                <Link href="/guides" className="hover:text-[#1f6b3b]">Guides</Link>
                <Link href="/videos" className="hover:text-[#1f6b3b]">Videos</Link>
              </nav>
            </div>

            <div>
              <h2 className="font-bold text-gray-900">Information</h2>
              <nav className="mt-3 flex flex-col gap-2 text-sm text-gray-600" aria-label="Information links">
                <Link href="/pages" className="hover:text-[#1f6b3b]">Policies & Information</Link>
              </nav>
            </div>
          </div>

          <div className="border-t px-4 py-4 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} SEED BARI. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
