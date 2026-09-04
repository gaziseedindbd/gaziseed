import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CountryCode } from '@/lib/seed-bari/domain';

function isCountryCode(value: unknown): value is CountryCode {
  return value === 'BD' || value === 'IN';
}

export async function POST(request: Request) {
  try {
    const input = await request.json();

    if (!isCountryCode(input?.country)) {
      return NextResponse.json({ error: 'Invalid store country' }, { status: 400 });
    }

    if (!Array.isArray(input?.items) || input.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

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
