import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#047857',
};

export default function AllProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
