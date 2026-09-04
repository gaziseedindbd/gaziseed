import type { Metadata } from 'next';
import './globals.css';

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
