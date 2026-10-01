-- Keep India Cashfree checkout delivery charges aligned with the
-- country-scoped delivery_charge_rules used by the rest of checkout.

create or replace function public.calculate_cashfree_checkout_quote(
  p_items jsonb,
  p_coupon_code text default null,
  p_user_id uuid default null,
  p_use_referral_wallet boolean default false,
  p_country_code text default 'IN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_country text := upper(coalesce(p_country_code, 'IN'));
  v_item record;
  v_prod record;
  v_variant record;
  v_bulk_price numeric;
  v_unit_price numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_final numeric := 0;
  v_wallet numeric := 0;
  v_coupon coupons%rowtype;
  v_free_delivery boolean := false;
  v_bundle_free boolean;
  v_max_wallet numeric := 0;
begin
  if v_country <> 'IN' then
    return jsonb_build_object('success', false, 'error', 'Cashfree online payment is available for India only');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'error', 'Cart is empty');
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_items)
      as x(product_id uuid, quantity integer, variant_id uuid, bundle_id uuid)
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      return jsonb_build_object('success', false, 'error', 'Invalid product or quantity in cart');
    end if;

    select p.id, p.stock, p.min_order_qty, p.max_order_qty,
      p.regular_price, p.sale_price, p.free_delivery
    into v_prod
    from public.products p
    where p.id = v_item.product_id
      and p.is_active = true
      and upper(p.country_code) = v_country;

    if not found then
      return jsonb_build_object('success', false, 'error', 'Product is unavailable in India');
    end if;

    v_free_delivery := v_free_delivery or coalesce(v_prod.free_delivery, false);

    if v_prod.min_order_qty is not null and v_item.quantity < v_prod.min_order_qty then
      return jsonb_build_object('success', false, 'error', 'Minimum quantity for this product is ' || v_prod.min_order_qty);
    end if;

    if v_prod.max_order_qty is not null and v_item.quantity > v_prod.max_order_qty then
      return jsonb_build_object('success', false, 'error', 'Maximum quantity for this product is ' || v_prod.max_order_qty);
    end if;

    v_unit_price := null;
    v_bulk_price := null;
    v_bundle_free := false;

    if v_item.bundle_id is not null then
      select bo.free_delivery
      into v_bundle_free
      from public.bundle_offers bo
      where bo.id = v_item.bundle_id
        and bo.product_id = v_item.product_id
        and bo.is_active = true
        and upper(bo.country_code) = v_country;

      if not found then
        return jsonb_build_object('success', false, 'error', 'Selected bundle is unavailable');
      end if;

      v_free_delivery := v_free_delivery or coalesce(v_bundle_free, false);
    end if;

    if v_item.variant_id is not null then
      select pv.regular_price, pv.sale_price, pv.stock
      into v_variant
      from public.product_variants pv
      where pv.id = v_item.variant_id
        and pv.product_id = v_item.product_id
        and pv.is_active = true;

      if not found then
        return jsonb_build_object('success', false, 'error', 'Selected variant is unavailable');
      end if;

      if v_variant.stock is null or v_variant.stock < v_item.quantity then
        return jsonb_build_object('success', false, 'error', 'Insufficient stock for selected variant');
      end if;

      v_unit_price := case
        when v_variant.sale_price is not null
          and v_variant.sale_price > 0
          and v_variant.sale_price < v_variant.regular_price
          then v_variant.sale_price
        when v_variant.regular_price is not null
          and v_variant.regular_price > 0
          then v_variant.regular_price
        else null
      end;

      select bp.unit_price into v_bulk_price
      from public.bulk_pricing bp
      where bp.product_id = v_item.product_id
        and bp.variant_id = v_item.variant_id
        and bp.is_active = true
        and upper(bp.country_code) = v_country
        and bp.min_quantity <= v_item.quantity
        and bp.unit_price > 0
      order by bp.min_quantity desc
      limit 1;
    else
      if v_prod.stock is null or v_prod.stock < v_item.quantity then
        return jsonb_build_object('success', false, 'error', 'Insufficient stock for product');
      end if;

      v_unit_price := case
        when v_prod.sale_price is not null
          and v_prod.sale_price > 0
          and v_prod.sale_price < v_prod.regular_price
          then v_prod.sale_price
        when v_prod.regular_price is not null
          and v_prod.regular_price > 0
          then v_prod.regular_price
        else null
      end;

      select bp.unit_price into v_bulk_price
      from public.bulk_pricing bp
      where bp.product_id = v_item.product_id
        and bp.variant_id is null
        and bp.is_active = true
        and upper(bp.country_code) = v_country
        and bp.min_quantity <= v_item.quantity
        and bp.unit_price > 0
      order by bp.min_quantity desc
      limit 1;
    end if;

    v_unit_price := coalesce(v_bulk_price, v_unit_price);

    if v_unit_price is null or v_unit_price <= 0 then
      return jsonb_build_object('success', false, 'error', 'Product has no valid selling price');
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_item.quantity);
  end loop;

  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select * into v_coupon
    from public.coupons c
    where upper(c.code) = upper(btrim(p_coupon_code))
      and c.is_active = true
      and upper(c.country_code) = v_country;

    if not found then
      return jsonb_build_object('success', false, 'error', 'Invalid or inactive coupon');
    end if;

    if v_coupon.start_date is not null and v_coupon.start_date > now() then
      return jsonb_build_object('success', false, 'error', 'Coupon is not active yet');
    end if;

    if v_coupon.expiry_date is not null and v_coupon.expiry_date < now() then
      return jsonb_build_object('success', false, 'error', 'Coupon has expired');
    end if;

    if v_coupon.min_order is not null and v_subtotal < v_coupon.min_order then
      return jsonb_build_object('success', false, 'error', 'Minimum order amount for coupon is ' || v_coupon.min_order);
    end if;

    if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then
      return jsonb_build_object('success', false, 'error', 'Coupon usage limit reached');
    end if;

    if lower(v_coupon.type) = 'percentage' then
      v_discount := v_subtotal * (coalesce(v_coupon.value, 0) / 100);
      if v_coupon.max_discount is not null then
        v_discount := least(v_discount, v_coupon.max_discount);
      end if;
    else
      v_discount := coalesce(v_coupon.value, 0);
    end if;

    v_discount := greatest(0, least(v_discount, v_subtotal));
  end if;

  -- Use the same country-scoped delivery rules as the regular checkout.
  v_delivery := case
    when coalesce(v_free_delivery, false) then 0
    else coalesce((
      select case
        when coalesce(dcr.is_free, false) then 0
        else greatest(coalesce(dcr.charge, 0), 0)
      end
      from public.delivery_charge_rules dcr
      where upper(dcr.country_code) = v_country
        and dcr.is_active = true
        and coalesce(v_subtotal, 0) >= coalesce(dcr.min_order, 0)
        and (
          dcr.max_order is null
          or coalesce(v_subtotal, 0) <= dcr.max_order
        )
      order by
        case when dcr.max_order is null then 0 else 1 end,
        coalesce(dcr.min_order, 0) desc,
        dcr.display_order asc
      limit 1
    ), 0)
  end;

  v_final := greatest(0, v_subtotal - v_discount + v_delivery);

  if p_use_referral_wallet and p_user_id is not null then
    v_max_wallet := public.get_referral_wallet_max_usage(p_user_id, v_final);
    v_wallet := least(greatest(coalesce(v_max_wallet, 0), 0), v_final);
  end if;

  v_final := greatest(0, v_final - v_wallet);

  return jsonb_build_object(
    'success', true,
    'country_code', v_country,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'delivery_charge', v_delivery,
    'wallet_credit_used', v_wallet,
    'final_amount', v_final,
    'currency', 'INR'
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;
