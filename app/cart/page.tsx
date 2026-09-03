'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function CartPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) { const { data } = await supabase.from('cart_items').select('id,quantity,product_id,variant_id,products(name_en,name_bn,regular_price,sale_price),product_variants(name,price,sale_price)').order('created_at'); setItems(data ?? []); } setLoading(false); })(); }, []);
  return <main className="min-h-screen bg-[#f7f8f4] px-4 py-10"><div className="mx-auto max-w-5xl"><h1 className="text-4xl font-black">Your Cart</h1><p className="mt-2 text-gray-500">Review your seeds before checkout.</p>{loading ? <p className="mt-10">Loading cart…</p> : items.length === 0 ? <div className="mt-10 rounded-2xl border bg-white p-10 text-center"><div className="text-5xl">🛒</div><h2 className="mt-4 text-xl font-bold">Your cart is empty</h2><Link href="/shop" className="mt-5 inline-block rounded-xl bg-[#1f6b3b] px-6 py-3 font-bold text-white">Continue Shopping</Link></div> : <div className="mt-8 space-y-4">{items.map(i => <div key={i.id} className="flex items-center justify-between rounded-2xl border bg-white p-5"><div><h2 className="font-bold">{i.products?.name_en || i.products?.name_bn}</h2><p className="text-sm text-gray-500">Qty: {i.quantity}</p></div><strong>৳{Number(i.product_variants?.sale_price ?? i.product_variants?.price ?? i.products?.sale_price ?? i.products?.regular_price ?? 0) * i.quantity}</strong></div>)}<Link href="/checkout" className="block rounded-xl bg-[#1f6b3b] px-6 py-4 text-center font-bold text-white">Proceed to Checkout</Link></div>}</div></main>;
}
