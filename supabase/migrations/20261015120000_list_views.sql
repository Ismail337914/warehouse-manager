-- Phase 4: what the list screens need for server-side search, filters and pagination.

-- The API can't compare two columns in a filter, so "low stock" is a stored column.
alter table public.products
  add column is_low_stock boolean generated always as (quantity <= min_quantity) stored;

create index products_is_low_stock_idx on public.products (is_low_stock) where is_low_stock;

-- Order list with the customer's name, so one search box can match the order number or the customer.
-- security_invoker: the caller's RLS on orders and customers applies.
create view public.order_list
with (security_invoker = true)
as
select
  o.id,
  o.number,
  o.status,
  o.source,
  o.subtotal,
  o.vat_total,
  o.total,
  o.created_at,
  o.customer_id,
  c.name as customer_name,
  (select count(*) from public.order_items as i where i.order_id = o.id)::integer as item_count
from public.orders as o
join public.customers as c on c.id = o.customer_id;

create index orders_number_trgm_idx on public.orders using gin (number extensions.gin_trgm_ops);

-- Stock reserved by confirmed orders, one row per order line.
create view public.active_reservations
with (security_invoker = true)
as
select
  i.order_id,
  o.number as order_number,
  o.confirmed_at,
  o.customer_id,
  c.name as customer_name,
  i.product_id,
  p.sku,
  p.name as product_name,
  p.unit,
  i.quantity
from public.order_items as i
join public.orders as o on o.id = i.order_id
join public.customers as c on c.id = o.customer_id
join public.products as p on p.id = i.product_id
where o.status = 'potvrđena';
