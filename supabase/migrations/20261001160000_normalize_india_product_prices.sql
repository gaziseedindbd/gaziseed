-- Normalize the legacy base price field for active India products.
-- Checkout already resolves sell price from sale_price/regular_price; this keeps
-- the catalog-facing price field consistent for India launch and admin views.

update public.products
set price = case
  when sale_price is not null
    and sale_price > 0
    and regular_price is not null
    and sale_price < regular_price
    then sale_price
  when regular_price is not null
    and regular_price > 0
    then regular_price
  else price
end
where upper(country_code) = 'IN'
  and is_active = true
  and coalesce(price, 0) <= 0
  and (
    (sale_price is not null and sale_price > 0)
    or (regular_price is not null and regular_price > 0)
  );
