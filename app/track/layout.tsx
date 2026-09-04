import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Order | SEED BARI',
  robots: {
    index: false,
    follow: false,
  },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
