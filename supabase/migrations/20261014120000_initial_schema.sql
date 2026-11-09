-- Initial schema for the warehouse manager (Supabase / PostgreSQL 15+).
--
-- Primary keys are readable codes ("PRD-1021", "SO-1024") that match the IDs the app already uses.
-- The database generates them from sequences, so concurrent users can never get the same ID.

-- ---------------------------------------------------------------------------
-- Enums (values match the TypeScript types in src/lib/demo-data.ts)
-- ---------------------------------------------------------------------------

create type public.product_status as enum ('active', 'inactive');
create type public.stock_movement_type as enum ('ulaz', 'izlaz', 'otpis');
create type public.order_status as enum (
  'nova',
  'potvrđena',
  'u obradi',
  'spremna za isporuku',
  'završena',
  'otkazana'
);
create type public.order_source as enum ('web', 'olx', 'viber', 'telefon', 'pos');
create type public.invoice_status as enum ('draft', 'issued', 'paid', 'overdue');
create type public.employee_status as enum ('aktivan', 'odmor', 'neaktivan');
create type public.reservation_status as enum ('nova', 'potvrđena', 'završena', 'otkazana');
create type public.procurement_status as enum ('u obradi', 'primljeno', 'otkazano');

-- ---------------------------------------------------------------------------
-- Sequences behind the readable IDs
-- ---------------------------------------------------------------------------

create sequence public.products_id_seq;
create sequence public.customers_id_seq;
create sequence public.orders_id_seq;
create sequence public.orders_number_seq;
create sequence public.invoices_id_seq;
create sequence public.invoices_number_seq;
create sequence public.inventory_movements_id_seq;
create sequence public.employees_id_seq;
create sequence public.reservations_id_seq;
create sequence public.suppliers_id_seq;
create sequence public.procurement_docs_id_seq;
create sequence public.procurement_docs_number_seq;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

create table public.products (
  id text primary key default 'PRD-' || nextval('public.products_id_seq'),
  sku text not null check (btrim(sku) <> ''),
  name text not null check (btrim(name) <> ''),
  category_id bigint not null references public.categories (id) on delete restrict,
  description text not null default '',
  buy_price numeric(12, 2) not null check (buy_price >= 0),
  sell_price numeric(12, 2) not null check (sell_price >= 0),
  -- Stock can never go negative: the same rule the app enforces for "izlaz".
  quantity integer not null default 0 check (quantity >= 0),
  min_quantity integer not null default 0 check (min_quantity >= 0),
  unit text not null default 'kom',
  location text not null check (btrim(location) <> ''),
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id text primary key default 'CUS-' || nextval('public.customers_id_seq'),
  name text not null check (btrim(name) <> ''),
  phone text,
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id text primary key default 'ORD-' || nextval('public.orders_id_seq'),
  number text not null unique default 'SO-' || nextval('public.orders_number_seq'),
  customer_id text not null references public.customers (id) on delete restrict,
  source public.order_source not null,
  status public.order_status not null default 'nova',
  note text not null default '',
  -- Kept in sync with order_items by the refresh_order_total trigger below.
  total numeric(12, 2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  order_id text not null references public.orders (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  -- Price at the moment of the order, so later price changes don't rewrite history.
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  -- One line per product per order: the same product twice must be merged into one line.
  primary key (order_id, product_id)
);

create table public.invoices (
  id text primary key default 'INV-' || nextval('public.invoices_id_seq'),
  number text not null unique default 'FO-' || nextval('public.invoices_number_seq'),
  customer_id text not null references public.customers (id) on delete restrict,
  -- At most one invoice per order; invoices without an order are allowed.
  order_id text unique references public.orders (id) on delete set null,
  total numeric(12, 2) not null check (total >= 0),
  status public.invoice_status not null default 'draft',
  issued_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.inventory_movements (
  id text primary key default 'MOV-' || lpad(nextval('public.inventory_movements_id_seq')::text, 3, '0'),
  product_id text not null references public.products (id) on delete restrict,
  -- Set when the movement comes from confirming, cancelling or selling an order.
  order_id text references public.orders (id) on delete set null,
  type public.stock_movement_type not null,
  quantity_change integer not null,
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now(),
  -- "ulaz" adds stock, "izlaz" and "otpis" remove it.
  constraint inventory_movements_sign_matches_type check (
    (type = 'ulaz' and quantity_change > 0)
    or (type in ('izlaz', 'otpis') and quantity_change < 0)
  )
);

create table public.employees (
  id text primary key default 'EMP-' || nextval('public.employees_id_seq'),
  name text not null check (btrim(name) <> ''),
  role text not null,
  department text not null,
  phone text,
  email text unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status public.employee_status not null default 'aktivan',
  created_at timestamptz not null default now()
);

create table public.reservations (
  id text primary key default 'RES-' || nextval('public.reservations_id_seq'),
  customer_id text not null references public.customers (id) on delete restrict,
  product_id text not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.reservation_status not null default 'nova',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id text primary key default 'SUP-' || nextval('public.suppliers_id_seq'),
  name text not null unique check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

create table public.procurement_docs (
  id text primary key default 'PUR-' || nextval('public.procurement_docs_id_seq'),
  document_number text not null unique default 'PO-' || nextval('public.procurement_docs_number_seq'),
  supplier_id text not null references public.suppliers (id) on delete restrict,
  total numeric(12, 2) not null check (total >= 0),
  status public.procurement_status not null default 'u obradi',
  created_at timestamptz not null default now()
);

alter sequence public.products_id_seq owned by public.products.id;
alter sequence public.customers_id_seq owned by public.customers.id;
alter sequence public.orders_id_seq owned by public.orders.id;
alter sequence public.orders_number_seq owned by public.orders.number;
alter sequence public.invoices_id_seq owned by public.invoices.id;
alter sequence public.invoices_number_seq owned by public.invoices.number;
alter sequence public.inventory_movements_id_seq owned by public.inventory_movements.id;
alter sequence public.employees_id_seq owned by public.employees.id;
alter sequence public.reservations_id_seq owned by public.reservations.id;
alter sequence public.suppliers_id_seq owned by public.suppliers.id;
alter sequence public.procurement_docs_id_seq owned by public.procurement_docs.id;
alter sequence public.procurement_docs_number_seq owned by public.procurement_docs.document_number;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Recalculates orders.total whenever its lines change, so the total can't drift from the items.
create function public.refresh_order_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.orders as o
  set total = coalesce(
    (select sum(i.quantity * i.unit_price) from public.order_items as i where i.order_id = o.id),
    0
  )
  where o.id in (new.order_id, old.order_id);

  return null;
end;
$$;

create trigger order_items_refresh_order_total
  after insert or update or delete on public.order_items
  for each row execute function public.refresh_order_total();

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Products at or below their minimum stock (dashboard "Niske zalihe").
create view public.low_stock_products
with (security_invoker = true)
as
select p.id, p.sku, p.name, c.name as category, p.quantity, p.min_quantity, p.unit, p.location
from public.products as p
join public.categories as c on c.id = p.category_id
where p.quantity <= p.min_quantity;
