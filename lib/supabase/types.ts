export type Category = {
  id: string;
  name_bn: string;
  name_en: string;
  slug: string;
  description: string;
  image: string;
  banner: string;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
  seo_title: string;
  meta_description: string;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  name_bn: string;
  name_en: string;
  slug: string;
  sku: string;
  category_id: string | null;
  short_description: string;
  description: string;
  regular_price: number;
  sale_price: number | null;
  stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  is_seasonal: boolean;
  image: string;
  images: string[];
  video_url: string;
  seed_type: string;
  variety: string;
  brand: string;
  origin: string;
  season: string;
  planting_season: string;
  germination_time: string;
  germination_rate: string;
  harvest_time: string;
  plant_spacing: string;
  planting_depth: string;
  sunlight: string;
  water_requirement: string;
  soil_type: string;
  growing_location: string;
  packet_weight: string;
  seed_quantity: string;
  expected_yield: string;
  cultivation_instructions: string;
  storage_instructions: string;
  features: string[];
  benefits: string[];
  seo_title: string;
  meta_description: string;
  is_ads_only: boolean;
  related_product_ids: string[];
  image_alt: string;
  image_alt_bn: string;
  min_order_qty: number | null;
  max_order_qty: number | null;
  suitable_months: string[];
  growing_type: string;
  season_tags: string[];
  cost_price: number | null;
  show_low_stock: boolean;
  created_at: string;
  updated_at: string;
};

export type BundleOffer = {
  id: string;
  product_id: string;
  bundle_name: string;
  quantity: number;
  bundle_price: number;
  compare_price: number | null;
  savings: string;
  badge: string;
  free_delivery: boolean;
  display_order: number;
  is_active: boolean;
  is_default_selected: boolean;
  custom_delivery_charge: number | null;
  created_at: string;
  updated_at: string;
};

export type LandingPage = {
  id: string;
  product_id: string;
  is_enabled: boolean;
  title: string;
  subtitle: string;
  images: string[];
  video_url: string;
  compare_price: number | null;
  offer_price: number | null;
  benefits: string[];
  features: string[];
  description: string;
  growing_guide: string;
  trust_text: string;
  cod_text: string;
  delivery_text: string;
  faq: { q: string; a: string }[];
  cta_text: string;
  section_visibility: Record<string, boolean>;
  landing_name: string;
  landing_slug: string;
  status: string;
  seo_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
  og_image: string;
  section_order: string[];
  offer_headline: string;
  offer_badge: string;
  discount_label: string;
  created_at: string;
  updated_at: string;
};

export type LandingReview = {
  id: string;
  landing_page_id: string;
  customer_name: string;
  rating: number;
  review: string;
  customer_image: string;
  review_image: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type LandingFaq = {
  id: string;
  landing_page_id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type QuantityOffer = {
  id: string;
  landing_page_id: string;
  product_id: string;
  quantity: number;
  offer_price: number;
  compare_price: number | null;
  badge: string;
  free_delivery: boolean;
  custom_delivery_charge: number | null;
  is_default_selected: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type LandingPageView = {
  id: string;
  landing_page_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  gclid: string;
  created_at: string;
};

export type DeliveryZone = {
  id: string;
  zone_name: string;
  charge: number;
  estimated_time: string;
  cod_enabled: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string;
  delivery_zone_id: string | null;
  delivery_zone_name: string;
  delivery_charge: number;
  special_instructions: string;
  subtotal: number;
  discount: number;
  grand_total: number;
  payment_method: string;
  order_source: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  gclid: string;
  status: string;
  internal_notes: string;
  coupon_code: string;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  bundle_id: string | null;
  bundle_name: string;
  image: string;
  variant_id: string | null;
  variant_name: string | null;
  is_free_gift: boolean;
  promotion_id: string | null;
  cost_price: number | null;
  created_at: string;
};

export type OrderStatusHistory = {
  id: string;
  order_id: string;
  status: string;
  note: string;
  created_at: string;
};

export type CustomerAddress = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address: string;
  delivery_zone_id: string | null;
  is_default: boolean;
  label: string;
  division: string;
  district: string;
  thana: string;
  postal_code: string;
  created_at: string;
  updated_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  min_order: number;
  max_discount: number | null;
  start_date: string;
  expiry_date: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Review = {
  id: string;
  product_id: string;
  customer_name: string;
  rating: number;
  review: string;
  photo: string;
  is_approved: boolean;
  is_featured: boolean;
  admin_reply: string | null;
  verified_purchase: boolean;
  user_id: string | null;
  status: string;
  created_at: string;
};

export type Testimonial = {
  id: string;
  customer_name: string;
  image: string;
  review: string;
  rating: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type Service = {
  id: string;
  title: string;
  short_description: string;
  full_description: string;
  icon: string;
  image: string;
  cta_text: string;
  cta_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Banner = {
  id: string;
  desktop_image: string;
  mobile_image: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_url: string;
  display_order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  featured_image: string;
  content: string;
  category: string;
  seo_title: string;
  meta_description: string;
  is_published: boolean;
  publish_date: string;
  created_at: string;
  updated_at: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  is_read: boolean;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export type Page = {
  id: string;
  title: string;
  slug: string;
  content: string;
  seo_title: string;
  meta_description: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type Navigation = {
  id: string;
  title: string;
  url: string;
  display_order: number;
  is_active: boolean;
  parent_id: string | null;
  created_at: string;
};

export type Announcement = {
  id: string;
  message: string;
  link: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type SiteSettings = {
  id: number;
  website_name: string;
  logo: string;
  favicon: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  business_hours: string;
  currency: string;
  currency_symbol: string;
  facebook: string;
  instagram: string;
  youtube: string;
  tiktok: string;
  whatsapp_enabled: boolean;
  whatsapp_message: string;
  enable_variants: boolean;
  enable_bulk_pricing: boolean;
  enable_seasonal_finder: boolean;
  enable_recently_viewed: boolean;
  enable_wishlist: boolean;
  enable_coupons: boolean;
  enable_order_again: boolean;
  enable_support_tickets: boolean;
  enable_low_stock_msg: boolean;
  enable_reward_points: boolean;
  enable_referral: boolean;
  enable_abandoned_checkout: boolean;
  duplicate_order_hours: number;
  homepage_theme: string;
  created_at: string;
  updated_at: string;
};

export type MarketingSettings = {
  id: number;
  meta_pixel_id: string;
  ga4_measurement_id: string;
  gtm_id: string;
  tiktok_pixel_id: string;
  created_at: string;
  updated_at: string;
};

export type HomepageSection = {
  id: string;
  section_key: string;
  title: string;
  subtitle: string;
  is_enabled: boolean;
  display_order: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  created_at: string;
};

export type InventoryHistory = {
  id: string;
  product_id: string;
  quantity_change: number;
  reason: string;
  created_at: string;
};

export type AdminUser = {
  id: string;
  user_id: string;
  email: string;
  is_active: boolean;
  role: string;
  last_login_at: string | null;
  created_at: string;
};

export type ComboPack = {
  id: string;
  name_bn: string;
  name_en: string;
  slug: string;
  description_bn: string;
  description_en: string;
  images: string[];
  regular_total: number;
  combo_price: number;
  is_active: boolean;
  seo_title: string;
  meta_description: string;
  og_image: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type ComboItem = {
  id: string;
  combo_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
};

export type Promotion = {
  id: string;
  name: string;
  is_active: boolean;
  min_quantity: number;
  min_amount: number;
  eligibility: string;
  eligible_product_ids: string[];
  eligible_category_ids: string[];
  gift_mode: string;
  free_quantity: number;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  usage_count: number;
  one_per_order: boolean;
  can_combine: boolean;
  created_at: string;
  updated_at: string;
};

export type PromotionGift = {
  id: string;
  promotion_id: string;
  product_id: string;
  created_at: string;
};

export type ProductBatch = {
  id: string;
  product_id: string;
  batch_number: string;
  lot_number: string;
  supplier: string;
  received_date: string;
  packing_date: string;
  best_before: string;
  expiry_date: string;
  batch_stock: number;
  cost_price: number | null;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type StockNotification = {
  id: string;
  product_id: string;
  phone: string;
  email: string;
  status: string;
  notified_at: string | null;
  created_at: string;
};

export type ProductFaq = {
  id: string;
  product_id: string;
  question_bn: string;
  answer_bn: string;
  question_en: string;
  answer_en: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  regular_price: number;
  sale_price: number | null;
  stock: number;
  weight_or_count: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type BulkPricing = {
  id: string;
  product_id: string;
  variant_id: string | null;
  min_quantity: number;
  unit_price: number;
  is_active: boolean;
  created_at: string;
};

export type Wishlist = {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
};

export type SupportTicket = {
  id: string;
  ticket_id: string;
  user_id: string | null;
  order_id: string | null;
  order_number: string | null;
  product_id: string | null;
  product_name: string | null;
  issue_type: string;
  description: string;
  photo_url: string | null;
  preferred_resolution: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SupportTicketReply = {
  id: string;
  ticket_id: string;
  reply_by: string | null;
  reply_by_role: string;
  message: string;
  created_at: string;
};

export type CustomerTag = {
  id: string;
  user_id: string;
  tag: string;
  is_auto: boolean;
  created_at: string;
};

export type PromotionalPopup = {
  id: string;
  title: string;
  description: string;
  image: string;
  offer: string;
  cta_text: string;
  cta_link: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  show_on_main: boolean;
  show_on_offers: boolean;
  show_close_button: boolean;
  auto_close: boolean;
  auto_close_seconds: number;
  display_frequency: string;
  created_at: string;
  updated_at: string;
};

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  link: string;
  is_read: boolean;
  created_at: string;
};
