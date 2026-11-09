-- Security hardening after the review of 2026-10-30. Rules the app already enforces in Zod are enforced here as
-- well, because every signed-in user can also write to the API directly with their own session.
-- New constraints are NOT VALID: they apply to every new or changed row without re-checking the existing data.

-- ---------------------------------------------------------------------------
-- 1. Listings: only http(s) links. The URL is rendered as a link; "javascript:" or other schemes must never be
--    stored, whichever route writes them.
-- ---------------------------------------------------------------------------

alter table public.listings
  add constraint listings_url_http check (url = '' or url ~* '^https?://') not valid;

-- ---------------------------------------------------------------------------
-- 2. Money: 'NaN' is a valid numeric in PostgreSQL and passes ">= 0" (NaN sorts above every number). A NaN price
--    would flow into sales and invoices and break their totals. An upper bound rejects it; 9999999999.99 is the
--    largest numeric(12,2).
-- ---------------------------------------------------------------------------

alter table public.products
  add constraint products_buy_price_range check (buy_price between 0 and 9999999999.99) not valid,
  add constraint products_sell_price_range check (sell_price between 0 and 9999999999.99) not valid;

alter table public.listings
  add constraint listings_price_range check (price between 0 and 9999999999.99) not valid;

alter table public.goods_receipt_items
  add constraint goods_receipt_items_unit_cost_range check (unit_cost between 0 and 9999999999.99) not valid;

-- ---------------------------------------------------------------------------
-- 3. Customers and suppliers: users may write only the business columns. Without column grants a seller could
--    insert a customer with a chosen id (e.g. the next CUS-…), so later inserts would fail on a duplicate key,
--    or set created_at. Ids and timestamps come from the defaults and the updated_at trigger.
-- ---------------------------------------------------------------------------

revoke insert, update on public.customers from authenticated;
grant insert (customer_type, name, jib, pdv_number, phone, email, address, city, notes)
  on public.customers to authenticated;
grant update (customer_type, name, jib, pdv_number, phone, email, address, city, notes)
  on public.customers to authenticated;

revoke insert, update on public.suppliers from authenticated;
grant insert (name, jib, pdv_number, address, city, phone, email, note) on public.suppliers to authenticated;
grant update (name, jib, pdv_number, address, city, phone, email, note) on public.suppliers to authenticated;
