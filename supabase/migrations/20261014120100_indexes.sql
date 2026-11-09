-- Indexes for the queries the app runs.
-- PostgreSQL does not index foreign keys automatically, so every FK used in joins gets one here.

-- Supabase keeps extensions in the "extensions" schema.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- products ------------------------------------------------------------------
-- SKU is unique regardless of case ("sku-9001" and "SKU-9001" are the same product).
create unique index products_sku_lower_key on public.products (lower(sku));
create index products_category_id_idx on public.products (category_id);
create index products_status_idx on public.products (status);
-- The warehouse and POS search do a "contains" match on name and SKU (ILIKE '%...%').
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index products_sku_trgm_idx on public.products using gin (sku extensions.gin_trgm_ops);
-- Small partial index for the low-stock list on the dashboard.
create index products_low_stock_idx on public.products (id) where quantity <= min_quantity;

-- customers -----------------------------------------------------------------
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);
create index customers_email_lower_idx on public.customers (lower(email));

-- orders --------------------------------------------------------------------
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);

-- order_items (order_id is already covered by the primary key) ----------------
create index order_items_product_id_idx on public.order_items (product_id);

-- invoices (order_id is already covered by its unique constraint) -------------
create index invoices_customer_id_idx on public.invoices (customer_id);
create index invoices_status_idx on public.invoices (status);

-- inventory_movements -------------------------------------------------------
-- "Posljednje promjene" lists the newest movements, overall and per product.
create index inventory_movements_product_id_created_at_idx
  on public.inventory_movements (product_id, created_at desc);
create index inventory_movements_created_at_idx on public.inventory_movements (created_at desc);
create index inventory_movements_order_id_idx on public.inventory_movements (order_id);

-- reservations --------------------------------------------------------------
create index reservations_customer_id_idx on public.reservations (customer_id);
create index reservations_product_id_idx on public.reservations (product_id);
create index reservations_status_idx on public.reservations (status);

-- procurement ---------------------------------------------------------------
create index procurement_docs_supplier_id_idx on public.procurement_docs (supplier_id);
create index procurement_docs_status_idx on public.procurement_docs (status);
