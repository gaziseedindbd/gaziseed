'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { ShoppingCart, Clock, Phone, MapPin, User, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function ComboLandingPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [combo, setCombo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedQty, setSelectedQty] = useState(1);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3 * 3600);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCombo = async () => {
      const { data: comboData } = await supabase
        .from('combo_packs')
        .select('*')
        .eq('slug', slug)
        .single();

      if (comboData) {
        const { data: itemsData } = await supabase
          .from('combo_items')
          .select('quantity, unit_type, products(*)')
          .eq('combo_id', comboData.id);

        setCombo({ ...comboData, combo_items: itemsData || [] });
        if (Array.isArray(comboData.tier_pricing) && comboData.tier_pricing.length > 0) {
          const firstQty = Number(comboData.tier_pricing[0]?.qty ?? comboData.tier_pricing[0]?.quantity ?? 1);
          setSelectedQty(firstQty || 1);
        }
      }
      setLoading(false);
    };

    if (slug) fetchCombo();
  }, [slug]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return {
      hours: String(h).padStart(2, '0'),
      minutes: String(m).padStart(2, '0'),
      seconds: String(s).padStart(2, '0'),
    };
  };

  const getTierQty = (tier: any) => Number(tier?.qty ?? tier?.quantity ?? 1);
  const getTierFreeDelivery = (tier: any) => tier?.freeDelivery === true || tier?.free_delivery === true;

  const currentTier = combo?.tier_pricing?.find((t: any) => getTierQty(t) === Number(selectedQty)) ||
                    combo?.tier_pricing?.[0] || { regular: combo?.regular_total || 500, offer: combo?.combo_price || 300, free_delivery: true };

  const currentComboPrice = Number(currentTier.offer) || Number(combo?.combo_price) || 300;
  const regularPrice = Number(currentTier.regular) || Number(combo?.regular_total) || 500;
  const freeDelivery = getTierFreeDelivery(currentTier) || currentComboPrice >= 600;
  const deliveryCharge = freeDelivery ? 0 : (currentComboPrice >= 400 ? 50 : currentComboPrice >= 200 ? 70 : 120);
  const finalTotal = currentComboPrice + deliveryCharge;

  const parseManualList = (data: any) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.map((it: any) => ({
            name: it.name || it.title || it.seed_name || Object.values(it)[0] || '',
            qty: it.qty || it.quantity || Object.values(it)[1] || ''
          })).filter((it: any) => it.name);
        }
      } catch (e) {
        return data.split('\n').filter(line => line.trim()).map(line => {
          const parts = line.split(/[-–:]/);
          return {
            name: parts[0]?.trim() || line,
            qty: parts[1]?.trim() || ''
          };
        });
      }
    }
    return [];
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address || !phone) {
      toast('দয়া করে নাম, ঠিকানা ও ফোন নাম্বার দিন', 'error');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!/^01[0-9]{9}$/.test(cleanPhone)) {
      toast('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { data: orderData, error: orderError } = await supabase.rpc('create_combo_order', {
        p_combo_id: combo.id,
        p_quantity: selectedQty,
        p_customer_name: name.trim(),
        p_customer_phone: cleanPhone,
        p_delivery_address: address.trim(),
        p_special_instructions: null,
      });

      if (orderError) throw orderError;
      if (orderData?.error) throw new Error(orderData.error);

      toast('আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!');
      router.push(`/order-success?number=${orderData.order_number}`);
    } catch (err: any) {
      toast('অর্ডার করতে সমস্যা হয়েছে: ' + (err.message || ''), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 text-center font-bold text-lg text-white">লোড হচ্ছে...</div>;
  if (!combo) return <div className="py-20 text-center font-bold text-red-500">কম্বো প্যাকটি পাওয়া যায়নি!</div>;

  const timer = formatTime(timeLeft);
  const parsedItems = parseManualList(combo.manual_items_list);
  const savings = regularPrice - currentComboPrice;

  return (
    <div className="min-h-screen bg-[#0f2a1d] text-white pb-16">
      <div className="bg-[#1b4332] py-4 text-center border-b border-emerald-800 shadow-md">
        <h1 className="text-2xl md:text-3xl font-extrabold text-amber-400 px-4">{combo.title_bn}</h1>
        <p className="text-sm text-emerald-200 mt-1">সারা দেশে ক্যাশ অন হোম ডেলিভারি</p>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-6">
        {combo.images?.[0] && (
          <div className="rounded-2xl overflow-hidden border-2 border-emerald-700 shadow-lg bg-emerald-950">
            <img src={combo.images[0]} alt={combo.title_bn} className="w-full h-auto object-cover max-h-[400px]" />
          </div>
        )}

        {combo.description_bn && (
          <div className="bg-[#1b4332] p-5 rounded-2xl border border-emerald-800 shadow-md leading-relaxed text-emerald-100 text-sm md:text-base">
            <p>{combo.description_bn}</p>
          </div>
        )}

        <div className="bg-gradient-to-b from-amber-500 to-amber-600 rounded-2xl p-6 text-center text-slate-900 shadow-xl border-4 border-amber-300">
          <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{currentTier.badge || 'BEST OFFER'}</span>
          <div className="text-3xl md:text-4xl font-black mt-2">মাত্র ৳{currentComboPrice} টাকা</div>
          {savings > 0 && <p className="text-sm font-semibold mt-1 text-slate-800">নিয়মিত মূল্য: <span className="line-through">৳{regularPrice}</span> (সাশ্রয় ৳{savings})</p>}
          <p className="mt-2 text-xs font-bold text-slate-800">{getTierFreeDelivery(currentTier) ? '🚚 Free Delivery' : '🚚 ডেলিভারি চার্জ প্রযোজ্য'}</p>
          <a href="#order-form" className="mt-4 inline-flex items-center justify-center w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all text-lg gap-2">
            <ShoppingCart className="h-5 w-5" /> অর্ডার করতে ক্লিক করুন
          </a>
        </div>

        <div className="bg-[#1b4332] rounded-2xl p-5 border border-emerald-800 shadow-md">
          <h3 className="text-lg font-bold text-amber-400 mb-3 border-b border-emerald-700 pb-2">📦 এই প্যাকে যা যা থাকছে:</h3>
          {combo.combo_items && combo.combo_items.length > 0 ? (
            <div className="space-y-2">
              {combo.combo_items.map((item: any, idx: number) => {
                const unitType = item.unit_type === 'packet' ? 'প্যাকেট' : 'পিস';
                const itemQuantity = Number(item.quantity) || 1;
                const totalQuantity = itemQuantity * Number(selectedQty || 1);
                const unitPrice = Number(item.products?.regular_price || item.products?.sale_price || 0);
                return (
                  <div key={idx} className="rounded-xl border border-emerald-700/50 bg-emerald-900/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white text-sm md:text-base truncate">{item.products?.name_bn || item.products?.name_en || 'প্রোডাক্ট'}</div>
                        <div className="mt-1 text-xs text-emerald-200">প্রোডাক্ট মূল্য: <span className="font-bold text-white">৳{unitPrice}</span> / {unitType}</div>
                      </div>
                      <span className="shrink-0 bg-amber-400 text-slate-900 px-2.5 py-1 rounded-lg text-xs font-bold">{totalQuantity} {unitType}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : parsedItems.length > 0 ? (
            <div className="space-y-2">
              {parsedItems.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-emerald-900/60 p-3 rounded-xl border border-emerald-700/50">
                  <span className="font-medium text-white text-sm md:text-base">{item.name}</span>
                  {item.qty && <span className="bg-amber-400 text-slate-900 px-2.5 py-1 rounded-lg text-xs font-bold">{item.qty}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-300 text-center py-2">কোনো আইটেম যোগ করা হয়নি</p>
          )}
        </div>

        <div className="bg-slate-900 border-2 border-amber-400/50 rounded-2xl p-4 text-center shadow-lg">
          <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2 flex items-center justify-center gap-1">
            <Clock className="h-4 w-4" /> অফারটি শেষ হতে আর মাত্র...
          </p>
          <div className="flex justify-center gap-3 text-2xl font-black text-white">
            <div className="bg-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-700">{timer.hours} <span className="text-[10px] block text-emerald-300 font-normal">ঘণ্টা</span></div>
            <span>:</span>
            <div className="bg-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-700">{timer.minutes} <span className="text-[10px] block text-emerald-300 font-normal">মিনিট</span></div>
            <span>:</span>
            <div className="bg-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-700">{timer.seconds} <span className="text-[10px] block text-emerald-300 font-normal">সেকেন্ড</span></div>
          </div>
        </div>

        <div className="bg-[#1b4332] p-5 rounded-2xl border-2 border-amber-400/60 shadow-md text-center">
          <h3 className="text-base font-bold text-amber-400 mb-3">প্যাকেজের সংখ্যা সিলেক্ট করুন:</h3>
          <div className="grid grid-cols-3 gap-3">
            {combo.tier_pricing?.map((tier: any, idx: number) => {
              const tierQty = getTierQty(tier);
              const tierFreeDelivery = getTierFreeDelivery(tier);
              const isSelected = Number(selectedQty) === tierQty;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedQty(tierQty)}
                  className={`py-3 px-2 rounded-xl font-bold border-2 transition-all flex flex-col items-center justify-center relative ${
                    isSelected
                      ? 'bg-amber-500 border-white text-slate-900 shadow-lg scale-105 ring-2 ring-amber-300'
                      : 'bg-emerald-900/80 border-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  {tier.badge && (
                    <span className="absolute -top-2.5 bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase">
                      {tier.badge}
                    </span>
                  )}
                  <span className="text-sm md:text-base">{tierQty} প্যাকেট</span>
                  <span className="text-xs font-semibold mt-1">৳{Number(tier.offer) || 0}</span>
                  <span className={`mt-1 text-[9px] font-extrabold uppercase ${isSelected ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    {tierFreeDelivery ? 'Free Delivery' : 'Delivery Charge'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div id="order-form" className="bg-white text-slate-900 rounded-3xl p-6 shadow-2xl border-4 border-amber-400">
          <div className="text-center mb-5">
            <h2 className="text-2xl font-extrabold text-emerald-900">Billing Details</h2>
            <p className="text-xs text-slate-600 mt-1">অর্ডার কনফার্ম করতে নিচের ফরমটি পূরণ করুন</p>
          </div>

          <form onSubmit={handleOrderSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="h-4 w-4 text-emerald-700" /> আপনার পুরো নাম লিখুন *
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="যেমন: মো: রহিম" className="w-full border-2 border-slate-300 focus:border-emerald-700 rounded-xl p-3 text-sm outline-none transition-all text-slate-900" required />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-700" /> আপনার সম্পূর্ণ ঠিকানা *
              </label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="গ্রাম/মহল্লা, থানা, জেলা" className="w-full border-2 border-slate-300 focus:border-emerald-700 rounded-xl p-3 text-sm outline-none transition-all text-slate-900" required />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-emerald-700" /> আপনার ফোন নাম্বার *
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className="w-full border-2 border-slate-300 focus:border-emerald-700 rounded-xl p-3 text-sm outline-none transition-all text-slate-900" required />
            </div>

            <div className="bg-slate-100 rounded-2xl p-4 border border-slate-200 mt-4">
              <h4 className="font-bold text-sm text-slate-800 mb-2 border-b pb-1">Your Order Summary</h4>
              <div className="flex justify-between text-sm py-1 font-medium">
                <span>{combo.title_bn} ({selectedQty} প্যাকেট)</span>
                <span>৳{currentComboPrice}</span>
              </div>
              <div className="flex justify-between text-sm py-1 text-slate-600 border-b pb-2">
                <span>ডেলিভারি চার্জ</span>
                <span>{deliveryCharge === 0 ? <span className="text-green-600 font-bold">ফ্রি (Free)</span> : `৳${deliveryCharge}`}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-emerald-900 pt-2">
                <span>মোট পেমেন্ট</span>
                <span className="text-red-600">৳{finalTotal}</span>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full mt-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-lg uppercase tracking-wide disabled:opacity-50">
              <ShieldCheck className="h-6 w-6" /> {submitting ? 'অর্ডার প্রসেসিং হচ্ছে...' : `অর্ডার কনফার্ম করুন ৳${finalTotal}`}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
