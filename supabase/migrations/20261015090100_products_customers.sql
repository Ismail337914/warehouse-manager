-- Phase 3: product barcode, VAT and reserved stock; customer type with JIB and PDV number.

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

alter table public.products
  add column barcode text check (barcode is null or barcode ~ '^[0-9A-Za-z-]{4,64}$'),
  add column vat_rate numeric(5, 2) not null default private.default_vat_rate()
    check (vat_rate between 0 and 100),
  -- Reserved by confirmed orders. Available = on hand − reserved, and it can never go below zero.
  add column reserved_quantity integer not null default 0,
  add constraint products_reserved_quantity_check
    check (reserved_quantity >= 0 and reserved_quantity <= quantity),
  add column available_quantity integer generated always as (quantity - reserved_quantity) stored;

create unique index products_barcode_key on public.products (barcode) where barcode is not null;

comment on column public.products.buy_price is 'Nabavna cijena bez PDV-a';
comment on column public.products.sell_price is 'Prodajna cijena bez PDV-a';

-- New columns editable by managers; stock and reservations still change only through RPC functions.
grant insert (barcode, vat_rate) on public.products to authenticated;
grant update (barcode, vat_rate) on public.products to authenticated;

create or replace view public.low_stock_products
with (security_invoker = true)
as
select p.id, p.sku, p.name, c.name as category, p.quantity, p.min_quantity, p.unit, p.location,
  p.reserved_quantity, p.available_quantity
from public.products as p
join public.categories as c on c.id = p.category_id
where p.quantity <= p.min_quantity;

-- ---------------------------------------------------------------------------
-- Customers: natural persons and companies
-- ---------------------------------------------------------------------------

create type public.customer_type as enum ('fizicko', 'pravno');

alter table public.customers
  add column customer_type public.customer_type not null default 'fizicko',
  -- JIB: 13-digit identification number of a company in BiH.
  add column jib text check (jib ~ '^\d{13}$'),
  -- PDV broj: 12-digit VAT number, only for VAT-registered companies.
  add column pdv_number text check (pdv_number ~ '^\d{12}$'),
  add column city text,
  add constraint customers_company_has_jib check (customer_type = 'fizicko' or jib is not null);

create unique index customers_jib_key on public.customers (jib) where jib is not null;
