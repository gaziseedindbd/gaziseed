import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GAZI SEED — Premium Seeds & Agriculture',
  description: 'Premium seeds and agriculture products for India and Bangladesh.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
