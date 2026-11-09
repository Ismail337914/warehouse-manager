-- Phase 5: POS sales, invoices (from delivered orders and from POS sales), payments and storno.
-- Every document is written by one RPC transaction and is immutable afterwards; prices, VAT and totals
-- always come from the database.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Today in Bosnia. current_date would follow the server's time zone (UTC on Supabase).
create function private.local_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Sarajevo')::date
$$;

-- 0001/2026, P-0001/2026. Numbers above 9999 keep all their digits.
create function private.format_document_number(p_prefix text, p_number integer, p_year integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_prefix || lpad(p_number::text, greatest(4, length(p_number::text)), '0') || '/' || p_year
$$;

revoke execute on function private.local_today() from public;
revoke execute on function private.format_document_number(text, integer, integer) from public;

create type public.payment_method as enum ('gotovina', 'kartica', 'virman');

-- ---------------------------------------------------------------------------
-- POS sales
-- ---------------------------------------------------------------------------

create sequence public.pos_sales_id_seq;

create table public.pos_sales (
  id text primary key default 'POS-' || nextval('public.pos_sales_id_seq'),
  -- P-0001/2026, gap-free per year (document_counters 'pos').
  number text not null unique,
  -- Optional: a walk-in customer stays anonymous.
  customer_id text references public.customers (id) on delete restrict,
  payment_method public.payment_method not null,
  -- One discount for the whole receipt, applied to every line.
  discount_percent numeric(5, 2) not null default 0 check (discount_percent between 0 and 100),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  vat_total numeric(12, 2) not null check (vat_total >= 0),
  total numeric(12, 2) not null check (total >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter sequence public.pos_sales_id_seq owned by public.pos_sales.id;

-- Snapshot of prices and VAT at the moment of sale.
create table public.pos_sale_items (
  pos_sale_id text not null references public.pos_sales (id) on delete restrict,
  product_id text not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  discount_percent numeric(5, 2) not null check (discount_percent between 0 and 100),
  vat_rate numeric(5, 2) not null check (vat_rate between 0 and 100),
  net_amount numeric(12, 2) not null check (net_amount >= 0),
  vat_amount numeric(12, 2) not null check (vat_amount >= 0),
  gross_amount numeric(12, 2) not null check (gross_amount >= 0),
  primary key (pos_sale_id, product_id)
);

create index pos_sales_created_at_idx on public.pos_sales (created_at desc);
create index pos_sales_customer_id_idx on public.pos_sales (customer_id);
create index pos_sales_created_by_idx on public.pos_sales (created_by);
create index pos_sale_items_product_id_idx on public.pos_sale_items (product_id);

-- ---------------------------------------------------------------------------
-- Invoices (rebuilt: the Phase 1 table held only demo rows)
-- ---------------------------------------------------------------------------

drop table public.invoices;
drop type public.invoice_status;

-- Storno documents keep status izdata; they are recognised by storno_of.
create type public.invoice_status as enum ('izdata', 'djelimicno_placena', 'placena', 'stornirana');

create sequence public.invoices_id_seq;

create table public.invoices (
  id text primary key default 'INV-' || nextval('public.invoices_id_seq'),
  -- 0001/2026, gap-free per year (document_counters 'faktura'); storno documents use the same series.
  number text not null unique,
  -- Source: a delivered order or a POS sale. A storno document points to the same source.
  order_id text references public.orders (id) on delete restrict,
  pos_sale_id text references public.pos_sales (id) on delete restrict,
  storno_of text unique references public.invoices (id) on delete restrict,
  -- Buyer and seller as they were on the day of issue.
  customer_id text not null references public.customers (id) on delete restrict,
  customer_name text not null,
  customer_type public.customer_type not null,
  customer_jib text,
  customer_pdv_number text,
  customer_address text,
  customer_city text,
  company_name text not null,
  company_address text not null,
  company_jib text,
  company_pdv_number text,
  issue_date date not null,
  due_date date not null,
  -- How a POS sale was paid; null for invoices paid by recorded payments.
  payment_method public.payment_method,
  subtotal numeric(12, 2) not null,
  vat_total numeric(12, 2) not null,
  total numeric(12, 2) not null,
  -- Sum of payments (or the whole amount for a POS sale, paid at the till).
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  status public.invoice_status not null default 'izdata',
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invoices_one_source check (num_nonnulls(order_id, pos_sale_id) = 1),
  -- Invoices are positive; a storno document mirrors its invoice with negative amounts.
  constraint invoices_amount_sign check (
    case when storno_of is null
      then subtotal >= 0 and vat_total >= 0 and total >= 0
      else subtotal <= 0 and vat_total <= 0 and total <= 0 and paid_amount = 0
    end
  ),
  constraint invoices_paid_within_total check (storno_of is not null or paid_amount <= total),
  constraint invoices_due_after_issue check (due_date >= issue_date)
);

alter sequence public.invoices_id_seq owned by public.invoices.id;

-- An order or POS sale has at most one valid invoice. After a storno it can be invoiced again.
create unique index invoices_order_id_active_key
  on public.invoices (order_id)
  where storno_of is null and status <> 'stornirana';
create unique index invoices_pos_sale_id_active_key
  on public.invoices (pos_sale_id)
  where storno_of is null and status <> 'stornirana';

create index invoices_order_id_idx on public.invoices (order_id);
create index invoices_pos_sale_id_idx on public.invoices (pos_sale_id);
create index invoices_customer_id_idx on public.invoices (customer_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_issue_date_idx on public.invoices (issue_date desc);
create index invoices_due_date_idx on public.invoices (due_date);
create index invoices_created_by_idx on public.invoices (created_by);
create index invoices_number_trgm_idx on public.invoices using gin (number extensions.gin_trgm_ops);
create index invoices_customer_name_trgm_idx on public.invoices using gin (customer_name extensions.gin_trgm_ops);

-- Product name, code and unit are copied so a later rename doesn't change an issued invoice.
create table public.invoice_items (
  invoice_id text not null references public.invoices (id) on delete restrict,
  product_id text not null references public.products (id) on delete restrict,
  sku text not null,
  name text not null,
  unit text not null,
  -- Negative on a storno document.
  quantity integer not null check (quantity <> 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  discount_percent numeric(5, 2) not null check (discount_percent between 0 and 100),
  vat_rate numeric(5, 2) not null check (vat_rate between 0 and 100),
  net_amount numeric(12, 2) not null,
  vat_amount numeric(12, 2) not null,
  gross_amount numeric(12, 2) not null,
  primary key (invoice_id, product_id)
);

create index invoice_items_product_id_idx on public.invoice_items (product_id);

create sequence public.payments_id_seq;

create table public.payments (
  id text primary key default 'UPL-' || nextval('public.payments_id_seq'),
  invoice_id text not null references public.invoices (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  method public.payment_method not null,
  paid_on date not null,
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter sequence public.payments_id_seq owned by public.payments.id;

create index payments_invoice_id_idx on public.payments (invoice_id);
create index payments_created_by_idx on public.payments (created_by);

-- ---------------------------------------------------------------------------
-- Issued documents can't be changed
-- ---------------------------------------------------------------------------

create function private.prevent_document_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Izdati dokument se ne može mijenjati ni brisati.' using errcode = '42501';
end;
$$;

-- On an issued invoice only the payment state may change (status and paid amount, set by RPC functions).
create function private.guard_invoice_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['status', 'paid_amount']) is distinct from (to_jsonb(old) - array['status', 'paid_amount']) then
    raise exception 'Izdata faktura se ne može mijenjati. Za ispravku izdajte storno.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Lines are written only in the transaction that issues the invoice (created_at = now() = transaction start).
create function private.guard_invoice_items_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.invoices as i where i.id = new.invoice_id and i.created_at = now()) then
    raise exception 'Izdata faktura se ne može mijenjati. Za ispravku izdajte storno.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger pos_sales_immutable
  before update or delete on public.pos_sales
  for each row execute function private.prevent_document_change();
create trigger pos_sale_items_immutable
  before update or delete on public.pos_sale_items
  for each row execute function private.prevent_document_change();
create trigger invoices_guard_update
  before update on public.invoices
  for each row execute function private.guard_invoice_update();
create trigger invoices_no_delete
  before delete on public.invoices
  for each row execute function private.prevent_document_change();
create trigger invoice_items_guard_insert
  before insert on public.invoice_items
  for each row execute function private.guard_invoice_items_insert();
create trigger invoice_items_immutable
  before update or delete on public.invoice_items
  for each row execute function private.prevent_document_change();
create trigger payments_immutable
  before update or delete on public.payments
  for each row execute function private.prevent_document_change();

revoke execute on function private.prevent_document_change() from public;
revoke execute on function private.guard_invoice_update() from public;
revoke execute on function private.guard_invoice_items_insert() from public;

-- Readable by every active user; written only by the RPC functions below.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['pos_sales', 'pos_sale_items', 'invoices', 'invoice_items', 'payments']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy "Active users can read" on public.%I
         for select to authenticated
         using ((select private.current_app_role()) is not null)',
      table_name
    );
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Order status: a storno returns an invoiced order to isporučena so it can be invoiced again.
-- Only storno_invoice makes this transition; the UI never offers it as an action.
-- ---------------------------------------------------------------------------

create or replace function private.order_transition_allowed(from_status public.order_status, to_status public.order_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (from_status, to_status) in (
    ('nacrt'::public.order_status, 'potvrđena'::public.order_status),
    ('nacrt', 'otkazana'),
    ('potvrđena', 'isporučena'),
    ('potvrđena', 'otkazana'),
    ('isporučena', 'fakturisana'),
    ('fakturisana', 'isporučena')
  )
$$;

-- ---------------------------------------------------------------------------
-- Invoice helpers
-- ---------------------------------------------------------------------------

create function private.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from private.local_today())::integer;
begin
  return private.format_document_number('', private.next_document_number('faktura', v_year), v_year);
end;
$$;

-- Inserts the invoice header with a fresh snapshot of the customer and the company. Lines are added by the caller.
create function private.insert_invoice(
  p_customer_id text,
  p_order_id text,
  p_pos_sale_id text,
  p_subtotal numeric,
  p_vat_total numeric,
  p_total numeric,
  p_payment_method public.payment_method,
  p_paid boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
  v_settings public.settings;
  v_today date := private.local_today();
  v_invoice_id text;
begin
  select * into v_customer from public.customers where id = p_customer_id;
  if not found then
    raise exception 'Kupac ne postoji.';
  end if;
  select * into v_settings from public.settings;

  insert into public.invoices (
    number, order_id, pos_sale_id, customer_id, customer_name, customer_type, customer_jib, customer_pdv_number,
    customer_address, customer_city, company_name, company_address, company_jib, company_pdv_number,
    issue_date, due_date, payment_method, subtotal, vat_total, total, paid_amount, status, created_by
  )
  values (
    private.next_invoice_number(), p_order_id, p_pos_sale_id, v_customer.id, v_customer.name, v_customer.customer_type,
    v_customer.jib, v_customer.pdv_number, v_customer.address, v_customer.city, v_settings.company_name,
    v_settings.company_address, v_settings.company_jib, v_settings.company_pdv_number,
    v_today,
    case when p_paid then v_today else v_today + v_settings.invoice_due_days end,
    p_payment_method, p_subtotal, p_vat_total, p_total,
    case when p_paid then p_total else 0 end,
    case when p_paid then 'placena'::public.invoice_status else 'izdata'::public.invoice_status end,
    auth.uid()
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

create function private.lock_invoice(p_invoice_id text)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Faktura ne postoji.';
  end if;
  return v_invoice;
end;
$$;

create function private.invoice_result(p_invoice_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id, 'number', i.number, 'status', i.status, 'total', i.total,
    'paid_amount', i.paid_amount, 'storno_of', i.storno_of
  )
  from public.invoices as i
  where i.id = p_invoice_id
$$;

revoke execute on function private.next_invoice_number() from public;
revoke execute on function private.insert_invoice(
  text, text, text, numeric, numeric, numeric, public.payment_method, boolean
) from public;
revoke execute on function private.lock_invoice(text) from public;
revoke execute on function private.invoice_result(text) from public;

-- ---------------------------------------------------------------------------
-- RPC: POS sale
-- ---------------------------------------------------------------------------

-- p_items: [{ "product_id": "PRD-1021", "quantity": 2 }]. The same product on several lines is merged.
-- Stock leaves the warehouse immediately. The conditional UPDATE (available >= quantity) never touches stock
-- reserved by confirmed orders, and two tills can't sell the same last piece.
create function public.complete_pos_sale(
  p_idempotency_key uuid,
  p_customer_id text,
  p_payment_method public.payment_method,
  p_discount_percent numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_discount numeric := coalesce(p_discount_percent, 0);
  v_max_discount numeric := private.max_discount_for_current_user();
  v_customer_id text := nullif(btrim(p_customer_id), '');
  v_year integer := extract(year from private.local_today())::integer;
  v_sale_id text;
  v_number text;
  v_line record;
  v_product public.products;
  v_amounts record;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_vat_total numeric := 0;
  v_total numeric := 0;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'complete_pos_sale');
  if v_existing is not null then
    return v_existing;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Korpa je prazna.';
  end if;
  if p_payment_method is null then
    raise exception 'Odaberite način plaćanja.';
  end if;
  if v_discount < 0 or v_discount > v_max_discount then
    raise exception 'Popust može biti najviše % %%.', v_max_discount;
  end if;
  if v_customer_id is not null and not exists (select 1 from public.customers where id = v_customer_id) then
    raise exception 'Odaberite postojećeg kupca.';
  end if;

  for v_line in
    select
      item.product_id,
      sum(item.quantity)::integer as quantity,
      bool_or(item.quantity is null or item.quantity <= 0) as has_invalid_quantity
    from jsonb_to_recordset(p_items) as item (product_id text, quantity integer)
    group by item.product_id
    order by item.product_id
  loop
    if v_line.product_id is null then
      raise exception 'Odaberite proizvod za svaku stavku.';
    end if;
    if v_line.has_invalid_quantity then
      raise exception 'Količina svake stavke mora biti cijeli broj veći od 0.';
    end if;

    update public.products
    set quantity = quantity - v_line.quantity
    where id = v_line.product_id and status = 'active' and quantity - reserved_quantity >= v_line.quantity
    returning * into v_product;

    if not found then
      select * into v_product from public.products where id = v_line.product_id;
      if not found or v_product.status <> 'active' then
        raise exception 'Proizvod % ne postoji ili nije aktivan.', v_line.product_id;
      end if;
      raise exception 'Nedovoljno dostupno: % (dostupno %, traženo %).',
        v_product.name, v_product.available_quantity, v_line.quantity;
    end if;

    select * into v_amounts
    from private.line_amounts(v_line.quantity, v_product.sell_price, v_discount, v_product.vat_rate);

    v_subtotal := v_subtotal + v_amounts.net_amount;
    v_vat_total := v_vat_total + v_amounts.vat_amount;
    v_total := v_total + v_amounts.gross_amount;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id, 'quantity', v_line.quantity, 'unit_price', v_product.sell_price,
      'vat_rate', v_product.vat_rate, 'net_amount', v_amounts.net_amount, 'vat_amount', v_amounts.vat_amount,
      'gross_amount', v_amounts.gross_amount, 'on_hand_after', v_product.quantity,
      'reserved_after', v_product.reserved_quantity
    );
  end loop;

  v_number := private.format_document_number('P-', private.next_document_number('pos', v_year), v_year);

  insert into public.pos_sales (
    number, customer_id, payment_method, discount_percent, subtotal, vat_total, total, created_by
  )
  values (v_number, v_customer_id, p_payment_method, v_discount, v_subtotal, v_vat_total, v_total, auth.uid())
  returning id into v_sale_id;

  insert into public.pos_sale_items (
    pos_sale_id, product_id, quantity, unit_price, discount_percent, vat_rate, net_amount, vat_amount, gross_amount
  )
  select v_sale_id, line.product_id, line.quantity, line.unit_price, v_discount, line.vat_rate,
    line.net_amount, line.vat_amount, line.gross_amount
  from jsonb_to_recordset(v_lines) as line (
    product_id text, quantity integer, unit_price numeric, vat_rate numeric,
    net_amount numeric, vat_amount numeric, gross_amount numeric
  );

  for v_line in
    select * from jsonb_to_recordset(v_lines) as line (
      product_id text, quantity integer, on_hand_after integer, reserved_after integer
    )
  loop
    perform private.record_movement(
      v_line.product_id, 'izlaz', -v_line.quantity, 0, v_line.on_hand_after, v_line.reserved_after,
      'pos_prodaja', v_sale_id, 'POS prodaja ' || v_number
    );
  end loop;

  return private.complete_idempotency_key(p_idempotency_key, jsonb_build_object(
    'id', v_sale_id, 'number', v_number, 'subtotal', v_subtotal, 'vat_total', v_vat_total, 'total', v_total
  ));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: invoices
-- ---------------------------------------------------------------------------

-- A delivered order gets its invoice (isporučena → fakturisana). Locking the order serialises concurrent
-- attempts; the second one sees fakturisana and stops.
create function public.invoice_order(p_idempotency_key uuid, p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_order public.orders;
  v_invoice_id text;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'invoice_order');
  if v_existing is not null then
    return v_existing;
  end if;

  v_order := private.lock_order(p_order_id);
  if v_order.status = 'fakturisana' then
    raise exception 'Narudžba % je već fakturisana.', v_order.number;
  end if;
  if v_order.status <> 'isporučena' then
    raise exception 'Fakturisati se može samo isporučena narudžba (% je u statusu „%“).', v_order.number, v_order.status;
  end if;

  v_invoice_id := private.insert_invoice(
    v_order.customer_id, v_order.id, null, v_order.subtotal, v_order.vat_total, v_order.total, null, false
  );

  insert into public.invoice_items (
    invoice_id, product_id, sku, name, unit, quantity, unit_price, discount_percent, vat_rate,
    net_amount, vat_amount, gross_amount
  )
  select v_invoice_id, i.product_id, p.sku, p.name, p.unit, i.quantity, i.unit_price, i.discount_percent, i.vat_rate,
    i.net_amount, i.vat_amount, i.gross_amount
  from public.order_items as i
  join public.products as p on p.id = i.product_id
  where i.order_id = p_order_id;

  update public.orders set status = 'fakturisana' where id = p_order_id;

  return private.complete_idempotency_key(p_idempotency_key, private.invoice_result(v_invoice_id));
end;
$$;

-- Invoice for a POS sale with a known customer. The sale was paid at the till, so the invoice is paid.
create function public.invoice_pos_sale(p_idempotency_key uuid, p_pos_sale_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_sale public.pos_sales;
  v_invoice_id text;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'invoice_pos_sale');
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_sale from public.pos_sales where id = p_pos_sale_id for update;
  if not found then
    raise exception 'Prodaja ne postoji.';
  end if;
  if v_sale.customer_id is null then
    raise exception 'Prodaja % nema kupca, pa se za nju ne može izdati faktura.', v_sale.number;
  end if;
  if exists (
    select 1 from public.invoices as i
    where i.pos_sale_id = p_pos_sale_id and i.storno_of is null and i.status <> 'stornirana'
  ) then
    raise exception 'Prodaja % je već fakturisana.', v_sale.number;
  end if;

  v_invoice_id := private.insert_invoice(
    v_sale.customer_id, null, v_sale.id, v_sale.subtotal, v_sale.vat_total, v_sale.total, v_sale.payment_method, true
  );

  insert into public.invoice_items (
    invoice_id, product_id, sku, name, unit, quantity, unit_price, discount_percent, vat_rate,
    net_amount, vat_amount, gross_amount
  )
  select v_invoice_id, i.product_id, p.sku, p.name, p.unit, i.quantity, i.unit_price, i.discount_percent, i.vat_rate,
    i.net_amount, i.vat_amount, i.gross_amount
  from public.pos_sale_items as i
  join public.products as p on p.id = i.product_id
  where i.pos_sale_id = p_pos_sale_id;

  return private.complete_idempotency_key(p_idempotency_key, private.invoice_result(v_invoice_id));
end;
$$;

-- A payment can't exceed what is still owed; the status follows from the sum of payments.
create function public.record_payment(
  p_idempotency_key uuid,
  p_invoice_id text,
  p_amount numeric,
  p_method public.payment_method,
  p_paid_on date,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_invoice public.invoices;
  v_amount numeric := private.round_money(p_amount);
  v_paid_on date := coalesce(p_paid_on, private.local_today());
  v_paid numeric;
begin
  perform private.require_role('admin', 'menadzer');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'record_payment');
  if v_existing is not null then
    return v_existing;
  end if;

  v_invoice := private.lock_invoice(p_invoice_id);
  if v_invoice.storno_of is not null then
    raise exception 'Storno dokument se ne plaća.';
  end if;
  if v_invoice.status = 'stornirana' then
    raise exception 'Faktura % je stornirana.', v_invoice.number;
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Iznos uplate mora biti veći od 0.';
  end if;
  if v_amount > v_invoice.total - v_invoice.paid_amount then
    raise exception 'Iznos uplate je veći od duga (%).', v_invoice.total - v_invoice.paid_amount;
  end if;
  if p_method is null then
    raise exception 'Odaberite način plaćanja.';
  end if;
  if v_paid_on > private.local_today() then
    raise exception 'Datum uplate ne može biti u budućnosti.';
  end if;

  insert into public.payments (invoice_id, amount, method, paid_on, note, created_by)
  values (p_invoice_id, v_amount, p_method, v_paid_on, coalesce(btrim(p_note), ''), auth.uid());

  select coalesce(sum(p.amount), 0) into v_paid from public.payments as p where p.invoice_id = p_invoice_id;

  update public.invoices
  set paid_amount = v_paid,
    status = case when v_paid >= total then 'placena'::public.invoice_status else 'djelimicno_placena'::public.invoice_status end
  where id = p_invoice_id;

  return private.complete_idempotency_key(p_idempotency_key, private.invoice_result(p_invoice_id));
end;
$$;

-- Cancels an invoice with a storno document: same lines with negative quantities and amounts, its own number.
-- The original becomes stornirana and its order goes back to isporučena. Not allowed once payments exist.
create function public.storno_invoice(p_idempotency_key uuid, p_invoice_id text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_invoice public.invoices;
  v_settings public.settings;
  v_today date := private.local_today();
  v_storno_id text;
begin
  perform private.require_role('admin', 'menadzer');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'storno_invoice');
  if v_existing is not null then
    return v_existing;
  end if;

  -- Order before invoice, the same lock order as invoice_order.
  if exists (select 1 from public.invoices where id = p_invoice_id and order_id is not null) then
    perform private.lock_order((select order_id from public.invoices where id = p_invoice_id));
  end if;
  v_invoice := private.lock_invoice(p_invoice_id);

  if v_invoice.storno_of is not null then
    raise exception 'Storno dokument se ne može stornirati.';
  end if;
  if v_invoice.status = 'stornirana' then
    raise exception 'Faktura % je već stornirana.', v_invoice.number;
  end if;
  if exists (select 1 from public.payments where invoice_id = p_invoice_id) then
    raise exception 'Faktura % ima evidentirane uplate i ne može se stornirati.', v_invoice.number;
  end if;

  select * into v_settings from public.settings;

  insert into public.invoices (
    number, order_id, pos_sale_id, storno_of, customer_id, customer_name, customer_type, customer_jib,
    customer_pdv_number, customer_address, customer_city, company_name, company_address, company_jib,
    company_pdv_number, issue_date, due_date, payment_method, subtotal, vat_total, total, paid_amount, status,
    note, created_by
  )
  values (
    private.next_invoice_number(), v_invoice.order_id, v_invoice.pos_sale_id, v_invoice.id, v_invoice.customer_id,
    v_invoice.customer_name, v_invoice.customer_type, v_invoice.customer_jib, v_invoice.customer_pdv_number,
    v_invoice.customer_address, v_invoice.customer_city, v_settings.company_name, v_settings.company_address,
    v_settings.company_jib, v_settings.company_pdv_number, v_today, v_today, v_invoice.payment_method,
    -v_invoice.subtotal, -v_invoice.vat_total, -v_invoice.total, 0, 'izdata',
    concat_ws(' ', 'Storno fakture ' || v_invoice.number || '.', nullif(btrim(p_reason), '')),
    auth.uid()
  )
  returning id into v_storno_id;

  insert into public.invoice_items (
    invoice_id, product_id, sku, name, unit, quantity, unit_price, discount_percent, vat_rate,
    net_amount, vat_amount, gross_amount
  )
  select v_storno_id, i.product_id, i.sku, i.name, i.unit, -i.quantity, i.unit_price, i.discount_percent, i.vat_rate,
    -i.net_amount, -i.vat_amount, -i.gross_amount
  from public.invoice_items as i
  where i.invoice_id = p_invoice_id;

  update public.invoices set status = 'stornirana' where id = p_invoice_id;

  if v_invoice.order_id is not null then
    update public.orders set status = 'isporučena' where id = v_invoice.order_id;
  end if;

  return private.complete_idempotency_key(p_idempotency_key, private.invoice_result(v_storno_id));
end;
$$;

revoke execute on function public.complete_pos_sale(uuid, text, public.payment_method, numeric, jsonb) from public, anon;
revoke execute on function public.invoice_order(uuid, text) from public, anon;
revoke execute on function public.invoice_pos_sale(uuid, text) from public, anon;
revoke execute on function public.record_payment(uuid, text, numeric, public.payment_method, date, text) from public, anon;
revoke execute on function public.storno_invoice(uuid, text, text) from public, anon;
grant execute on function public.complete_pos_sale(uuid, text, public.payment_method, numeric, jsonb) to authenticated;
grant execute on function public.invoice_order(uuid, text) to authenticated;
grant execute on function public.invoice_pos_sale(uuid, text) to authenticated;
grant execute on function public.record_payment(uuid, text, numeric, public.payment_method, date, text) to authenticated;
grant execute on function public.storno_invoice(uuid, text, text) to authenticated;
