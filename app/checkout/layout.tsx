import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout — SEED BARI',
  description: 'Complete your SEED BARI seed order.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
