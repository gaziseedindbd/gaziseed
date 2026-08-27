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
    const module = body.module as keyof AIFeatureFlags;
    const prompt = String(body.prompt || '').trim();

    if (!module || !(module in MODULES)) {
      return NextResponse.json({ success: false, message: 'Invalid AI module' }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });

    const { data: settings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('is_enabled,provider,api_key,model,base_url,temperature,max_tokens,feature_flags')
      .eq('id', 1)
      .maybeSingle();

    if (settingsError || !settings) return NextResponse.json({ success: false, message: 'AI settings not configured' }, { status: 400 });
    const ai = settings as AISettings;
    const flags = (ai.feature_flags || {}) as AIFeatureFlags;
    if (!ai.is_enabled) return NextResponse.json({ success: false, message: 'AI System is OFF' }, { status: 403 });
    if (!flags[module]) return NextResponse.json({ success: false, message: `${MODULES[module]} is OFF in AI Settings` }, { status: 403 });
    if (!ai.api_key) return NextResponse.json({ success: false, message: 'AI API key is not configured' }, { status: 400 });

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    let context: Record<string, unknown> = {};

    if (module === 'business_analysis' || module === 'sales_analysis' || module === 'marketing_assistant' || module === 'ads_assistant') {
      const [orders, products] = await Promise.all([
        supabase.from('orders').select('id,order_number,customer_name,order_source,grand_total,status,created_at').gte('created_at', sinceIso).order('created_at', { ascending: false }).limit(500),
        supabase.from('products').select('id,name_bn,name_en,stock,low_stock_threshold,price,sale_price,is_active').limit(500),
      ]);
      const orderRows = orders.data || [];
      const completed = orderRows.filter((o: any) => !['cancelled','rejected'].includes(o.status));
      const revenue = completed.reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0);
      const bySource: Record<string, { orders: number; revenue: number }> = {};
      for (const o of completed) {
        const key = o.order_source || 'unknown';
        bySource[key] ||= { orders: 0, revenue: 0 };
        bySource[key].orders += 1;
        bySource[key].revenue += Number(o.grand_total || 0);
      }
      context = {
        period: 'last 30 days',
        total_orders: orderRows.length,
        valid_orders: completed.length,
        revenue,
        average_order_value: completed.length ? revenue / completed.length : 0,
        order_sources: bySource,
        products: products.data || [],
      };
    } else if (module === 'inventory_assistant') {
      const { data } = await supabase.from('products').select('id,name_bn,name_en,stock,low_stock_threshold,price,sale_price,is_active').order('stock', { ascending: true }).limit(500);
      context = { products: data || [], note: 'Use the stored stock and low_stock_threshold fields. Do not invent stock levels.' };
    } else if (module === 'customer_support_ai' || module === 'seed_expert') {
      const { data } = await supabase.from('products').select('id,name_bn,name_en,short_description_bn,description_bn,description_en,price,sale_price,stock,is_active').eq('is_active', true).limit(300);
      context = { products: data || [] };
    } else if (module === 'seo_aeo_assistant') {
      const productId = String(body.product_id || '').trim();
      if (productId) {
        const { data } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
        context = { product: data || null };
      } else {
        const { data } = await supabase.from('products').select('id,name_bn,name_en,short_description_bn,description_bn,description_en,price,sale_price').eq('is_active', true).limit(100);
        context = { products: data || [] };
      }
    }

    const system = `You are the SEED BARI AI ${MODULES[module]}. Use only the supplied SEED BARI data for business facts. Never invent sales, stock, orders, customer details, ad spend, ROAS, or product claims. If required data is missing, say so clearly. Give practical, concise recommendations. For Seed Expert, distinguish general educational guidance from professional agronomic advice.`;
    const user = `${prompt || `Perform a ${MODULES[module]} analysis for SEED BARI.`}\n\nDATA:\n${compact(context)}`;
    const adapter = getAdapter(ai.provider);
    const result = await adapter.chat({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: ai.temperature ?? undefined, max_tokens: ai.max_tokens ?? undefined }, ai);

    return NextResponse.json({ success: true, module, result: result.content, model: result.model });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'AI module failed' }, { status: 500 });
  }
}
