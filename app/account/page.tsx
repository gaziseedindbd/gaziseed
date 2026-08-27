'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@/lib/data';
import type { Order, CustomerAddress } from '@/lib/supabase/types';
import { 
  Package, MapPin, User, LogOut, LayoutDashboard, Plus, Edit, 
  Trash2, Star, X, Check, Heart, RotateCcw, AlertCircle, Users, 
  Eye, Truck, Calendar, ShoppingBag, Receipt, Printer, MessageCircle, 
  Award, CheckCircle2, Clock, Box, HelpCircle
} from 'lucide-react';
import { AddressSelector, formatAddressToString, type AddressValue } from '@/components/site/address-selector';
import { toast } from '@/components/site/toast-provider';
import { getWishlist, toggleWishlist, getEffectivePrice } from '@/lib/data';
import { addToCart } from '@/lib/cart';
import type { Product } from '@/lib/supabase/types';
import ReferralSection from '@/components/site/referral-section';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dashboard' | 'orders' | 'addresses' | 'wishlist' | 'profile' | 'referral'>('dashboard');
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [editingAddr, setEditingAddr] = useState<CustomerAddress | null>(null);
  const [referralEnabled, setReferralEnabled] = useState(false);

  // অর্ডার ডিটেইলস মডালের স্টেট
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadAddresses = useCallback(async (uid: string) => {
    const { data } = await supabase.from('customer_addresses').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    setAddresses((data || []) as CustomerAddress[]);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      setUser(data.session.user);
      const [o, a] = await Promise.all([
        supabase.from('orders').select('*').eq('user_id', data.session.user.id).order('created_at', { ascending: false }),
        supabase.from('customer_addresses').select('*').eq('user_id', data.session.user.id).order('created_at', { ascending: false }),
      ]);
      setOrders((o.data || []) as Order[]);
      setAddresses((a.data || []) as CustomerAddress[]);
      getWishlist(data.session.user.id).then(setWishlist);
      supabase.from('referral_settings').select('enabled').eq('id', 1).maybeSingle().then(({ data: rs }) => {
        setReferralEnabled(rs?.enabled === true);
      });
      setLoading(false);
    });
  }, [router]);

  // অর্ডারে ক্লিক করলে বিস্তারিত ডাটা লোড করার ফাংশন
  const handleViewOrderDetails = async (order: any) => {
    setSelectedOrder(order);
    setLoadingDetails(true);
    const { data, error } = await supabase
      .from('order_items')
      .select('*, products(*)')
      .eq('order_id', order.id);

    if (error) {
      console.error('Error fetching order items:', error);
      toast('অর্ডারের বিস্তারিত লোড করা সম্ভব হয়নি', 'error');
    } else {
      setOrderItems(data || []);
    }
    setLoadingDetails(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };

  const handleSaveAddress = async (addrData: any) => {
    const isEditing = !!editingAddr;
    const payload = { ...addrData, user_id: user.id };
    if (isEditing) {
      const { error } = await supabase.from('customer_addresses').update(payload).eq('id', editingAddr!.id);
      if (error) { toast('আপডেট ব্যর্থ', 'error'); return; }
      toast('ঠিকানা আপডেট হয়েছে');
    } else {
      if (payload.is_default) {
        await supabase.from('customer_addresses').update({ is_default: false }).eq('user_id', user.id);
      }
      const { error } = await supabase.from('customer_addresses').insert(payload);
      if (error) { toast('যোগ করা ব্যর্থ', 'error'); return; }
      toast('ঠিকানা যোগ হয়েছে');
    }
    setShowAddrForm(false);
    setEditingAddr(null);
    loadAddresses(user.id);
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('ঠিকানা মুছতে চান?')) return;
    await supabase.from('customer_addresses').delete().eq('id', id);
    toast('ঠিকানা মুছে ফেলা হয়েছে');
    loadAddresses(user.id);
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from('customer_addresses').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id);
    loadAddresses(user.id);
  };

  const handleReorder = async (order: any) => {
    const { data: items } = await supabase.from('order_items').select('*, products(*)').eq('order_id', order.id);
    if (!items || items.length === 0) { toast('অর্ডার আইটেম পাওয়া যায়নি', 'error'); return; }
    const cart = JSON.parse(localStorage.getItem('gazi_cart') || '[]');
    let added = 0; let skipped = 0;
    for (const item of items) {
      if (item.is_free_gift) continue;
      const p = item.products;
      if (!p || !p.is_active || p.stock <= 0) { skipped++; continue; }
      const currentPrice = getEffectivePrice(p);
      cart.push({ product_id: p.id, name: p.name_bn, slug: p.slug, image: p.image, unit_price: currentPrice, regular_price: p.regular_price, quantity: item.quantity, variant_id: item.variant_id, variant_name: item.variant_name });
      added++;
    }
    localStorage.setItem('gazi_cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
    if (added > 0) toast(`${added} টি পণ্য কার্টে যোগ করা হয়েছে${skipped > 0 ? `, ${skipped} টি স্টকে নেই` : ''}`);
    else toast('কোন পণ্য স্টকে নেই', 'error');
  };

  const handleMoveToCart = async (product: Product) => {
    const cart = JSON.parse(localStorage.getItem('gazi_cart') || '[]');
    cart.push({ product_id: product.id, name: product.name_bn, slug: product.slug, image: product.image, unit_price: getEffectivePrice(product), regular_price: product.regular_price, quantity: 1 });
    localStorage.setItem('gazi_cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
    await toggleWishlist(user.id, product.id);
    setWishlist(await getWishlist(user.id));
    toast('কার্টে যোগ করা হয়েছে');
  };

  const handleRemoveWishlist = async (productId: string) => {
    await toggleWishlist(user.id, productId);
    setWishlist(await getWishlist(user.id));
    toast('উইশলিস্ট থেকে সরানো হয়েছে');
  };

  // লাইটওয়েট ক্যাশ মেমো / ইনভয়েস প্রিন্ট ফাংশন
  const handlePrintInvoice = () => {
    window.print();
  };

  if (loading) return <div className="container-custom py-12"><div className="h-64 animate-pulse rounded-2xl bg-secondary" /></div>;

  const totalSpend = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o: any) => sum + Number(o.final_amount ?? o.grand_total ?? o.total_amount ?? 0), 0);

  // লয়ালটি পয়েন্ট হিসাব (প্রতি ১০০ টাকায় ১ পয়েন্ট)
  const loyaltyPoints = Math.floor(totalSpend / 100);

  // সর্বশেষ রানিং অর্ডার ট্র্যাকিং ফিল্টার
  const latestActiveOrder = orders.find((o: any) => o.status !== 'delivered' && o.status !== 'cancelled') || orders[0];

  const getStatusStep = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 1;
      case 'confirmed': case 'processing': return 2;
      case 'shipped': case 'out_for_delivery': return 3;
      case 'delivered': return 4;
      default: return 1;
    }
  };

  const activeStep = latestActiveOrder ? getStatusStep(latestActiveOrder.status) : 0;

  return (
    <div className="container-custom py-6 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl text-foreground">আমার অ্যাকাউন্ট</h1>
          <p className="text-xs text-muted-foreground mt-0.5">অর্ডার স্ট্যাটাস, ঠিকানা ও প্রোফাইল পরিচালনা করুন</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-secondary transition cursor-pointer">
          <LogOut className="h-4 w-4" /> লগআউট
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* বামপাশের মেনু */}
        <aside className="lg:col-span-1">
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-3 p-2 bg-secondary/30 rounded-2xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-foreground truncate">{user?.user_metadata?.name || user?.email?.split('@')[0]}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>

            <nav className="space-y-1">
              {[
                { key: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
                { key: 'orders', label: 'আমার অর্ডার', icon: Package },
                { key: 'addresses', label: 'সংরক্ষিত ঠিকানা', icon: MapPin },
                { key: 'wishlist', label: 'উইশলিস্ট', icon: Heart },
                { key: 'profile', label: 'প্রোফাইল', icon: User },
                ...(referralEnabled ? [{ key: 'referral', label: 'রেফারেল', icon: Users }] : []),
              ].map((item) => (
                <button 
                  key={item.key} 
                  onClick={() => setTab(item.key as any)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    tab === item.key ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" /> {item.label}
                </button>
              ))}
            </nav>

            {/* হেল্পডেস্ক / সাপোর্ট বক্স */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs space-y-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-primary" /> কোনো সহায়তা লাগবে?
              </p>
              <p className="text-[11px] text-muted-foreground">অর্ডার বা পণ্য সম্পর্কিত যেকোনো তথ্যের জন্য সরাসরি যোগাযোগ করুন।</p>
              <a 
                href="https://wa.me/8801818838394" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-white font-bold text-xs hover:bg-emerald-700 transition"
              >
                <MessageCircle className="h-3.5 w-3.5" /> হোয়াটসঅ্যাপ সাপোর্ট
              </a>
            </div>
          </div>
        </aside>

        {/* ডানপাশের মূল কনটেন্ট */}
        <div className="lg:col-span-3">
          {tab === 'dashboard' && (
            <div className="space-y-5">
              
              {/* স্ট্যাটাস ও লয়ালটি কার্ড গ্রিড */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-muted-foreground">মোট অর্ডার</p>
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-foreground">{orders.length} টি</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-muted-foreground">মোট খরচ</p>
                    <ShoppingBag className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-foreground">{formatPrice(totalSpend)}</p>
                </div>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-amber-700">রিওয়ার্ড পয়েন্ট</p>
                    <Award className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-amber-600">{loyaltyPoints} <span className="text-xs font-normal">পয়েন্ট</span></p>
                </div>
              </div>

              {/* লাইভ অর্ডার ট্র্যাকার বার (যদি অর্ডার থাকে) */}
              {latestActiveOrder && (
                <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider">রানিং অর্ডার ট্র্যাকিং</span>
                      <h3 className="text-base font-black text-foreground">অর্ডার #{latestActiveOrder.order_number}</h3>
                    </div>
                    <button 
                      onClick={() => handleViewOrderDetails(latestActiveOrder)}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      বিস্তারিত দেখুন →
                    </button>
                  </div>

                  {/* ৪-স্টেপ প্রগ্রেস বার */}
                  <div className="grid grid-cols-4 gap-2 pt-2 text-center">
                    <div className="space-y-1">
                      <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${activeStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        <Clock className="h-4 w-4" />
                      </div>
                      <p className="text-[11px] font-bold">অর্ডার প্লেসড</p>
                    </div>
                    <div className="space-y-1">
                      <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${activeStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        <Box className="h-4 w-4" />
                      </div>
                      <p className="text-[11px] font-bold">প্যাকিং</p>
                    </div>
                    <div className="space-y-1">
                      <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${activeStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        <Truck className="h-4 w-4" />
                      </div>
                      <p className="text-[11px] font-bold">ডেলিভারিতে</p>
                    </div>
                    <div className="space-y-1">
                      <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${activeStep >= 4 ? 'bg-emerald-600 text-white' : 'bg-secondary text-muted-foreground'}`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <p className="text-[11px] font-bold">সম্পন্ন</p>
                    </div>
                  </div>
                </div>
              )}

              {/* সাম্প্রতিক অর্ডার তালিকা */}
              <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
                <h2 className="mb-3.5 font-black text-foreground text-sm sm:text-base">সাম্প্রতিক অর্ডার</h2>
                {orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">এখনো কোনো অর্ডার করা হয়নি।</p>
                ) : (
                  <div className="space-y-2.5">
                    {orders.slice(0, 5).map((o: any) => (
                      <div 
                        key={o.id} 
                        onClick={() => handleViewOrderDetails(o)}
                        className="flex cursor-pointer items-center justify-between rounded-2xl bg-secondary/30 p-3.5 text-xs sm:text-sm transition hover:bg-secondary/60 border border-transparent hover:border-primary/20"
                      >
                        <div>
                          <p className="font-extrabold text-primary">{o.order_number}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(o.created_at).toLocaleDateString('bn-BD')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-foreground">{formatPrice(o.final_amount ?? o.grand_total ?? o.total_amount ?? 0)}</p>
                          <span className="inline-block text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-0.5">
                            {o.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* অর্ডার ট্যাব */}
          {tab === 'orders' && (
            <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
              <h2 className="font-black text-base sm:text-lg">আমার সব অর্ডার ({orders.length})</h2>
              {orders.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">কোনো অর্ডার হিস্ট্রি নেই</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((o: any) => (
                    <div key={o.id} className="rounded-2xl border border-border p-4 transition hover:border-primary/40 bg-card">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="cursor-pointer" onClick={() => handleViewOrderDetails(o)}>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-primary text-sm">{o.order_number}</p>
                            <span className="text-[11px] bg-secondary text-foreground font-semibold px-2 py-0.5 rounded-md">
                              {new Date(o.created_at).toLocaleDateString('bn-BD')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            ঠিকানা: {o.delivery_address}
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-border sm:border-t-0 pt-2.5 sm:pt-0">
                          <div className="text-left sm:text-right">
                            <p className="font-black text-sm text-foreground">{formatPrice(o.final_amount ?? o.grand_total ?? o.total_amount ?? 0)}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-block uppercase ${
                              o.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600' : 
                              o.status === 'cancelled' ? 'bg-destructive/10 text-destructive' : 
                              'bg-amber-500/10 text-amber-600'
                            }`}>
                              {o.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => handleViewOrderDetails(o)} 
                              className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary transition cursor-pointer"
                              title="ইনভয়েস ও বিবরণ"
                            >
                              <Eye className="h-3.5 w-3.5" /> বিবরণ
                            </button>
                            <button 
                              onClick={() => handleReorder(o)} 
                              className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
                              title="পুনরায় অর্ডার করুন"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> রি-অর্ডার
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* সংরক্ষিত ঠিকানা ট্যাব */}
          {tab === 'addresses' && (
            <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-base sm:text-lg">সংরক্ষিত ঠিকানা</h2>
                <button onClick={() => { setEditingAddr(null); setShowAddrForm(true); }} className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition cursor-pointer">
                  <Plus className="h-4 w-4" /> নতুন ঠিকানা
                </button>
              </div>

              {addresses.length === 0 && !showAddrForm ? (
                <p className="text-xs text-muted-foreground py-6 text-center">কোনো ঠিকানা সংরক্ষিত নেই। নতুন ঠিকানা যোগ করুন।</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addresses.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-border p-4 bg-card space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-extrabold text-sm text-foreground">{a.name}</p>
                            {a.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">ডিফল্ট</span>}
                          </div>
                          <p className="text-xs font-semibold text-muted-foreground mt-0.5">{a.phone}</p>
                        </div>
                        <div className="flex gap-1">
                          {!a.is_default && <button onClick={() => handleSetDefault(a.id)} className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground hover:text-primary" title="ডিফল্ট করুন"><Star className="h-4 w-4" /></button>}
                          <button onClick={() => { setEditingAddr(a); setShowAddrForm(true); }} className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground" title="এডিট"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteAddress(a.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" title="মুছুন"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground border-t border-border pt-2">{a.address}</p>
                    </div>
                  ))}
                </div>
              )}

              {showAddrForm && (
                <AddressForm address={editingAddr} onSave={handleSaveAddress} onClose={() => { setShowAddrForm(false); setEditingAddr(null); }} />
              )}
            </div>
          )}

          {/* উইশলিস্ট ট্যাব */}
          {tab === 'wishlist' && (
            <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
              <h2 className="flex items-center gap-2 font-black text-base sm:text-lg"><Heart className="h-5 w-5 text-primary" /> আমার উইশলিস্ট</h2>
              {wishlist.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">উইশলিস্টে কোনো পণ্য নেই</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {wishlist.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border p-3 bg-card">
                      {p.image && <img src={p.image} alt={p.name_bn} className="h-16 w-16 rounded-xl object-cover border border-border shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs sm:text-sm truncate text-foreground">{p.name_bn}</p>
                        <p className="text-xs font-black text-primary mt-0.5">{formatPrice(getEffectivePrice(p))}</p>
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleMoveToCart(p)} className="rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 transition">কার্টে নিন</button>
                          <button onClick={() => handleRemoveWishlist(p.id)} className="rounded-xl p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* প্রোফাইল ট্যাব */}
          {tab === 'profile' && (
            <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
              <h2 className="font-black text-base sm:text-lg">আমার প্রোফাইল</h2>
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="p-3 rounded-xl bg-secondary/30"><label className="text-muted-foreground block text-xs">নাম</label><p className="font-bold text-foreground mt-0.5">{user?.user_metadata?.name || '-'}</p></div>
                <div className="p-3 rounded-xl bg-secondary/30"><label className="text-muted-foreground block text-xs">ইমেইল</label><p className="font-bold text-foreground mt-0.5">{user?.email}</p></div>
                <div className="p-3 rounded-xl bg-secondary/30"><label className="text-muted-foreground block text-xs">মোবাইল</label><p className="font-bold text-foreground mt-0.5">{user?.user_metadata?.phone || '-'}</p></div>
              </div>
            </div>
          )}

          {tab === 'referral' && referralEnabled && user && (
            <ReferralSection userId={user.id} />
          )}
        </div>
      </div>

      {/* ============================================================
          অর্ডার ডিটেইলস ও ক্যাশ মেমো / ইনভয়েস মডাল
          ============================================================ */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card p-5 sm:p-6 shadow-2xl border border-border text-foreground">
            
            {/* ইনভয়েস হেডার */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded">অফিসিয়াল ইনভয়েস স্লিপ</span>
                <h3 className="text-lg font-black text-foreground mt-1">
                  অর্ডার #{selectedOrder.order_number}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  তারিখ: {new Date(selectedOrder.created_at).toLocaleString('bn-BD')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handlePrintInvoice} 
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary transition cursor-pointer"
                  title="মেমো প্রিন্ট করুন"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" /> প্রিন্ট
                </button>
                <button 
                  onClick={() => setSelectedOrder(null)} 
                  className="rounded-full p-2 hover:bg-secondary transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* ইনভয়েস বডি */}
            <div className="py-4 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-3.5 rounded-2xl">
                <div>
                  <span className="text-muted-foreground block text-[11px]">ডেলিভারি স্ট্যাটাস</span>
                  <span className="font-black text-primary capitalize">{selectedOrder.status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">পেমেন্ট মেথড</span>
                  <span className="font-black uppercase">{selectedOrder.payment_method || 'COD'} ({selectedOrder.payment_status || 'unpaid'})</span>
                </div>
                <div className="col-span-2 border-t border-border/50 pt-2">
                  <span className="text-muted-foreground block text-[11px]">ডেলিভারি প্রাপকের তথ্য</span>
                  <p className="font-bold text-foreground">{selectedOrder.customer_name} ({selectedOrder.customer_phone})</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{selectedOrder.delivery_address}</p>
                </div>
              </div>

              {/* আইটেমস */}
              <div>
                <h4 className="font-black text-xs text-foreground mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-primary" /> অর্ডার করা পণ্যসমূহ:
                </h4>

                {loadingDetails ? (
                  <div className="space-y-2 py-2">
                    <div className="h-10 bg-secondary rounded-xl animate-pulse" />
                    <div className="h-10 bg-secondary rounded-xl animate-pulse" />
                  </div>
                ) : orderItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">কোন পণ্যের বিবরণ পাওয়া যায়নি।</p>
                ) : (
                  <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 gap-3 bg-card">
                        <div className="flex items-center gap-2.5">
                          {item.products?.image ? (
                            <img 
                              src={item.products.image} 
                              alt={item.product_name || item.products?.name_bn} 
                              className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" 
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-xs sm:text-sm text-foreground line-clamp-1">
                              {item.product_name || item.products?.name_bn || 'পণ্য'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatPrice(item.unit_price)} × {item.quantity}
                            </p>
                          </div>
                        </div>
                        <p className="font-black text-xs sm:text-sm text-primary shrink-0">
                          {formatPrice(item.total_price || (item.unit_price * item.quantity))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* সামারি */}
              <div className="bg-secondary/40 p-4 rounded-2xl space-y-1.5 border border-border">
                <div className="flex justify-between text-muted-foreground">
                  <span>সাবটোটাল</span>
                  <span>{formatPrice(selectedOrder.total_amount ?? selectedOrder.grand_total ?? 0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>ডেলিভারি চার্জ</span>
                  <span>{formatPrice(selectedOrder.delivery_charge ?? 0)}</span>
                </div>
                {Number(selectedOrder.discount_amount) > 0 && (
                  <div className="flex justify-between text-primary font-bold">
                    <span>ডিসকাউন্ট</span>
                    <span>- {formatPrice(selectedOrder.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm sm:text-base text-foreground border-t border-border pt-2 mt-2">
                  <span>সর্বমোট বিল</span>
                  <span className="text-primary text-base sm:text-lg">{formatPrice(selectedOrder.final_amount ?? selectedOrder.grand_total ?? selectedOrder.total_amount ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* ফুটার */}
            <div className="border-t border-border pt-3 flex justify-end gap-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2 text-xs font-bold hover:bg-primary/90 transition cursor-pointer"
              >
                ঠিক আছে
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddressForm({ address, onSave, onClose }: { address: CustomerAddress | null; onSave: (data: any) => void; onClose: () => void }) {
  const [label, setLabel] = useState(address?.label || 'Home');
  const [name, setName] = useState(address?.name || '');
  const [phone, setPhone] = useState(address?.phone || '');
  const [isDefault, setIsDefault] = useState(address?.is_default || false);
  const [addrValue, setAddrValue] = useState<AddressValue>({
    division: '', district: '', thana: '', detail: '', postalCode: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !addrValue.division || !addrValue.district || !addrValue.thana || !addrValue.detail) {
      toast('সব প্রয়োজনীয় তথ্য পূরণ করুন', 'error'); return;
    }
    onSave({
      label, name, phone,
      address: formatAddressToString(addrValue),
      division: addrValue.division,
      district: addrValue.district,
      thana: addrValue.thana,
      postal_code: addrValue.postalCode || '',
      is_default: isDefault,
    });
  };

  return (
    <div className="mt-4 rounded-2xl border-2 border-primary/20 bg-secondary/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-sm">{address ? 'ঠিকানা এডিট করুন' : 'নতুন ঠিকানা যোগ করুন'}</h3>
        <button onClick={onClose}><X className="h-5 w-5" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div><label className="mb-1 block text-xs font-bold text-muted-foreground">লেবেল</label>
            <select value={label} onChange={(e) => setLabel(e.target.value)} className="input-bangla">
              <option value="Home">Home</option><option value="Office">Office</option><option value="Other">Other</option>
            </select>
          </div>
          <div><label className="mb-1 block text-xs font-bold text-muted-foreground">নাম *</label><input value={name} onChange={(e) => setName(e.target.value)} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-xs font-bold text-muted-foreground">ফোন *</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-bangla" required /></div>
        </div>
        <AddressSelector value={addrValue} onChange={setAddrValue} />
        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="accent-primary" /> ডিফল্ট ঠিকানা হিসেবে সেট করুন</label>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition cursor-pointer">সেভ করুন</button>
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-6 py-3 text-xs font-bold hover:bg-secondary transition cursor-pointer">বাতিল</button>
        </div>
      </form>
    </div>
  );
}
