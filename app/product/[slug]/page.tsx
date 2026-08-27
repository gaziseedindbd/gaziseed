'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingCart, Zap, Truck, ShieldCheck, Check, Star, MessageCircle, Gift, Package, ChevronDown, Heart, Sparkles, Sprout, Info, BookOpen, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ProductGallery } from '@/components/site/product-gallery';
import { getProductBySlug, getReviews, getProducts, getEffectivePrice, getDiscountPercent, formatPrice, getRelatedProducts, getProductFaqs, getBundleOffers, getActivePromotions, getProductVariants, getBulkPricing, addRecentlyViewed, toggleWishlist } from '@/lib/data';
import { addToCart } from '@/lib/cart';
import { toast } from '@/components/site/toast-provider';
import { ProductCard } from '@/components/site/product-card';
import { ReviewForm } from '@/components/site/review-form';
import { supabase } from '@/lib/supabase/client';
import { useLang } from '@/components/site/language-provider';
import type { Product, Review, ProductFaq, BundleOffer, Promotion, PromotionGift, ProductVariant, BulkPricing } from '@/lib/supabase/types';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(false);
  const [faqs, setFaqs] = useState<ProductFaq[]>([]);
  const [bundles, setBundles] = useState<BundleOffer[]>([]);
  const [promotions, setPromotions] = useState<{ promotion: Promotion; gifts: PromotionGift[]; giftProducts: Product[] }[]>([]);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySent, setNotifySent] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [bulkTiers, setBulkTiers] = useState<BulkPricing[]>([]);
  const [inWishlist, setInWishlist] = useState(false);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'guide' | 'reviews' | 'faqs'>('desc');
  const { lang, t, tDb } = useLang();

  useEffect(() => {
    setLoading(true);
    getProductBySlug(slug).then(async (p) => {
      setProduct(p);
      if (p) {
        addRecentlyViewed(p);
        getReviews(p.id).then(setReviews);
        getBundleOffers(p.id).then(setBundles);
        getProductFaqs(p.id).then(setFaqs);
        getActivePromotions().then(setPromotions);
        getProductVariants(p.id).then((vs) => { 
          setVariants(vs); 
          if (vs.length > 0) setSelectedVariant(vs[0]); 
          else getBulkPricing(p.id).then(setBulkTiers); 
        });
        if (p.related_product_ids && p.related_product_ids.length > 0) {
          getRelatedProducts(p.id, p.related_product_ids).then(setRelated);
        } else {
          const allProducts = await getProducts({ category_id: p.category_id || undefined });
          setRelated(allProducts.filter((item) => item.id !== p.id).slice(0, 4));
        }
      }
      setLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        setCurrentUser(data.session.user);
        if (product) {
          const { data: wl } = await supabase.from('wishlists').select('id').eq('user_id', data.session.user.id).eq('product_id', product.id).maybeSingle();
          setInWishlist(!!wl);
          const { data: orders } = await supabase
            .from('orders')
            .select('id, status')
            .eq('user_id', data.session.user.id)
            .eq('status', 'delivered');
          if (orders && orders.length > 0) {
            const orderIds = orders.map((o) => o.id);
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('product_id')
              .in('order_id', orderIds)
              .eq('product_id', product.id);
            setIsVerifiedPurchase((orderItems || []).length > 0);
          }
        }
      }
    });
  }, [product]);

  if (loading) {
    return (
      <div className="container-custom py-12 max-w-6xl mx-auto px-4 overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-3xl bg-secondary/50" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded-xl bg-secondary/50" />
            <div className="h-6 w-1/2 animate-pulse rounded-xl bg-secondary/50" />
            <div className="h-28 w-full animate-pulse rounded-2xl bg-secondary/50" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container-custom py-16 text-center overflow-hidden">
        <h1 className="text-2xl font-bold text-gray-800">{t('প্রোডাক্ট পাওয়া যায়নি', 'Product not found')}</h1>
        <a href="/all-products" className="mt-4 inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-primary/90 transition">{t('সকল প্রোডাক্ট দেখুন', 'View all products')}</a>
      </div>
    );
  }

  const price = getEffectivePrice(product);
  const discount = getDiscountPercent(product);
  const images = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);

  const effectivePrice = selectedVariant ? (selectedVariant.sale_price && selectedVariant.sale_price > 0 && selectedVariant.sale_price < selectedVariant.regular_price ? selectedVariant.sale_price : selectedVariant.regular_price) : price;
  const effectiveStock = selectedVariant ? selectedVariant.stock : product.stock;
  const inStock = effectiveStock > 0;

  const applicableBulk = bulkTiers.filter((b) => b.min_quantity <= quantity).sort((a, b) => b.min_quantity - a.min_quantity)[0];
  const finalUnitPrice = applicableBulk ? applicableBulk.unit_price : effectivePrice;
  const totalPrice = finalUnitPrice * quantity;

  const productName = lang === 'en' && product.name_en ? product.name_en : product.name_bn;
  const productDesc = tDb(product.description || '');
  const productShortDesc = tDb(product.short_description || '');

  const handleAddToCart = () => {
    if (!inStock) { toast(t('পণ্যটি স্টকে নেই', 'Product is out of stock'), 'error'); return false; }
    if (product.min_order_qty && quantity < product.min_order_qty) { toast(t(`ন্যূনতম ${product.min_order_qty} টি কিনতে হবে`, `Minimum ${product.min_order_qty} required`), 'error'); return false; }
    if (product.max_order_qty && quantity > product.max_order_qty) { toast(t(`সর্বোচ্চ ${product.max_order_qty} টি কিনতে পারবেন`, `Maximum ${product.max_order_qty} allowed`), 'error'); return false; }
    addToCart(product, quantity, {
      name: selectedVariant ? `${productName} (${selectedVariant.name})` : productName,
      unit_price: finalUnitPrice,
      variant_id: selectedVariant?.id,
      variant_name: selectedVariant?.name,
    });
    toast(t('কার্টে যোগ করা হয়েছে', 'Added to cart'));
    return true;
  };

  const handleBuyNow = () => {
    if (handleAddToCart()) router.push('/checkout');
  };

  const handleWishlist = async () => {
    if (!currentUser) { toast(t('উইশলিস্টে যোগ করতে লগইন করুন', 'Login to add to wishlist'), 'error'); router.push('/login'); return; }
    const added = await toggleWishlist(currentUser.id, product.id);
    setInWishlist(added);
    toast(added ? t('উইশলিস্টে যোগ করা হয়েছে', 'Added to wishlist') : t('উইশলিস্ট থেকে সরানো হয়েছে', 'Removed from wishlist'));
  };

  const handleNotifyMe = async () => {
    if (!notifyPhone) { toast(t('ফোন নম্বর দিন', 'Enter phone number'), 'error'); return; }
    const { error } = await supabase.from('stock_notifications').insert({ product_id: product.id, phone: notifyPhone, email: notifyEmail || null });
    if (error) { toast(t('সংরক্ষণ ব্যর্থ', 'Failed to save'), 'error'); return; }
    setNotifySent(true);
    toast(t('আপনাকে স্টকে এলে জানানো হবে', 'You will be notified when in stock'));
  };

  const seedInfoFields = [
    { label: t('বীজের ধরন', 'Seed Type'), value: product.seed_type },
    { label: t('জাত', 'Variety'), value: product.variety },
    { label: t('ব্র্যান্ড', 'Brand'), value: product.brand },
    { label: t('উৎপত্তি', 'Origin'), value: product.origin },
    { label: t('মৌসুম', 'Season'), value: product.season },
    { label: t('বপনের মৌসুম', 'Planting Season'), value: product.planting_season },
    { label: t('অঙ্কুরোদগম সময়', 'Germination Time'), value: product.germination_time },
    { label: t('অঙ্কুরোদগম হার', 'Germination Rate'), value: product.germination_rate },
    { label: t('ফসল তোলার সময়', 'Harvest Time'), value: product.harvest_time },
    { label: t('গাছের দূরত্ব', 'Plant Spacing'), value: product.plant_spacing },
    { label: t('বপনের গভীরতা', 'Planting Depth'), value: product.planting_depth },
    { label: t('সূর্যালোক', 'Sunlight'), value: product.sunlight },
    { label: t('পানির প্রয়োজন', 'Water Requirement'), value: product.water_requirement },
    { label: t('মাটির ধরন', 'Soil Type'), value: product.soil_type },
    { label: t('চাষের স্থান', 'Growing Location'), value: product.growing_location },
    { label: t('প্যাকেটের ওজন', 'Packet Weight'), value: product.packet_weight },
    { label: t('বীজের পরিমাণ', 'Seed Quantity'), value: product.seed_quantity },
    { label: t('প্রত্যাশিত ফলন', 'Expected Yield'), value: product.expected_yield },
  ].filter((f) => f.value);

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-[#fafbfc] py-6 sm:py-10 pb-36 lg:pb-12 text-gray-900 overflow-x-hidden">
      <div className="max-w-6xl w-full mx-auto px-4">
        
        {/* টপ সেকশন: গ্যালারি ও প্রোডাক্ট ইনফো */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start w-full">
          
          {/* গ্যালারি */}
          <div className="w-full min-w-0">
            <div className="rounded-3xl border border-gray-200/80 bg-white p-3 shadow-md w-full overflow-hidden">
              <ProductGallery images={images} alt={productName} discount={discount} />
            </div>
          </div>

          {/* প্রোডাক্ট বিস্তারিত */}
          <div className="space-y-5 w-full min-w-0">
            
            {/* হেডার ও ব্যাজ */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3 py-0.5 text-xs font-bold flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> {t('১০০% অরিজিনাল বীজ', '100% Original Seeds')}
                  </span>
                  {product.sku && <span className="text-xs text-gray-400 font-medium">SKU: {product.sku}</span>}
                </div>
                <button 
                  onClick={handleWishlist} 
                  className={`rounded-full p-2 border transition shrink-0 ${inWishlist ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 bg-white text-gray-400 hover:text-red-500'}`}
                  title="উইশলিস্টে রাখুন"
                >
                  <Heart className={`h-4 w-4 ${inWishlist ? 'fill-current' : ''}`} />
                </button>
              </div>

              {product.name_en && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{product.name_en}</p>}
              <h1 className="mt-1 text-xl sm:text-3xl font-black text-gray-900 leading-tight break-words">{productName}</h1>

              {/* রেটিং সামারি */}
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-bold text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>{avgRating ? `${avgRating} / ৫.০` : t('নতুন পণ্য', 'New Product')}</span>
                </div>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs font-medium text-gray-500">{reviews.length} {t('টি ভেরিফায়েড রিভিউ', 'Verified Reviews')}</span>
              </div>
            </div>

            {/* প্রাইসিং কার্ড */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white border border-emerald-200/80 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-gray-500 block">{t('বর্তমান মূল্য', 'Current Price')}</span>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-800">{formatPrice(finalUnitPrice)}</span>
                  {discount > 0 && !selectedVariant && (
                    <span className="text-sm sm:text-base text-gray-400 line-through font-semibold">{formatPrice(product.regular_price)}</span>
                  )}
                  {selectedVariant && selectedVariant.sale_price && selectedVariant.sale_price > 0 && selectedVariant.sale_price < selectedVariant.regular_price && (
                    <span className="text-sm sm:text-base text-gray-400 line-through font-semibold">{formatPrice(selectedVariant.regular_price)}</span>
                  )}
                </div>
              </div>
              {discount > 0 && (
                <div className="rounded-full bg-red-500 text-white text-xs font-black px-3.5 py-1.5 shadow-xs shrink-0 whitespace-nowrap">
                  {discount}% {t('ছাড়', 'OFF')}
                </div>
              )}
            </div>

            {/* ভ্যারিয়েন্ট সিলেকশন */}
            {variants.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">{t('প্যাকেট বা জাত নির্বাচন করুন', 'Select Packet or Variety')}</label>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const vPrice = v.sale_price && v.sale_price > 0 && v.sale_price < v.regular_price ? v.sale_price : v.regular_price;
                    return (
                      <button 
                        key={v.id} 
                        onClick={() => setSelectedVariant(v)} 
                        className={`rounded-2xl border-2 px-3.5 py-2 text-xs sm:text-sm font-bold transition-all ${
                          isSelected 
                            ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-xs ring-1 ring-emerald-500/30' 
                            : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300'
                        }`}
                      >
                        {v.name} — <span className="text-emerald-700 font-extrabold">{formatPrice(vPrice)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* বাল্ক প্রাইসিং টিয়ার */}
            {bulkTiers.length > 0 && (
              <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3 text-xs space-y-1">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-amber-600" /> {t('একসাথে বেশি নিলে বিশেষ ছাড়:', 'Special discount for bulk purchase:')}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {bulkTiers.map((b, idx) => (
                    <span key={idx} className="bg-white px-2.5 py-1 rounded-lg border border-amber-200 font-semibold text-gray-700">
                      {b.min_quantity}+ {t('টি', 'pcs')} = <b className="text-emerald-700">{formatPrice(b.unit_price)}</b>/{t('টি', 'pc')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* স্টক স্ট্যাটাস */}
            <div>
              {inStock ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <Check className="h-3.5 w-3.5" /> {t('স্টকে এভেইলেবল আছে', 'In Stock')}
                  {product.show_low_stock && effectiveStock <= (product.low_stock_threshold || 5) && (
                    <span className="text-red-600"> ({t(`মাত্র ${effectiveStock} টি বাকি!`, `Only ${effectiveStock} left!`)})</span>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                  {t('স্টক শেষ হয়ে গেছে', 'Out of Stock')}
                </div>
              )}
            </div>

            {/* শর্ট ডেসক্রিপশন */}
            {productShortDesc && (
              <div className="rounded-2xl bg-gray-50/90 border border-gray-200/80 p-4 text-xs sm:text-sm text-gray-700 leading-relaxed font-medium whitespace-pre-line space-y-2 shadow-2xs">
                {productShortDesc}
              </div>
            )}

            {/* পরিমাণ ও টোটাল */}
            {inStock && (
              <div className="flex items-center gap-4 pt-1 flex-wrap">
                <div className="flex items-center rounded-2xl border-2 border-gray-200 bg-white p-1 shadow-2xs">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                    className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition active:scale-95" 
                    aria-label="কমান"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center font-black text-sm">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)} 
                    className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition active:scale-95" 
                    aria-label="বাড়ান"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs">
                  <span className="text-gray-400 block font-medium">{t('সর্বমোট মূল্য', 'Total Price')}</span>
                  <span className="text-lg font-black text-gray-900">{formatPrice(totalPrice)}</span>
                </div>
              </div>
            )}

            {/* বাটনসমূহ */}
            {inStock ? (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  onClick={handleAddToCart} 
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600/30 bg-emerald-50/60 py-3.5 font-extrabold text-emerald-900 hover:bg-emerald-100 transition active:scale-98 cursor-pointer shadow-xs text-xs sm:text-sm"
                >
                  <ShoppingCart className="h-5 w-5 text-emerald-700" /> {t('কার্টে যোগ করুন', 'Add to Cart')}
                </button>
                <button 
                  onClick={handleBuyNow} 
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 py-3.5 font-extrabold text-white shadow-lg shadow-emerald-700/25 hover:from-emerald-800 hover:to-emerald-900 transition active:scale-98 cursor-pointer text-xs sm:text-sm"
                >
                  <Zap className="h-5 w-5 fill-current text-amber-300" /> {t('এখনই অর্ডার করুন', 'Buy Now')}
                </button>
              </div>
            ) : (
              <div className="pt-2">
                {!notifySent ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <p className="font-bold text-xs text-amber-800">{t('পণ্যটি পুনরায় স্টকে এলে নোটিফিকেশন পেতে চান?', 'Want to be notified when back in stock?')}</p>
                    {!notifyOpen ? (
                      <button onClick={() => setNotifyOpen(true)} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition">{t('স্টকে এলে জানান', 'Notify me')}</button>
                    ) : (
                      <div className="space-y-2">
                        <input value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} placeholder={t('১১ ডিজিটের মোবাইল নম্বর *', '11-digit mobile number *')} className="input-bangla w-full text-xs" />
                        <button onClick={handleNotifyMe} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition">{t('নোটিফিকেশন সক্রিয় করুন', 'Activate Notification')}</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <Check className="h-4 w-4" /> {t('স্টকে আসার সাথে সাথে আপনাকে এসএমএস দিয়ে জানানো হবে।', 'You will be notified via SMS as soon as it is in stock.')}
                  </div>
                )}
              </div>
            )}

            {/* ট্রাস্ট কার্ড গ্রিড */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="p-3 rounded-2xl bg-white border border-gray-200/70 text-center shadow-2xs">
                <Truck className="h-5 w-5 text-emerald-700 mx-auto mb-1" />
                <span className="text-[11px] font-bold text-gray-800 block">{t('সারাদেশে হোম ডেলিভারি', 'Home Delivery Nationwide')}</span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-gray-200/70 text-center shadow-2xs">
                <ShieldCheck className="h-5 w-5 text-emerald-700 mx-auto mb-1" />
                <span className="text-[11px] font-bold text-gray-800 block">{t('ক্যাশ অন ডেলিভারি', 'Cash on Delivery')}</span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-gray-200/70 text-center shadow-2xs">
                <CheckCircle2 className="h-5 w-5 text-emerald-700 mx-auto mb-1" />
                <span className="text-[11px] font-bold text-gray-800 block">{t('১০০% খাঁটি ও পরীক্ষিত', '100% Pure & Tested')}</span>
              </div>
            </div>

          </div>
        </div>

        {/* বান্ডেল অফার */}
        {bundles.length > 0 && (
          <div className="mt-12 rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-emerald-700" /> {t('একসাথে নিলে বিশেষ ছাড় (বান্ডেল ডিল)', 'Special Bundle Deal')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bundles.map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs gap-3">
                  <div>
                    <p className="font-extrabold text-sm text-gray-900">{b.bundle_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{b.quantity} {t('টি প্যাকেট বান্ডেল', 'pcs bundle')}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-black text-emerald-800 text-base">{formatPrice(b.bundle_price)}</span>
                      <span className="text-xs text-gray-400 line-through font-semibold">{formatPrice(((product.regular_price || product.sale_price || 0) * b.quantity))}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => addBundleToCartHelper(b)} 
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition active:scale-95 shrink-0"
                  >
                    {t('যোগ করুন', 'Add')} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* প্রিমিয়াম ট্যাব সেকশন */}
        <div className="mt-14">
          <div className="flex overflow-x-auto border-b border-gray-200 gap-2 sm:gap-4 no-scrollbar">
            <button 
              onClick={() => setActiveTab('desc')} 
              className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer ${
                activeTab === 'desc' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Info className="h-4 w-4" /> {t('বিস্তারিত বিবরণ', 'Description')}
            </button>
            {seedInfoFields.length > 0 && (
              <button 
                onClick={() => setActiveTab('specs')} 
                className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer ${
                  activeTab === 'specs' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <Sprout className="h-4 w-4" /> {t('বীজের জাত ও স্পেকস', 'Seed Specs')}
              </button>
            )}
            {(product.cultivation_instructions || product.storage_instructions) && (
              <button 
                onClick={() => setActiveTab('guide')} 
                className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer ${
                  activeTab === 'guide' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <BookOpen className="h-4 w-4" /> {t('চাষ ও পরিচর্যা', 'Cultivation Guide')}
              </button>
            )}
            <button 
              onClick={() => setActiveTab('reviews')} 
              className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer ${
                activeTab === 'reviews' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Star className="h-4 w-4" /> {t('রিভিউ', 'Reviews')} ({reviews.length})
            </button>
            {faqs.length > 0 && (
              <button 
                onClick={() => setActiveTab('faqs')} 
                className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer ${
                  activeTab === 'faqs' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <HelpCircle className="h-4 w-4" /> {t('সাধারণ জিজ্ঞাসা', 'FAQ')}
              </button>
            )}
          </div>

          {/* ট্যাব কনটেন্ট */}
          <div className="py-6 sm:py-8 bg-white rounded-3xl border border-gray-200/80 p-5 sm:p-8 mt-4 shadow-2xs">
            
            {activeTab === 'desc' && (
              <div className="space-y-6">
                {productDesc && (
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-gray-900 mb-3">{t('পণ্যের বিবরণ', 'Product Description')}</h3>
                    <p className="whitespace-pre-line text-sm sm:text-base text-gray-600 leading-relaxed font-normal break-words">{productDesc}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'specs' && (
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900 mb-4">{t('বীজ সম্পর্কিত তথ্যাবলী', 'Seed Specifications')}</h3>
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-xs sm:text-sm">
                    <tbody className="divide-y divide-gray-200">
                      {seedInfoFields.map((field, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50/70' : 'bg-white'}>
                          <td className="w-1/3 px-4 py-3 font-bold text-gray-700">{field.label}</td>
                          <td className="px-4 py-3 text-gray-600 font-medium">{field.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'guide' && (
              <div className="space-y-6">
                {product.cultivation_instructions && (
                  <div className="rounded-2xl bg-emerald-50/60 border border-emerald-200/80 p-5">
                    <h3 className="text-base font-black text-emerald-950 mb-2 flex items-center gap-2">
                      <Sprout className="h-5 w-5 text-emerald-700" /> {t('চাষ ও রোপণ পদ্ধতি', 'Cultivation Method')}
                    </h3>
                    <p className="whitespace-pre-line text-xs sm:text-sm text-emerald-900 leading-relaxed break-words">{tDb(product.cultivation_instructions)}</p>
                  </div>
                )}
                {product.storage_instructions && (
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">{t('সংরক্ষণ পদ্ধতি', 'Storage Method')}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed break-words">{tDb(product.storage_instructions)}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl bg-gray-50 border border-gray-200/80 p-5">
                  <div className="text-center sm:border-r sm:border-gray-200 sm:pr-8">
                    <p className="text-4xl font-black text-emerald-800">{avgRating || '০.০'}</p>
                    <div className="mt-1 flex justify-center gap-0.5 text-amber-400">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} className={`h-4 w-4 ${Number(avgRating) >= s ? 'fill-current' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 font-medium">{reviews.length} {t('টি রেটিং', 'Ratings')}</p>
                  </div>
                  <div className="flex-1 w-full">
                    <ReviewForm 
                      productId={product.id} 
                      productName={productName} 
                      user={currentUser} 
                      isVerifiedPurchase={isVerifiedPurchase} 
                      onSubmitted={() => getReviews(product.id).then(setReviews)} 
                    />
                  </div>
                </div>

                {reviews.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    {reviews.map((r) => (
                      <div key={r.id} className="rounded-2xl border border-gray-200 p-4 space-y-2 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800 shrink-0">
                              {r.customer_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-xs sm:text-sm text-gray-900 block">{r.customer_name}</span>
                              {r.verified_purchase && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                  <Check className="h-3 w-3" /> {t('ভেরিফায়েড ক্রেতা', 'Verified Buyer')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-0.5 text-amber-400">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} className={`h-3.5 w-3.5 ${r.rating >= s ? 'fill-current' : 'text-gray-200'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 break-words">{r.review}</p>
                        {r.photo && <img src={r.photo} alt="" className="mt-2 h-20 w-20 rounded-xl border border-gray-200 object-cover" />}
                        {r.admin_reply && (
                          <div className="mt-2 rounded-xl border-l-4 border-emerald-600 bg-emerald-50/50 p-3 text-xs">
                            <p className="font-bold text-emerald-900">SEED BARI {t('অ্যাডমিন রিপ্লাই:', 'Admin Reply:')}</p>
                            <p className="mt-0.5 text-emerald-800 break-words">{r.admin_reply}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs sm:text-sm text-gray-400 py-6">{t('এখনো কোনো রিভিউ দেওয়া হয়নি। প্রথম রিভিউটি আপনিই দিন!', 'No reviews yet. Be the first to review!')}</p>
                )}
              </div>
            )}

            {activeTab === 'faqs' && (
              <div className="space-y-3">
                {faqs.map((f, idx) => (
                  <div key={f.id} className="rounded-2xl border border-gray-200 bg-white">
                    <button onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)} className="flex w-full items-center justify-between p-4 text-left font-bold text-xs sm:text-sm text-gray-800">
                      <span className="break-words">{lang === 'en' && f.question_en ? f.question_en : f.question_bn}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${openFaqIdx === idx ? 'rotate-180 text-emerald-700' : ''}`} />
                    </button>
                    {openFaqIdx === idx && (
                      <div className="border-t border-gray-100 p-4 text-xs sm:text-sm text-gray-600 bg-gray-50/50 break-words">{lang === 'en' && f.answer_en ? f.answer_en : f.answer_bn}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* রিলেটেড প্রোডাক্টস */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="mb-6 text-xl sm:text-2xl font-black text-gray-900">{t('এই বীজগুলোও আপনার ভালো লাগতে পারে', 'You may also like these seeds')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* মোবাইল স্টিকি বটম বার */}
      {inStock && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md p-3.5 pb-6 shadow-2xl lg:hidden">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-gray-400 font-semibold block">{quantity} {t('টি পণ্যের মোট মূল্য', 'Total items price')}</span>
              <p className="text-lg font-black text-emerald-800">{formatPrice(totalPrice)}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAddToCart} 
                className="p-3 rounded-xl border border-emerald-600/30 bg-emerald-50 text-emerald-900 active:scale-95 transition"
                title="কার্টে যোগ করুন"
              >
                <ShoppingCart className="h-5 w-5 text-emerald-700" />
              </button>
              <button 
                onClick={handleBuyNow} 
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-800 px-5 py-3 text-xs font-extrabold text-white shadow-md shadow-emerald-700/30 active:scale-95 transition"
              >
                <Zap className="h-4 w-4 fill-current text-amber-300" />
                {t('অর্ডার করুন', 'Order Now')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Structured Data for SEO */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": productName,
        "image": images,
        "description": productShortDesc || productDesc || productName,
        "sku": product.sku || product.slug,
        "brand": product.brand ? { "@type": "Brand", "name": product.brand } : { "@type": "Brand", "name": "SEED BARI" },
        "offers": {
          "@type": "Offer",
          "priceCurrency": "BDT",
          "price": price,
          "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
        },
        ...(reviews.length > 0 ? {
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1),
            "reviewCount": reviews.length
          }
        } : {})
      })}} />
    </div>
  );
}

function addBundleToCartHelper(bundle: BundleOffer) {
  // helper for bundle
}
