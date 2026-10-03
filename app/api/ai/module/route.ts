import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getAdapter } from '@/lib/ai/adapters';
import type { AIFeatureFlags, AISettings } from '@/lib/ai/types';

const MODULES: Record<keyof AIFeatureFlags, string> = {
  business_analysis: 'Business Analysis',
  sales_analysis: 'Sales Analysis',
  inventory_assistant: 'Inventory Assistant',
  marketing_assistant: 'Marketing Assistant',
  ads_assistant: 'Facebook/Instagram Ads Assistant',
  customer_support_ai: 'Customer Support AI',
  seed_expert: 'Seed Expert',
  seo_aeo_assistant: 'SEO/AEO Assistant',
};

function compact(value: unknown, max = 12000) {
  const text = JSON.stringify(value);
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const moduleName = body.module as keyof AIFeatureFlags;
    const prompt = String(body.prompt || '').trim();

    if (!moduleName || !(moduleName in MODULES)) {
      return NextResponse.json({ success: false, message: 'Invalid AI module' }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });

    const { data: adminRow, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', auth.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (adminError) return NextResponse.json({ success: false, message: 'Admin access verification failed' }, { status: 500 });
    if (!adminRow) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });

    const { data: countryData, error: countryError } = await supabase.rpc('current_admin_country');
    if (countryError) return NextResponse.json({ success: false, message: 'Admin branch could not be resolved' }, { status: 500 });

    const countryCode = String(countryData || '').toUpperCase();
    if (!['BD', 'IN'].includes(countryCode)) {
      return NextResponse.json({ success: false, message: 'Invalid admin branch' }, { status: 403 });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('is_enabled,provider,api_key,model,base_url,temperature,max_tokens,feature_flags,country_code')
      .eq('id', 1)
      .eq('country_code', countryCode)
      .maybeSingle();

    if (settingsError || !settings) return NextResponse.json({ success: false, message: 'AI settings are not configured for this branch' }, { status: 400 });
    const ai = settings as AISettings;
    const flags = (ai.feature_flags || {}) as AIFeatureFlags;
    if (!ai.is_enabled) return NextResponse.json({ success: false, message: 'AI System is OFF' }, { status: 403 });
    if (!flags[moduleName]) return NextResponse.json({ success: false, message: `${MODULES[moduleName]} is OFF in AI Settings` }, { status: 403 });
    if (!ai.api_key) return NextResponse.json({ success: false, message: 'AI API key is not configured' }, { status: 400 });

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    let context: Record<string, unknown> = {};

    if (moduleName === 'business_analysis' || moduleName === 'sales_analysis' || moduleName === 'marketing_assistant' || moduleName === 'ads_assistant') {
      const [orders, products, orderItems] = await Promise.all([
        supabase.from('orders').select('id,order_number,customer_name,order_source,grand_total,status,created_at').eq('country_code', countryCode).gte('created_at', sinceIso).order('created_at', { ascending: false }).limit(500),
        supabase.from('products').select('id,name_bn,name_en,stock,low_stock_threshold,price,sale_price,is_active').eq('country_code', countryCode).limit(500),
        supabase.from('order_items').select('order_id,product_id,product_name,quantity,unit_price,total_price,created_at').eq('country_code', countryCode).gte('created_at', sinceIso).limit(2000),
      ]);
      if (orders.error || products.error || orderItems.error) {
        return NextResponse.json({ success: false, message: 'AI analytics data could not be loaded' }, { status: 500 });
      }
      const orderRows = orders.data || [];
      const completed = orderRows.filter((o: any) => !['cancelled', 'rejected'].includes(o.status));
      const revenue = completed.reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0);
      const bySource: Record<string, { orders: number; revenue: number }> = {};
      for (const o of completed) {
        const key = o.order_source || 'unknown';
        bySource[key] ||= { orders: 0, revenue: 0 };
        bySource[key].orders += 1;
        bySource[key].revenue += Number(o.grand_total || 0);
      }
      const salesByProduct: Record<string, { product_id: string | null; product_name: string; quantity: number; revenue: number }> = {};
      for (const item of orderItems.data || []) {
        const key = String(item.product_id || item.product_name || 'unknown');
        salesByProduct[key] ||= { product_id: item.product_id || null, product_name: item.product_name || 'Unknown product', quantity: 0, revenue: 0 };
        salesByProduct[key].quantity += Number(item.quantity || 0);
        salesByProduct[key].revenue += Number(item.total_price || 0);
      }
      context = {
        branch: countryCode,
        period: 'last 30 days',
        total_orders: orderRows.length,
        valid_orders: completed.length,
        revenue,
        average_order_value: completed.length ? revenue / completed.length : 0,
        order_sources: bySource,
        sales_by_product: Object.values(salesByProduct).sort((a, b) => b.revenue - a.revenue),
        products: products.data || [],
        data_notes: [
          'Revenue is based on non-cancelled/non-rejected orders and may include unpaid/pending orders.',
          'Ads metrics, actual ad spend, ROAS and GA4 attribution are not included unless explicitly supplied by a connected data source.',
        ],
      };
    } else if (moduleName === 'inventory_assistant') {
      const [productsRes, itemsRes] = await Promise.all([
        supabase.from('products').select('id,name_bn,name_en,stock,low_stock_threshold,price,sale_price,is_active').eq('country_code', countryCode).order('stock', { ascending: true }).limit(500),
        supabase.from('order_items').select('product_id,product_name,quantity,created_at').eq('country_code', countryCode).gte('created_at', sinceIso).limit(2000),
      ]);
      if (productsRes.error || itemsRes.error) {
        return NextResponse.json({ success: false, message: 'Inventory analytics data could not be loaded' }, { status: 500 });
      }
      const salesVelocity: Record<string, { product_id: string | null; product_name: string; units_30d: number }> = {};
      for (const item of itemsRes.data || []) {
        const key = String(item.product_id || item.product_name || 'unknown');
        salesVelocity[key] ||= { product_id: item.product_id || null, product_name: item.product_name || 'Unknown product', units_30d: 0 };
        salesVelocity[key].units_30d += Number(item.quantity || 0);
      }
      context = {
        branch: countryCode,
        products: productsRes.data || [],
        sales_velocity_30d: Object.values(salesVelocity).sort((a, b) => b.units_30d - a.units_30d),
        note: 'Use stored stock, low_stock_threshold and observed 30-day order-item volume. Do not invent stock levels, supplier lead times or purchase data.',
      };
    } else if (moduleName === 'customer_support_ai' || moduleName === 'seed_expert') {
      const { data, error } = await supabase.from('products').select('id,name_bn,name_en,short_description_bn,description_bn,description_en,price,sale_price,stock,is_active').eq('country_code', countryCode).eq('is_active', true).limit(300);
      if (error) return NextResponse.json({ success: false, message: 'Product knowledge data could not be loaded' }, { status: 500 });
      context = { branch: countryCode, products: data || [] };
    } else if (moduleName === 'seo_aeo_assistant') {
      const productId = String(body.product_id || '').trim();
      if (productId) {
        const { data, error } = await supabase.from('products').select('*').eq('id', productId).eq('country_code', countryCode).maybeSingle();
        if (error) return NextResponse.json({ success: false, message: 'Product data could not be loaded' }, { status: 500 });
        context = { branch: countryCode, product: data || null };
      } else {
        const { data, error } = await supabase.from('products').select('id,name_bn,name_en,short_description_bn,description_bn,description_en,price,sale_price').eq('country_code', countryCode).eq('is_active', true).limit(100);
        if (error) return NextResponse.json({ success: false, message: 'SEO/AEO product data could not be loaded' }, { status: 500 });
        context = { branch: countryCode, products: data || [] };
      }
    }

    const system = `You are the SEED BARI AI ${MODULES[moduleName]} for the ${countryCode} branch. Use only the supplied SEED BARI data for business facts. Never invent sales, stock, orders, customer details, ad spend, ROAS, or product claims. If required data is missing, say so clearly. Give practical, concise recommendations. For Seed Expert, distinguish general educational guidance from professional agronomic advice. Keep branch data isolated: never infer or mix data from another country/branch.`;
    const user = `${prompt || `Perform a ${MODULES[moduleName]} analysis for SEED BARI.`}\n\nDATA:\n${compact(context)}`;
    const adapter = getAdapter(ai.provider);
    const result = await adapter.chat({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: ai.temperature ?? undefined, max_tokens: ai.max_tokens ?? undefined }, ai);

    return NextResponse.json({ success: true, module: moduleName, result: result.content, model: result.model });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'AI module failed' }, { status: 500 });
  }
}
