import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const routes = {
  home: '/',
  listing: '/all-products',
  product: '/product/f1-hybrid-sweet-pumpkin-seeds-london-2',
  soldout: '/product/red-zinnia-flower-seeds-in',
  cart: '/cart',
  checkout: '/checkout',
};

export default async function AuditPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  const { view = 'home' } = await searchParams;
  const route = routes[view as keyof typeof routes] || routes.home;
  return <div className="fixed inset-0 z-[9999] overflow-auto bg-slate-100 p-3 text-slate-900">
    <nav className="mb-3 flex gap-4">{Object.keys(routes).map((key) => <a key={key} href={`?view=${key}`} className="font-bold underline">{key}</a>)}</nav>
    <div className="flex items-start gap-3">{[360, 390, 430].map((width) => <section key={width} className="shrink-0">
      <h1 className="mb-2 font-bold">{view} · {width}px</h1>
      <iframe id={`mobile-${width}`} title={`${view} ${width}px`} src={route} width={width} height={780} className="border border-slate-300 bg-white" />
    </section>)}</div>
  </div>;
}
