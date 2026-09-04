import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_checkout_order', {
      p_country: input.country,
      p_items: input.items,
      p_customer: input.customer,
      p_coupon_code: input.couponCode ?? null,
      p_shipping_fee: input.shippingFee ?? 0,
      p_payment_method: input.paymentMethod ?? 'cod',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Order creation failed' },
      { status: 400 },
    );
  }
}
