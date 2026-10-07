'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingCart, Zap, Truck, ShieldCheck, Check, Star, MessageCircle, Gift, Package, ChevronDown, Heart, Sparkles, Sprout, Info, BookOpen, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ProductGallery } from '@/components/site/product-gallery';
import { getProductBySlug, getReviews, getProducts, getEffectivePrice, getDiscountPercent, formatPrice, getRelatedProducts, getProductFaqs, getBundleOffers, getActivePromotions, getProductVariants, getBulkPricing, addRecentlyViewed, toggleWishlist } from '@/lib/data';
import { addToCart, getCart } from '@/lib/cart';
import { toast } from '@/components/site/toast-provider';
import { ProductCard } from '@/components/site/product-card';
import { ReviewForm } from '@/components/site/review-form';
import ProductReviewShowcase from '@/components/site/product-review-showcase';
import ProductOfferSpotlight from '@/components/site/product-offer-spotlight';
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
  const [loadError, setLoadError] = useState(false);
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
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setProduct(null);

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
      setLoadError(true);
    }, 12000);

    getProductBySlug(slug)
      .then(async (p) => {
        if (cancelled) return;
        setProduct(p);
        if (p) {
          addRecentlyViewed(p);
          getReviews(p.id).then(setReviews).catch(() => setReviews([]));
          getBundleOffers(p.id).then(setBundles).catch(() => setBundles([]));
          getProductFaqs(p.id).then(setFaqs).catch(() => setFaqs([]));
          getActivePromotions().then(setPromotions).catch(() => setPromotions([]));
          getProductVariants(p.id).then((vs) => {
            if (cancelled) return;
            setVariants(vs);
            if (vs.length > 0) setSelectedVariant(vs[0]);
          }).catch(() => setVariants([]));
          getBulkPricing(p.id)
            .then((tiers) => {
              if (cancelled) return;
              setBulkTiers(tiers || []);
            })
            .catch(() => setBulkTiers([]));
          if (p.related_product_ids && p.related_product_ids.length > 0) {
            getRelatedProducts(p.id, p.related_product_ids).then(setRelated).catch(() => setRelated([]));
          } else {
            const allProducts = await getProducts({ category_id: p.category_id || undefined });
            if (!cancelled) setRelated(allProducts.filter((item) => item.id !== p.id).slice(0, 4));
          }
        }
        clearTimeout(timeoutId);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setProduct(null);
        setLoading(false);
        setLoadError(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
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
        <h1 className="text-2xl font-bold text-gray-800">{loadError ? t('পণ্যটি লোড করা যায়নি', 'Could not load this product') : t('প্রোডাক্ট পাওয়া যায়নি', 'Product not found')}</h1>
        <p className="mt-2 text-sm text-gray-500">{loadError ? t('নেটওয়ার্ক বা ডেটা সমস্যার কারণে পণ্যটি এখন দেখানো যাচ্ছে না। আবার চেষ্টা করুন।', 'The product could not be loaded due to a network or data issue. Please try again.') : t('এই দেশের জন্য পণ্যটি উপলভ্য নয় অথবা লিংকটি সঠিক নয়।', 'This product is not available for this country or the link is invalid.')}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {loadError && <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-primary/90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{t('আবার চেষ্টা করুন', 'Try again')}</button>}
          <a href="/all-products" className="inline-block rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{t('সকল প্রোডাক্ট দেখুন', 'View all products')}</a>
        </div>
      </div>
    );
  }

  const price = getEffectivePrice(product);
  const discount = getDiscountPercent(product);
  const images = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);

  const effectivePrice = selectedVariant ? (selectedVariant.sale_price && selectedVariant.sale_price > 0 && selectedVariant.sale_price < selectedVariant.regular_price ? selectedVariant.sale_price : selectedVariant.regular_price) : price;
  const effectiveStock = selectedVariant ? selectedVariant.stock : product.stock;
  const inStock = effectiveStock > 0;
  const quantityLimit = Math.min(effectiveStock, product.max_order_qty || effectiveStock);

  const selectedBulkTiers = bulkTiers
    .filter((b) => b.is_active && (selectedVariant ? b.variant_id === selectedVariant.id : b.variant_id === null))
    .sort((a, b) => a.min_quantity - b.min_quantity);
  const applicableBulk = selectedBulkTiers.filter((b) => b.min_quantity <= quantity).sort((a, b) => b.min_quantity - a.min_quantity)[0];
  const finalUnitPrice = applicableBulk ? applicableBulk.unit_price : effectivePrice;
  const totalPrice = finalUnitPrice * quantity;

  const translated = (product as any).translations?.[lang] || {};
  const productName = translated.name || (lang === 'en' && product.name_en ? product.name_en : lang === 'hi' && product.name_en ? product.name_en : product.name_bn);
  const productDesc = tDb(translated.description || product.description || '');
  const productShortDesc = tDb(translated.short_description || product.short_description || '');

  const handleAddToCart = () => {
    if (!inStock) { toast(t('পণ্যটি স্টকে নেই', 'Product is out of stock'), 'error'); return false; }
    if (product.min_order_qty && quantity < product.min_order_qty) { toast(t(`ন্যূনতম ${product.min_order_qty} টি কিনতে হবে`, `Minimum ${product.min_order_qty} required`), 'error'); return false; }
    if (product.max_order_qty && quantity > product.max_order_qty) { toast(t(`সর্বোচ্চ ${product.max_order_qty} টি কিনতে পারবেন`, `Maximum ${product.max_order_qty} allowed`), 'error'); return false; }
    const existingQuantity = getCart().filter((item) => item.product_id === product.id && (item.variant_id || '') === (selectedVariant?.id || '')).reduce((sum, item) => sum + item.quantity, 0);
    if (existingQuantity + quantity > quantityLimit) { toast(t('স্টকের চেয়ে বেশি পরিমাণ যোগ করা যাবে না', 'Quantity exceeds available stock or order limit', 'मात्रा उपलब्ध स्टॉक या ऑर्डर सीमा से अधिक है'), 'error'); return false; }
    addToCart(product, quantity, {
      name: selectedVariant ? `${productName} (${selectedVariant.name})` : productName,
      unit_price: finalUnitPrice,
      base_unit_price: effectivePrice,
      variant_id: selectedVariant?.id,
      variant_name: selectedVariant?.name,
      bulk_tiers: selectedBulkTiers,
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
    { label: t('বীজের ধরন', 'Seed Type'), value: tDb(translated.seed_type || product.seed_type || '') },
    { label: t('জাত', 'Variety'), value: tDb(translated.variety || product.variety || '') },
    { label: t('ব্র্যান্ড', 'Brand'), value: tDb(translated.brand || product.brand || '') },
    { label: t('উৎপত্তি', 'Origin'), value: tDb(translated.origin || product.origin || '') },
    { label: t('মৌসুম', 'Season'), value: tDb(translated.season || product.season || '') },
    { label: t('বপনের মৌসুম', 'Planting Season'), value: tDb(translated.planting_season || product.planting_season || '') },
    { label: t('অঙ্কুরোদগম সময়', 'Germination Time'), value: tDb(translated.germination_time || product.germination_time || '') },
    { label: t('অঙ্কুরোদগম হার', 'Germination Rate'), value: tDb(translated.germination_rate || product.germination_rate || '') },
    { label: t('ফসল তোলার সময়', 'Harvest Time'), value: tDb(translated.harvest_time || product.harvest_time || '') },
    { label: t('গাছের দূরত্ব', 'Plant Spacing'), value: tDb(translated.plant_spacing || product.plant_spacing || '') },
    { label: t('বপনের গভীরতা', 'Planting Depth'), value: tDb(translated.planting_depth || product.planting_depth || '') },
    { label: t('সূর্যালোক', 'Sunlight'), value: tDb(translated.sunlight || product.sunlight || '') },
    { label: t('পানির প্রয়োজন', 'Water Requirement'), value: tDb(translated.water_requirement || product.water_requirement || '') },
    { label: t('মাটির ধরন', 'Soil Type'), value: tDb(translated.soil_type || product.soil_type || '') },
    { label: t('চাষের স্থান', 'Growing Location'), value: tDb(translated.growing_location || product.growing_location || '') },
    { label: t('প্যাকেটের ওজন', 'Packet Weight'), value: tDb(translated.packet_weight || product.packet_weight || '') },
    { label: t('বীজের পরিমাণ', 'Seed Quantity'), value: tDb(translated.seed_quantity || product.seed_quantity || '') },
    { label: t('প্রত্যাশিত ফলন', 'Expected Yield'), value: tDb(translated.expected_yield || product.expected_yield || '') },
  ].filter((f) => f.value);

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-[#fafbfc] py-6 sm:py-10 pb-36 lg:pb-12 text-gray-900 overflow-x-hidden">
      <div className="max-w-6xl w-full mx-auto px-4">
        <ProductOfferSpotlight
          enabled={product.promotional_offer_enabled}
          badge={product.promotional_offer_badge}
          badgeEn={product.promotional_offer_badge_en}
          badgeHi={product.promotional_offer_badge_hi}
          title={product.promotional_offer_title}
          titleEn={product.promotional_offer_title_en}
          titleHi={product.promotional_offer_title_hi}
          description={product.promotional_offer_description}
          descriptionEn={product.promotional_offer_description_en}
          descriptionHi={product.promotional_offer_description_hi}
          benefits={product.promotional_offer_benefits}
          benefitsEn={product.promotional_offer_benefits_en}
          benefitsHi={product.promotional_offer_benefits_hi}
          image={product.promotional_offer_image}
          imageEn={product.promotional_offer_image_en}
          imageHi={product.promotional_offer_image_hi}
          fallbackImage={images[0] || null}
          ctaText={product.promotional_offer_cta_text}
          ctaTextEn={product.promotional_offer_cta_text_en}
          ctaTextHi={product.promotional_offer_cta_text_hi}
          ctaLink={product.promotional_offer_cta_link}
          endDate={product.promotional_offer_end_date}
          note={product.promotional_offer_note}
          noteEn={product.promotional_offer_note_en}
          noteHi={product.promotional_offer_note_hi}
          lang={lang}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start w-full">
          <div className="w-full min-w-0">
            <div className="rounded-3xl border border-gray-200/80 bg-white p-3 shadow-md w-full overflow-hidden">
              <ProductGallery images={images} alt={productName} discount={discount} />
            </div>
          </div>
          <div id="product-purchase" className="scroll-mt-24 space-y-5 w-full min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3 py-0.5 text-xs font-bold flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> {t('১০০% অরিজিনাল বীজ', '100% Original Seeds')}
                  </span>
                  {product.sku && <span className="text-xs text-gray-400 font-medium">SKU: {product.sku}</span>}
                </div>
                <button onClick={handleWishlist} aria-label={inWishlist ? t('উইশলিস্ট থেকে সরান', 'Remove from wishlist') : t('উইশলিস্টে রাখুন', 'Add to wishlist')} aria-pressed={inWishlist} className={`rounded-full p-2.5 border transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${inWishlist ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 bg-white text-gray-400 hover:text-red-500'}`} title="উইশলিস্টে রাখুন">
                  <Heart className={`h-4 w-4 ${inWishlist ? 'fill-current' : ''}`} />
                </button>
              </div>
              {lang !== 'en' && product.name_en && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{product.name_en}</p>}
              <h1 className="mt-1 text-xl sm:text-3xl font-black text-gray-900 leading-tight break-words">{productName}</h1>
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-bold text-amber-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /><span>{avgRating ? `${avgRating} / ৫.০` : t('নতুন পণ্য', 'New Product')}</span></div>
                <span className="text-xs text-gray-400">•</span><span className="text-xs font-medium text-gray-500">{reviews.length} {t('টি ভেরিফায়েড রিভিউ', 'Verified Reviews')}</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white border border-emerald-200/80 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1"><span className="text-xs font-medium text-gray-500 block">{t('বর্তমান মূল্য', 'Current Price')}</span><div className="flex items-baseline gap-2.5 flex-wrap"><span className="text-2xl sm:text-3xl font-black text-emerald-800">{formatPrice(finalUnitPrice)}</span>{discount > 0 && !selectedVariant && <span className="text-sm sm:text-base text-gray-400 line-through font-semibold">{formatPrice(product.regular_price)}</span>}{selectedVariant && selectedVariant.sale_price && selectedVariant.sale_price > 0 && selectedVariant.sale_price < selectedVariant.regular_price && <span className="text-sm sm:text-base text-gray-400 line-through font-semibold">{formatPrice(selectedVariant.regular_price)}</span>}</div></div>
              {discount > 0 && <div className="rounded-full bg-red-500 text-white text-xs font-black px-3.5 py-1.5 shadow-xs shrink-0 whitespace-nowrap">{discount}% {t('ছাড়', 'OFF')}</div>}
            </div>
            {variants.length > 0 && <div className="space-y-2"><label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">{t('প্যাকেট বা জাত নির্বাচন করুন', 'Select Packet or Variety')}</label><div className="flex flex-wrap gap-2">{variants.map((v) => { const isSelected = selectedVariant?.id === v.id; const vPrice = v.sale_price && v.sale_price > 0 && v.sale_price < v.regular_price ? v.sale_price : v.regular_price; return <button key={v.id} type="button" onClick={() => { setSelectedVariant(v); setQuantity(product.min_order_qty || 1); }} aria-pressed={isSelected} className={`rounded-2xl border-2 px-3.5 py-2 min-h-11 text-xs sm:text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isSelected ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-xs ring-1 ring-emerald-500/30' : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300'}`}>{v.name} — <span className="text-emerald-700 font-extrabold">{formatPrice(vPrice)}</span></button>; })}</div></div>}
            {selectedBulkTiers.length > 0 && <div className="relative overflow-hidden rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-3.5 sm:p-4 shadow-lg shadow-orange-100/70">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-300/20 blur-2xl" />
              <div className="pointer-events-none absolute -left-10 bottom-0 h-20 w-20 rounded-full bg-amber-300/20 blur-2xl" />
              <div className="relative mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 px-3 py-1.5 text-white shadow-md shadow-red-200/60 animate-pulse">
                    <Sparkles className="h-4 w-4 shrink-0 text-yellow-200" />
                    <span className="text-sm sm:text-base font-black tracking-wide">{t('🔥 বেশি কিনুন, বেশি সাশ্রয় করুন', '🔥 BUY MORE, SAVE MORE')}</span>
                  </div>
                  <p className="mt-2 text-[11px] sm:text-xs font-bold text-orange-950">
                    {t('বেশি প্যাকেট নিলে আরও বেশি সাশ্রয় — সেরা অফারটি অটোমেটিক প্রযোজ্য হবে।', 'Buy more packs and save more — the best eligible offer applies automatically.')}
                  </p>
                </div>
                <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm animate-bounce">
                  <Zap className="h-3 w-3 fill-current text-yellow-300" />
                  {t('সেরা অফার', 'BEST VALUE')}
                </span>
              </div>
              <div className="relative grid gap-2 sm:grid-cols-2">
                {selectedBulkTiers.map((b) => {
                  const offerTotal = b.unit_price * b.min_quantity;
                  const normalTotal = effectivePrice * b.min_quantity;
                  const savings = Math.max(0, normalTotal - offerTotal);
                  const discountPct = normalTotal > 0 ? Math.round((savings / normalTotal) * 100) : 0;
                  const isActive = !!applicableBulk && applicableBulk.id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={b.min_quantity > quantityLimit} onClick={() => setQuantity(Math.min(quantityLimit, Math.max(quantity, b.min_quantity)))}
                      className={`group relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isActive ? 'border-red-400 bg-gradient-to-br from-red-50 to-orange-50 shadow-md ring-2 ring-red-200/70' : 'border-orange-200 bg-white hover:border-orange-300'}`}
                      aria-label={t(
                        b.free_item_text
                          ? `${b.min_quantity} প্যাকেট নিলে ${b.free_item_text} — অফার নিন`
                          : `${b.min_quantity} প্যাকেটের অফার নিন`,
                        b.free_item_text
                          ? `Choose ${b.min_quantity} packet offer with ${b.free_item_text}`
                          : `Choose ${b.min_quantity} packet offer`
                      )}
                    >
                      {isActive && <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-sm animate-pulse">{t('সক্রিয়', 'ACTIVE')}</span>}
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-orange-100 px-2 text-xs font-black text-orange-900 ring-1 ring-orange-200">{b.min_quantity}×</span>
                        <span className="text-xs sm:text-sm font-black text-gray-950">{t('প্যাকেট', 'PACKETS')}</span>
                        {discountPct > 0 && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-800">-{discountPct}%</span>}
                      </div>
                      {b.free_item_text && (
                        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] font-extrabold text-emerald-800">
                          🎁 {b.free_item_text}
                        </div>
                      )}
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg sm:text-xl font-black text-emerald-700">{formatPrice(offerTotal)}</span>
                            <span className="text-[10px] font-bold text-gray-500">{t('মোট', 'TOTAL')}</span>
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold text-gray-500">
                            {formatPrice(b.unit_price)} {t('প্রতি প্যাকেট', 'per pack')}
                          </div>
                        </div>
                        <div className="rounded-lg bg-yellow-100 px-2 py-1 text-right ring-1 ring-yellow-200">
                          <span className="block text-[9px] font-black uppercase text-orange-900">{t('সাশ্রয়', 'SAVE')}</span>
                          <span className="block text-xs font-black text-orange-800">{formatPrice(savings)}</span>
                        </div>
                      </div>
                      <div className="mt-2 border-t border-orange-100 pt-1.5 text-[10px] font-bold text-gray-400">
                        <span className="line-through">{formatPrice(normalTotal)}</span>
                        <span className="ml-2 text-emerald-700">{t('সেরা দাম অটোমেটিক প্রযোজ্য', 'Best price applied automatically')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {applicableBulk && <div className="relative mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] sm:text-xs font-black text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {t(`${applicableBulk.min_quantity} প্যাকেটের সেরা অফারটি এখন আপনার অর্ডারে প্রযোজ্য`, `Best offer for ${applicableBulk.min_quantity}+ packs is now applied to your order`)}
              </div>}
            </div>}
            <div>{inStock ? <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200"><Check className="h-3.5 w-3.5" /> {t('স্টকে এভেইলেবল আছে', 'In Stock')}{product.show_low_stock && effectiveStock <= (product.low_stock_threshold || 5) && <span className="text-red-600"> ({t(`মাত্র ${effectiveStock} টি বাকি!`, `Only ${effectiveStock} left!`)})</span>}</div> : <div className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">{t('স্টক শেষ হয়ে গেছে', 'Out of Stock')}</div>}</div>
            {productShortDesc && <div className="rounded-2xl bg-gray-50/90 border border-gray-200/80 p-4 text-xs sm:text-sm text-gray-700 leading-relaxed font-medium whitespace-pre-line space-y-2 shadow-2xs">{productShortDesc}</div>}
            {inStock && <div className="flex items-center gap-4 pt-1 flex-wrap"><div className="flex items-center rounded-2xl border-2 border-gray-200 bg-white p-1 shadow-2xs"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-11 w-11 rounded-xl disabled:opacity-40 flex items-center justify-center hover:bg-gray-100 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={t('কমান', 'Decrease quantity')}><Minus className="h-4 w-4" /></button><span className="w-10 text-center font-black text-sm" aria-live="polite">{quantity}</span><button type="button" disabled={quantity >= quantityLimit} onClick={() => setQuantity(Math.min(quantityLimit, quantity + 1))} className="h-11 w-11 rounded-xl disabled:opacity-40 flex items-center justify-center hover:bg-gray-100 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={t('বাড়ান', 'Increase quantity')}><Plus className="h-4 w-4" /></button></div><div className="text-xs"><span className="text-gray-400 block font-medium">{t('সর্বমোট মূল্য', 'Total Price')}</span><span className="text-lg font-black text-gray-900">{formatPrice(totalPrice)}</span></div></div>}
            {inStock ? <div className="flex flex-col sm:flex-row gap-3 pt-2"><button type="button" onClick={handleAddToCart} className="min-h-12 flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600/30 bg-emerald-50/60 py-3.5 font-extrabold text-emerald-900 hover:bg-emerald-100 transition active:scale-[.98] cursor-pointer shadow-xs text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><ShoppingCart className="h-5 w-5 text-emerald-700" /> {t('কার্টে যোগ করুন', 'Add to Cart')}</button><button type="button" onClick={handleBuyNow} className="min-h-12 flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 py-3.5 font-extrabold text-white shadow-lg shadow-emerald-700/25 hover:from-emerald-800 hover:to-emerald-900 transition active:scale-[.98] cursor-pointer text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><Zap className="h-5 w-5 fill-current text-amber-300" /> {t('এখনই অর্ডার করুন', 'Buy Now')}</button></div> : <div className="pt-2">{!notifySent ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3"><p className="font-bold text-xs text-amber-800">{t('পণ্যটি পুনরায় স্টকে এলে নোটিফিকেশন পেতে চান?', 'Want to be notified when back in stock?')}</p>{!notifyOpen ? <button type="button" onClick={() => setNotifyOpen(true)} className="min-h-11 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">{t('স্টকে এলে জানান', 'Notify me')}</button> : <div className="space-y-2"><input value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} inputMode="tel" aria-label={t('মোবাইল নম্বর', 'Mobile number')} placeholder={t('১১ ডিজিটের মোবাইল নম্বর *', '11-digit mobile number *')} className="input-bangla w-full text-xs" /><button type="button" onClick={handleNotifyMe} className="min-h-11 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">{t('নোটিফিকেশন সক্রিয় করুন', 'Activate Notification')}</button></div>}</div> : <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2"><Check className="h-4 w-4" /> {t('স্টকে আসার সাথে সাথে আপনাকে এসএমএস দিয়ে জানানো হবে।', 'You will be notified via SMS as soon as it is in stock.')}</div>}</div>}
            <div className="grid grid-cols-3 gap-2 pt-2"><div className="p-3 rounded-2xl bg-white border border-gray-200/70 text-center shadow-2xs"><Truck className="h-5 w-5 text-emerald-700 mx-auto mb-1" /><span className="text-[11px] font-bold text-gray-800 block">{t('সারাদেশে হোম ডেলিভারি', 'Home Delivery Nationwide')}</span></div><div className="p-3 rounded-2xl bg-white border border-gray-200/70 text-center shadow-2xs"><ShieldCheck className="h-5 w-5 text-emerald-700 mx-auto mb-1" /><span className="text-[11px] font-bold text-gray-800 block">{t('ক্যাশ অন ডেলিভারি', 'Cash on Delivery')}</span></div><div className="p-3 rounded-2xl bg-white border border-gray-200/70 text-center shadow-2xs"><CheckCircle2 className="h-5 w-5 text-emerald-700 mx-auto mb-1" /><span className="text-[11px] font-bold text-gray-800 block">{t('১০০% খাঁটি ও পরীক্ষিত', '100% Pure & Tested')}</span></div></div>
          </div>
        </div>
        {bundles.length > 0 && <div className="mt-12 rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6 shadow-sm"><h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2 mb-4"><Package className="h-5 w-5 text-emerald-700" /> {t('একসাথে নিলে বিশেষ ছাড় (বান্ডেল ডিল)', 'Special Bundle Deal')}</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{bundles.map((b) => <div key={b.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs gap-3"><div><p className="font-extrabold text-sm text-gray-900">{b.bundle_name}</p><p className="text-xs text-gray-500 mt-0.5">{b.quantity} {t('টি প্যাকেট বান্ডেল', 'pcs bundle')}</p><div className="mt-1 flex items-baseline gap-2"><span className="font-black text-emerald-800 text-base">{formatPrice(b.bundle_price)}</span><span className="text-xs text-gray-400 line-through font-semibold">{formatPrice(((product.regular_price || product.sale_price || 0) * b.quantity))}</span></div></div><button type="button" disabled={!inStock || b.quantity > quantityLimit} onClick={() => addBundleToCartHelper(b)} className="min-h-11 flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{t('যোগ করুন', 'Add')} <ArrowRight className="h-3.5 w-3.5" /></button></div>)}</div></div>}
        <ProductReviewShowcase reviews={reviews} label={t} />
        <div className="mt-14"><div className="flex overflow-x-auto border-b border-gray-200 gap-2 sm:gap-4 no-scrollbar" role="tablist" aria-label={t('পণ্যের তথ্য', 'Product information')}><button type="button" role="tab" aria-selected={activeTab === 'desc'} onClick={() => setActiveTab('desc')} className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${activeTab === 'desc' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'}`}><Info className="h-4 w-4" /> {t('বিস্তারিত বিবরণ', 'Description')}</button>{seedInfoFields.length > 0 && <button type="button" role="tab" aria-selected={activeTab === 'specs'} onClick={() => setActiveTab('specs')} className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${activeTab === 'specs' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'}`}><Sprout className="h-4 w-4" /> {t('বীজের জাত ও স্পেকস', 'Seed Specs')}</button>}{(product.cultivation_instructions || product.storage_instructions) && <button type="button" role="tab" aria-selected={activeTab === 'guide'} onClick={() => setActiveTab('guide')} className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${activeTab === 'guide' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'}`}><BookOpen className="h-4 w-4" /> {t('চাষ ও পরিচর্যা', 'Cultivation Guide')}</button>}<button type="button" role="tab" aria-selected={activeTab === 'reviews'} onClick={() => setActiveTab('reviews')} className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${activeTab === 'reviews' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'}`}><Star className="h-4 w-4" /> {t('রিভিউ', 'Reviews')} ({reviews.length})</button>{faqs.length > 0 && <button type="button" role="tab" aria-selected={activeTab === 'faqs'} onClick={() => setActiveTab('faqs')} className={`flex items-center gap-2 pb-3.5 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap px-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${activeTab === 'faqs' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-900'}`}><HelpCircle className="h-4 w-4" /> {t('সাধারণ জিজ্ঞাসা', 'FAQ')}</button>}</div>
          <div className="mt-4 rounded-3xl border border-gray-200/80 bg-white p-5 shadow-2xs sm:p-8" role="tabpanel">
            {activeTab === 'desc' && <div className="space-y-6">{productDesc && <div><h3 className="mb-3 text-base font-black text-gray-900 sm:text-lg">{t('পণ্যের বিবরণ', 'Product Description')}</h3><p className="whitespace-pre-line break-words text-sm font-normal leading-relaxed text-gray-600 sm:text-base">{productDesc}</p></div>}</div>}
            {activeTab === 'specs' && <div><h3 className="mb-4 text-base font-black text-gray-900 sm:text-lg">{t('বীজ সম্পর্কিত তথ্যাবলী', 'Seed Specifications')}</h3><div className="overflow-x-auto rounded-2xl border border-gray-200"><table className="w-full text-xs sm:text-sm"><tbody className="divide-y divide-gray-200">{seedInfoFields.map((field, idx) => <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50/70' : 'bg-white'}><td className="w-1/3 px-4 py-3 font-bold text-gray-700">{field.label}</td><td className="px-4 py-3 text-gray-600 font-medium">{field.value}</td></tr>)}</tbody></table></div></div>}
            {activeTab === 'guide' && <div className="space-y-6">{product.cultivation_instructions && <div className="rounded-2xl bg-emerald-50/60 border border-emerald-200/80 p-5"><h3 className="text-base font-black text-emerald-950 mb-2 flex items-center gap-2"><Sprout className="h-5 w-5 text-emerald-700" /> {t('চাষ ও রোপণ পদ্ধতি', 'Cultivation Method')}</h3><p className="whitespace-pre-line text-xs sm:text-sm text-emerald-900 leading-relaxed break-words">{tDb(translated.cultivation_instructions || product.cultivation_instructions)}</p></div>}{product.storage_instructions && <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5"><h3 className="text-sm font-bold text-gray-900 mb-2">{t('সংরক্ষণ পদ্ধতি', 'Storage Method')}</h3><p className="text-xs sm:text-sm text-gray-600 leading-relaxed break-words">{tDb(translated.storage_instructions || product.storage_instructions)}</p></div>}</div>}
            {activeTab === 'reviews' && <div className="space-y-6"><div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl bg-gray-50 border border-gray-200/80 p-5"><div className="text-center sm:border-r sm:border-gray-200 sm:pr-8"><p className="text-4xl font-black text-emerald-800">{avgRating || '০.০'}</p><div className="mt-1 flex justify-center gap-0.5 text-amber-400">{[1,2,3,4,5].map((s) => <Star key={s} className={`h-4 w-4 ${Number(avgRating) >= s ? 'fill-current' : 'text-gray-300'}`} />)}</div><p className="mt-1 text-xs text-gray-500 font-medium">{reviews.length} {t('টি রেটিং', 'Ratings')}</p></div><div className="flex-1 w-full"><ReviewForm productId={product.id} productName={productName} user={currentUser} isVerifiedPurchase={isVerifiedPurchase} onSubmitted={() => getReviews(product.id).then(setReviews)} /></div></div>{reviews.length > 0 ? <div className="space-y-3 pt-2">{reviews.map((r) => <div key={r.id} className="rounded-2xl border border-gray-200 p-4 space-y-2 bg-white"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800 shrink-0">{r.customer_name?.charAt(0).toUpperCase()}</div><div><span className="font-bold text-xs sm:text-sm text-gray-900 block">{r.customer_name}</span>{r.verified_purchase && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><Check className="h-3 w-3" /> {t('ভেরিফায়েড ক্রেতা', 'Verified Buyer')}</span>}</div></div><div className="flex gap-0.5 text-amber-400">{[1,2,3,4,5].map((s) => <Star key={s} className={`h-3.5 w-3.5 ${r.rating >= s ? 'fill-current' : 'text-gray-200'}`} />)}</div></div><p className="text-xs sm:text-sm text-gray-600 break-words">{r.review}</p>{r.photo && <img src={r.photo} alt="Customer review" className="mt-2 h-20 w-20 rounded-xl border border-gray-200 object-cover" />}{r.admin_reply && <div className="mt-2 rounded-xl border-l-4 border-emerald-600 bg-emerald-50/50 p-3 text-xs"><p className="font-bold text-emerald-900">GAZI SEED {t('অ্যাডমিন রিপ্লাই:', 'Admin Reply:')}</p><p className="mt-0.5 text-emerald-800 break-words">{r.admin_reply}</p></div>}</div>)}</div> : <p className="text-center text-xs sm:text-sm text-gray-400 py-6">{t('এখনো কোনো রিভিউ দেওয়া হয়নি। প্রথম রিভিউটি আপনিই দিন!', 'No reviews yet. Be the first to review!')}</p>}</div>}
            {activeTab === 'faqs' && <div className="space-y-3">{faqs.map((f, idx) => <div key={f.id} className="rounded-2xl border border-gray-200 bg-white"><button type="button" onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)} aria-expanded={openFaqIdx === idx} className="flex min-h-12 w-full items-center justify-between p-4 text-left font-bold text-xs sm:text-sm text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"><span className="break-words pr-3">{lang === 'en' && f.question_en ? f.question_en : f.question_bn}</span><ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${openFaqIdx === idx ? 'rotate-180 text-emerald-700' : ''}`} /></button>{openFaqIdx === idx && <div className="border-t border-gray-100 p-4 text-xs sm:text-sm text-gray-600 bg-gray-50/50 break-words">{lang === 'en' && f.answer_en ? f.answer_en : f.answer_bn}</div>}</div>)}</div>}
          </div>
        </div>
        {related.length > 0 && <div className="mt-16"><h2 className="mb-6 text-xl sm:text-2xl font-black text-gray-900">{t('এই বীজগুলোও আপনার ভালো লাগতে পারে', 'You may also like these seeds')}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div></div>}
      </div>
      {inStock && <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md px-3.5 pt-3.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl lg:hidden"><div className="max-w-md mx-auto flex items-center justify-between gap-3"><div className="min-w-0"><span className="text-[10px] text-gray-400 font-semibold block">{quantity} {t('টি পণ্যের মোট মূল্য', 'Total items price')}</span><p className="text-lg font-black text-emerald-800 truncate">{formatPrice(totalPrice)}</p></div><div className="flex gap-2 shrink-0"><button type="button" onClick={handleAddToCart} aria-label={t('কার্টে যোগ করুন', 'Add to cart')} className="min-h-12 min-w-12 p-3 rounded-xl border border-emerald-600/30 bg-emerald-50 text-emerald-900 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><ShoppingCart className="h-5 w-5 text-emerald-700" /></button><button type="button" onClick={handleBuyNow} className="min-h-12 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-800 px-5 py-3 text-xs font-extrabold text-white shadow-md shadow-emerald-700/30 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><Zap className="h-4 w-4 fill-current text-amber-300" />{t('অর্ডার করুন', 'Order Now')}</button></div></div></div>}
    </div>
  );
}

function addBundleToCartHelper(bundle: BundleOffer) {
  // helper for bundle
}
