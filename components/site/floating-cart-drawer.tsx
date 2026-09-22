'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Minus, Plus, ShoppingCart, Trash2, Truck, X } from 'lucide-react';
import { useCart } from '@/components/site/cart-provider';
import { removeFromCart, updateCartQuantity, type CartItem } from '@/lib/cart';
import { formatPrice } from '@/lib/data';
import { getVisitorCountry } from '@/lib/supabase/client';
import { useLang } from '@/components/site/language-provider';

type CartFlyEvent = CustomEvent<{
  image?: string;
  sourceRect?: { left: number; top: number; width: number; height: number };
}>;

export default function FloatingCartDrawer() {
  const { items, total, count, refresh } = useCart();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<'BD' | 'IN'>('BD');
  const [cartBump, setCartBump] = useState(false);
  const cartButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCountry(getVisitorCountry());

    const openCart = () => setOpen(true);
    const closeCart = () => setOpen(false);

    const flyToCart = (event: Event) => {
      const detail = (event as CartFlyEvent).detail;
      const target = cartButtonRef.current;
      if (!detail?.image || !detail.sourceRect || !target) return;

      const source = detail.sourceRect;
      const targetRect = target.getBoundingClientRect();
      const sourceCenterX = source.left + source.width / 2;
      const sourceCenterY = source.top + source.height / 2;
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const targetCenterY = targetRect.top + targetRect.height / 2;

      const flyer = document.createElement('img');
      flyer.src = detail.image;
      flyer.alt = '';
      flyer.setAttribute('aria-hidden', 'true');
      flyer.style.position = 'fixed';
      flyer.style.left = `${source.left}px`;
      flyer.style.top = `${source.top}px`;
      flyer.style.width = `${source.width}px`;
      flyer.style.height = `${source.height}px`;
      flyer.style.objectFit = 'cover';
      flyer.style.borderRadius = '14px';
      flyer.style.pointerEvents = 'none';
      flyer.style.zIndex = '9999';
      flyer.style.willChange = 'transform, opacity';
      flyer.style.boxShadow = '0 18px 42px -14px rgba(5,150,105,.8)';
      document.body.appendChild(flyer);

      const trail = flyer.cloneNode(true) as HTMLImageElement;
      trail.style.opacity = '.22';
      trail.style.filter = 'blur(1px)';
      trail.style.zIndex = '9998';
      document.body.appendChild(trail);

      const dx = targetCenterX - sourceCenterX;
      const dy = targetCenterY - sourceCenterY;

      const animation = flyer.animate(
        [
          { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
          { transform: `translate3d(${dx * 0.22}px,${dy * 0.22 - 34}px,0) scale(.94) rotate(-3deg)`, opacity: 1, offset: 0.24 },
          { transform: `translate3d(${dx * 0.66}px,${dy * 0.66 - 48}px,0) scale(.64) rotate(-8deg)`, opacity: .98, offset: 0.62 },
          { transform: `translate3d(${dx * 0.9}px,${dy * 0.9 - 10}px,0) scale(.4) rotate(5deg)`, opacity: .82, offset: 0.84 },
          { transform: `translate3d(${dx}px,${dy}px,0) scale(.26) rotate(10deg)`, opacity: .08, offset: 1 },
        ],
        { duration: 950, easing: 'cubic-bezier(.16,.84,.22,1)', fill: 'forwards' },
      );

      trail.animate(
        [
          { transform: 'translate3d(0,0,0) scale(.94)', opacity: .22, offset: 0 },
          { transform: `translate3d(${dx * 0.48}px,${dy * 0.48 - 36}px,0) scale(.58)`, opacity: .12, offset: 0.55 },
          { transform: `translate3d(${dx}px,${dy}px,0) scale(.22)`, opacity: 0, offset: 1 },
        ],
        { duration: 820, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'forwards' },
      );

      window.setTimeout(() => setCartBump(true), 720);
      window.setTimeout(() => setCartBump(false), 1180);
      animation.finished.finally(() => {
        flyer.remove();
        trail.remove();
      });
    };

    window.addEventListener('gazi-cart-open', openCart);
    window.addEventListener('gazi-cart-close', closeCart);
    window.addEventListener('gazi-cart-fly', flyToCart);

    return () => {
      window.removeEventListener('gazi-cart-open', openCart);
      window.removeEventListener('gazi-cart-close', closeCart);
      window.removeEventListener('gazi-cart-fly', flyToCart);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const freeDeliveryTarget = country === 'IN' ? 999 : 600;
  const remaining = Math.max(0, freeDeliveryTarget - total);
  const progress = Math.min(100, Math.round((total / freeDeliveryTarget) * 100));

  const deliveryMessage = useMemo(() => {
    if (remaining <= 0) return t('ফ্রি ডেলিভারি আনলক হয়েছে', 'Free delivery unlocked');
    return t(`আর ${formatPrice(remaining)} যোগ করলে ফ্রি ডেলিভারি পাবেন`, `Add ${formatPrice(remaining)} more for free delivery`);
  }, [remaining, t]);

  const changeQuantity = (item: CartItem, nextQuantity: number) => {
    updateCartQuantity(item.product_id, nextQuantity, item.variant_id, item.bundle_id);
    refresh();
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-[5.5rem] right-3 z-[91] w-[calc(100vw-1.5rem)] max-w-[350px] origin-bottom-right animate-[gaziCartIn_.2s_ease-out] sm:bottom-[5.75rem] sm:right-5">
          <div className="overflow-hidden rounded-[1.35rem] border border-emerald-200/80 bg-white/95 shadow-[0_24px_70px_-28px_rgba(5,46,22,.55)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-lime-50/60 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><ShoppingCart className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="text-sm font-black text-slate-950">{t('আপনার কার্ট', 'Your Cart')}</p><p className="text-[10px] font-bold text-slate-500">{count} {t('টি আইটেম', 'items')}</p></div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('কার্ট বন্ধ করুন', 'Close cart')} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[290px] overflow-y-auto p-3">
              {items.length === 0 ? (
                <div className="px-4 py-7 text-center"><ShoppingCart className="mx-auto h-8 w-8 text-emerald-300" /><p className="mt-2 text-sm font-black text-slate-800">{t('কার্ট খালি', 'Your cart is empty')}</p><Link href="/all-products" onClick={() => setOpen(false)} className="mt-3 inline-flex rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-black text-white">{t('শপিং শুরু করুন', 'Start Shopping')}</Link></div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <article key={`${item.product_id}:${item.variant_id || ''}:${item.bundle_id || ''}`} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2">
                      <Link href={`/product/${item.slug}`} onClick={() => setOpen(false)} className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-emerald-50">{item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center">🌱</div>}</Link>
                      <div className="min-w-0 flex-1"><Link href={`/product/${item.slug}`} onClick={() => setOpen(false)} className="line-clamp-1 text-[11px] font-black text-slate-900">{item.name}</Link><div className="mt-1 flex items-center justify-between gap-2"><span className="text-xs font-black text-emerald-800">{formatPrice(item.unit_price * item.quantity)}</span><div className="flex items-center rounded-lg border border-slate-200 bg-white"><button type="button" onClick={() => changeQuantity(item, item.quantity - 1)} className="p-1 text-slate-500 hover:text-emerald-700" aria-label={t('একটি কমান', 'Decrease quantity')}><Minus className="h-3 w-3" /></button><span className="w-5 text-center text-[10px] font-black">{item.quantity}</span><button type="button" onClick={() => changeQuantity(item, item.quantity + 1)} className="p-1 text-slate-500 hover:text-emerald-700" aria-label={t('একটি বাড়ান', 'Increase quantity')}><Plus className="h-3 w-3" /></button></div></div></div>
                      <button type="button" onClick={() => { removeFromCart(item.product_id, item.variant_id, item.bundle_id); refresh(); }} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500" aria-label={t('পণ্য মুছুন', 'Remove product')}><Trash2 className="h-3.5 w-3.5" /></button>
                    </article>
                  ))}
                </div>
              )}
            </div>
            {items.length > 0 && (
              <div className="border-t border-emerald-100 bg-white px-3.5 pb-3.5 pt-3">
                <div className="mb-2 flex items-center gap-2"><Truck className="h-3.5 w-3.5 shrink-0 text-emerald-600" /><p className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-500">{deliveryMessage}</p>{remaining <= 0 && <Check className="h-3.5 w-3.5 text-emerald-600" />}</div>
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-emerald-50"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{t('মোট', 'Total')}</p><p className="text-lg font-black tracking-tight text-slate-950">{formatPrice(total)}</p></div><div className="flex items-center gap-1.5"><Link href="/cart" onClick={() => setOpen(false)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-800">{t('কার্ট', 'Cart')}</Link><Link href="/checkout" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-black text-white shadow-sm">{t('চেকআউট', 'Checkout')}<ChevronRight className="h-3 w-3" /></Link></div></div>
              </div>
            )}
          </div>
        </div>
      )}

      <button ref={cartButtonRef} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={t('কার্ট দেখুন', 'View cart')} className={`fixed right-3 z-[90] inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-300/70 bg-emerald-600 px-3.5 py-2 text-white shadow-[0_12px_34px_-12px_rgba(5,150,105,.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[.97] bottom-[5.5rem] sm:bottom-5 sm:right-5 sm:px-4 ${cartBump ? 'animate-[gaziCartBump_.5s_ease-out]' : ''}`}><span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/15"><ShoppingCart className="h-3.5 w-3.5" />{count > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[8px] font-black text-emerald-700">{count}</span>}</span><span className="text-[11px] font-black">{t('কার্ট দেখুন', 'View cart')}</span>{count > 0 && <span className="border-l border-white/20 pl-2 text-[10px] font-extrabold text-emerald-50">{formatPrice(total)}</span>}</button>

      <style jsx global>{`
        @keyframes gaziCartIn { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes gaziCartBump { 0%,100% { transform: scale(1); } 35% { transform: scale(1.12); } 60% { transform: scale(.96); } 82% { transform: scale(1.05); } }
      `}</style>
    </>
  );
}
