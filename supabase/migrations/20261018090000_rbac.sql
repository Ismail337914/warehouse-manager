-- RBAC: what each role may read and do, enforced in the database.
--
--   admin    – everything in the company, user roles, settings, audit log, storno.
--   menadzer – operations: products and stock (with purchase prices), all orders, sales and invoices, payments,
--              suppliers and purchasing, employees (read). No roles, settings, audit log or storno.
--   prodavac – selling: products without purchase prices, customers, and only their own orders (created or
--              assigned), POS sales and the invoices of those.
--
-- One installation serves one company, so there is no organisation layer: every active user belongs to it.

-- ---------------------------------------------------------------------------
-- Privileges: the API roles get no table rights beyond what policies and grants below allow
-- ---------------------------------------------------------------------------

-- TRUNCATE, TRIGGER and REFERENCES are not covered by RLS. The app never uses the anon role for data.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- Orders: the seller an order is assigned to
-- ---------------------------------------------------------------------------

-- Defaults to the user who creates the order (create_order runs as the caller, so auth.uid() is the seller).
alter table public.orders
  add column assigned_to uuid references public.profiles (id) on delete set null default auth.uid();
update public.orders set assigned_to = created_by where assigned_to is null;
create index orders_assigned_to_idx on public.orders (assigned_to);

-- ---------------------------------------------------------------------------
-- Ownership helpers (security definer: they read tables without triggering their RLS policies again)
-- ---------------------------------------------------------------------------

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin', 'menadzer')
$$;

-- An order belongs to the seller who created it or to whom it is assigned.
create function private.owns_order(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_app_role() is not null and exists (
    select 1 from public.orders as o
    where o.id = p_order_id and (o.created_by = auth.uid() or o.assigned_to = auth.uid())
  )
$$;

create function private.owns_pos_sale(p_pos_sale_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_app_role() is not null and exists (
    select 1 from public.pos_sales as s where s.id = p_pos_sale_id and s.created_by = auth.uid()
  )
$$;

-- Staff read every invoice; a seller reads the invoices of their own orders and POS sales.
create function private.can_read_invoice_row(p_created_by uuid, p_order_id text, p_pos_sale_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff() or (
    private.current_app_role() is not null and (
      p_created_by = auth.uid()
      or (p_order_id is not null and private.owns_order(p_order_id))
      or (p_pos_sale_id is not null and private.owns_pos_sale(p_pos_sale_id))
    )
  )
$$;

create function private.can_read_invoice(p_invoice_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invoices as i
    where i.id = p_invoice_id and private.can_read_invoice_row(i.created_by, i.order_id, i.pos_sale_id)
  )
$$;

revoke execute on function private.is_staff() from public;
revoke execute on function private.owns_order(text) from public;
revoke execute on function private.owns_pos_sale(text) from public;
revoke execute on function private.can_read_invoice_row(uuid, text, text) from public;
revoke execute on function private.can_read_invoice(text) from public;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.owns_order(text) to authenticated;
grant execute on function private.owns_pos_sale(text) to authenticated;
grant execute on function private.can_read_invoice_row(uuid, text, text) to authenticated;
grant execute on function private.can_read_invoice(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Orders: list view, access check in every order RPC, assignment
-- ---------------------------------------------------------------------------

-- Names of assignees come from assignable_users(): profiles are visible to admins only.
create or replace view public.order_list
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
  (select count(*) from public.order_items as i where i.order_id = o.id)::integer as item_count,
  o.assigned_to
from public.orders as o
join public.customers as c on c.id = o.customer_id;

-- Every order RPC locks the order through this function, so a seller can only work on their own orders.
create or replace function private.lock_order(p_order_id text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Narudžba ne postoji.';
  end if;
  if not private.is_staff() and not private.owns_order(p_order_id) then
    raise exception 'Nemate pristup narudžbi %.', v_order.number using errcode = '42501';
  end if;
  return v_order;
end;
$$;

-- Active users who can be assigned an order, for managers (profiles themselves stay visible to admins only).
create function public.assignable_users()
returns table (id uuid, full_name text, email text, role public.app_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'menadzer');
  return query
  select p.id, p.full_name, p.email, p.role
  from public.profiles as p
  where p.is_active
  order by p.full_name, p.email;
end;
$$;

create function public.assign_order(p_order_id text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform private.require_role('admin', 'menadzer');
  v_order := private.lock_order(p_order_id);
  if v_order.status in ('otkazana', 'fakturisana') then
    raise exception 'Narudžba % je zaključena i ne može se dodijeliti.', v_order.number;
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and is_active) then
    raise exception 'Odaberite aktivnog korisnika.';
  end if;

  update public.orders set assigned_to = p_user_id where id = p_order_id;
  return private.order_result(p_order_id);
end;
$$;

revoke execute on function public.assignable_users() from public, anon;
revoke execute on function public.assign_order(text, uuid) from public, anon;
grant execute on function public.assignable_users() to authenticated;
grant execute on function public.assign_order(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Purchase prices: hidden from sellers
-- ---------------------------------------------------------------------------

-- RLS filters rows, not columns, so buy_price is left out of the column-level SELECT grant. Staff read it
-- through product_costs(); managers still write it through the existing INSERT/UPDATE column grants.
revoke select on public.products from authenticated;
grant select (
  id, sku, name, category_id, description, sell_price, quantity, min_quantity, unit, location, status,
  created_at, updated_at, barcode, vat_rate, reserved_quantity, available_quantity, is_low_stock
) on public.products to authenticated;

create function public.product_costs(p_ids text[] default null)
returns table (id text, buy_price numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'menadzer');
  return query
  select p.id, p.buy_price from public.products as p
  where p_ids is null or p.id = any (p_ids);
end;
$$;

revoke execute on function public.product_costs(text[]) from public, anon;
grant execute on function public.product_costs(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security by role
-- ---------------------------------------------------------------------------

-- Staff-only tables: purchasing, stock documents (with unit costs), employees and old demo tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'goods_receipts', 'goods_receipt_items', 'stock_counts', 'stock_count_items', 'employees', 'suppliers',
    'procurement_docs', 'reservations'
  ]
  loop
    execute format('drop policy "Active users can read" on public.%I', table_name);
    execute format(
      'create policy "Staff can read" on public.%I for select to authenticated using ((select private.is_staff()))',
      table_name
    );
  end loop;
end;
$$;

drop policy "Active users can read" on public.orders;
create policy "Staff or owner can read" on public.orders
  for select to authenticated
  using (
    (select private.is_staff())
    or ((select private.current_app_role()) is not null
      and (created_by = (select auth.uid()) or assigned_to = (select auth.uid())))
  );

drop policy "Active users can read" on public.order_items;
create policy "Staff or owner can read" on public.order_items
  for select to authenticated
  using ((select private.is_staff()) or private.owns_order(order_id));

drop policy "Active users can read" on public.pos_sales;
create policy "Staff or seller can read" on public.pos_sales
  for select to authenticated
  using ((select private.is_staff()) or ((select private.current_app_role()) is not null and created_by = (select auth.uid())));

drop policy "Active users can read" on public.pos_sale_items;
create policy "Staff or seller can read" on public.pos_sale_items
  for select to authenticated
  using ((select private.is_staff()) or private.owns_pos_sale(pos_sale_id));

drop policy "Active users can read" on public.invoices;
create policy "Staff or owner can read" on public.invoices
  for select to authenticated
  using ((select private.is_staff()) or private.can_read_invoice_row(created_by, order_id, pos_sale_id));

drop policy "Active users can read" on public.invoice_items;
create policy "Staff or owner can read" on public.invoice_items
  for select to authenticated
  using ((select private.is_staff()) or private.can_read_invoice(invoice_id));

drop policy "Active users can read" on public.payments;
create policy "Staff or owner can read" on public.payments
  for select to authenticated
  using ((select private.is_staff()) or private.can_read_invoice(invoice_id));

-- A seller sees only the stock movements of their own orders and sales (e.g. on the order page).
drop policy "Active users can read" on public.inventory_movements;
create policy "Staff or owner can read" on public.inventory_movements
  for select to authenticated
  using (
    (select private.is_staff())
    or (source_type = 'narudzba' and private.owns_order(source_id))
    or (source_type = 'pos_prodaja' and private.owns_pos_sale(source_id))
  );

-- Sellers add customers while selling; editing existing customers is for staff.
drop policy "Active users update customers" on public.customers;
create policy "Staff update customers" on public.customers
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create index orders_created_by_assigned_idx on public.orders (created_by, assigned_to);
create index invoices_order_pos_idx on public.invoices (order_id, pos_sale_id);

-- ---------------------------------------------------------------------------
-- RPC changes: POS invoices only for own sales, storno only for admins
-- ---------------------------------------------------------------------------

create or replace function public.invoice_pos_sale(p_idempotency_key uuid, p_pos_sale_id text)
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
  if not private.is_staff() and v_sale.created_by is distinct from auth.uid() then
    raise exception 'Nemate pristup prodaji %.', v_sale.number using errcode = '42501';
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

-- Same as Phase 5, but only admins may cancel an issued invoice.
create or replace function public.storno_invoice(p_idempotency_key uuid, p_invoice_id text, p_reason text)
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
  perform private.require_role('admin');
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

-- ---------------------------------------------------------------------------
-- Dashboard: a seller sees their own results, staff see the company's
-- ---------------------------------------------------------------------------

-- Same rows as before plus the seller(s) each document belongs to.
create or replace view private.revenue_documents
as
select (s.created_at at time zone 'Europe/Sarajevo')::date as day, s.total, 1 as sales,
  s.created_by, s.created_by as assigned_to
from public.pos_sales as s
union all
select i.issue_date, i.total,
  case when i.storno_of is null and i.status <> 'stornirana' then 1 else 0 end,
  o.created_by, o.assigned_to
from public.invoices as i
join public.orders as o on o.id = i.order_id;

create or replace view private.revenue_lines
as
select (s.created_at at time zone 'Europe/Sarajevo')::date as day, si.product_id, si.quantity, si.gross_amount,
  s.created_by, s.created_by as assigned_to
from public.pos_sale_items as si
join public.pos_sales as s on s.id = si.pos_sale_id
union all
select i.issue_date, ii.product_id, ii.quantity, ii.gross_amount, o.created_by, o.assigned_to
from public.invoice_items as ii
join public.invoices as i on i.id = ii.invoice_id
join public.orders as o on o.id = i.order_id;

create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.local_today();
  v_month_start date := date_trunc('month', private.local_today())::date;
  v_all boolean := private.is_staff();
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');

  select jsonb_build_object(
    'scope', case when v_all then 'all' else 'own' end,
    'revenue_today', coalesce(sum(d.total) filter (where d.day = v_today), 0),
    'revenue_month', coalesce(sum(d.total) filter (where d.day >= v_month_start), 0),
    'sales_today', coalesce(sum(d.sales) filter (where d.day = v_today), 0),
    'sales_month', coalesce(sum(d.sales) filter (where d.day >= v_month_start), 0),
    'average_basket', coalesce(
      round(sum(d.total) filter (where d.day >= v_month_start)
        / nullif(sum(d.sales) filter (where d.day >= v_month_start), 0), 2),
      0
    )
  )
  into v_result
  from private.revenue_documents as d
  where d.day >= v_month_start and (v_all or d.created_by = v_uid or d.assigned_to = v_uid);

  return v_result || jsonb_build_object(
    'top_products', coalesce((
      select jsonb_agg(t order by t.revenue desc)
      from (
        select l.product_id, p.name, p.unit, sum(l.quantity)::integer as quantity, sum(l.gross_amount) as revenue
        from private.revenue_lines as l
        join public.products as p on p.id = l.product_id
        where l.day >= v_month_start and (v_all or l.created_by = v_uid or l.assigned_to = v_uid)
        group by l.product_id, p.name, p.unit
        having sum(l.gross_amount) > 0
        order by sum(l.gross_amount) desc
        limit 5
      ) as t
    ), '[]'::jsonb),
    'low_stock_count', (select count(*) from public.products where is_low_stock and status = 'active'),
    'open_orders', (
      select count(*) from public.orders as o
      where o.status in ('nacrt', 'potvrđena') and (v_all or o.created_by = v_uid or o.assigned_to = v_uid)
    ),
    'unpaid_count', (
      select count(*) from public.unpaid_invoices as u where v_all or private.can_read_invoice(u.id)
    ),
    'unpaid_amount', (
      select coalesce(sum(u.balance), 0) from public.unpaid_invoices as u where v_all or private.can_read_invoice(u.id)
    ),
    'overdue_count', (
      select count(*) from public.unpaid_invoices as u
      where u.is_overdue and (v_all or private.can_read_invoice(u.id))
    ),
    'overdue_amount', (
      select coalesce(sum(u.balance), 0) from public.unpaid_invoices as u
      where u.is_overdue and (v_all or private.can_read_invoice(u.id))
    )
  );
end;
$$;

create or replace function public.sales_by_month(p_months integer default 12)
returns table (month date, revenue numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current date := date_trunc('month', private.local_today())::date;
  v_months integer := least(greatest(coalesce(p_months, 12), 1), 36);
  v_all boolean := private.is_staff();
  v_uid uuid := auth.uid();
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');

  return query
  select m.month::date, coalesce(sum(d.total), 0)::numeric
  from generate_series(v_current - make_interval(months => v_months - 1), v_current, interval '1 month') as m (month)
  left join private.revenue_documents as d
    on d.day >= m.month::date and d.day < (m.month + interval '1 month')::date
    and (v_all or d.created_by = v_uid or d.assigned_to = v_uid)
  group by m.month
  order by m.month;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log: security and finance events, written by triggers, read by admins
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  -- Null when the change came from the system (seed, service role).
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

alter table public.audit_logs enable row level security;
create policy "Admins can read" on public.audit_logs
  for select to authenticated
  using ((select private.has_role('admin')));
revoke insert, update, delete, truncate on public.audit_logs from anon, authenticated;

create function private.prevent_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit log se ne može mijenjati ni brisati.' using errcode = '42501';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_change();

create function private.write_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    (select p.id from public.profiles as p where p.id = auth.uid()),
    p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb)
  )
$$;

create function private.audit_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('korisnik.kreiran', 'profiles', new.id::text,
      jsonb_build_object('email', new.email, 'role', new.role, 'is_active', new.is_active));
  else
    if new.role is distinct from old.role then
      perform private.write_audit('korisnik.uloga', 'profiles', new.id::text,
        jsonb_build_object('email', new.email, 'old', old.role, 'new', new.role));
    end if;
    if new.is_active is distinct from old.is_active then
      perform private.write_audit(case when new.is_active then 'korisnik.aktiviran' else 'korisnik.deaktiviran' end,
        'profiles', new.id::text, jsonb_build_object('email', new.email));
    end if;
  end if;
  return null;
end;
$$;

create function private.audit_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(old) - 'updated_at';
  v_new jsonb := to_jsonb(new) - 'updated_at';
  v_changes jsonb;
begin
  select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value)), '{}'::jsonb)
  into v_changes
  from jsonb_each(v_new) as n
  where n.value is distinct from v_old -> n.key;

  if v_changes <> '{}'::jsonb then
    perform private.write_audit('postavke.izmjena', 'settings', null, v_changes);
  end if;
  return null;
end;
$$;

create function private.audit_invoices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.storno_of is not null then
    perform private.write_audit('faktura.storno', 'invoices', new.storno_of,
      jsonb_build_object('storno_id', new.id, 'storno_number', new.number, 'total', new.total));
  end if;
  return null;
end;
$$;

create function private.audit_payments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit('uplata.evidentirana', 'invoices', new.invoice_id,
    jsonb_build_object('payment_id', new.id, 'amount', new.amount, 'method', new.method, 'paid_on', new.paid_on));
  return null;
end;
$$;

create function private.audit_stock_corrections()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type in ('korekcija', 'inventura') then
    perform private.write_audit('zalihe.' || new.type, 'products', new.product_id,
      jsonb_build_object('change', new.on_hand_change, 'after', new.on_hand_after, 'reason', new.reason));
  end if;
  return null;
end;
$$;

create function private.audit_order_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit('narudzba.dodjela', 'orders', new.id,
    jsonb_build_object('number', new.number, 'old', old.assigned_to, 'new', new.assigned_to));
  return null;
end;
$$;

create function private.audit_product_prices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit('proizvod.cijena', 'products', new.id, jsonb_build_object(
    'sku', new.sku,
    'buy_price', jsonb_build_object('old', old.buy_price, 'new', new.buy_price),
    'sell_price', jsonb_build_object('old', old.sell_price, 'new', new.sell_price)
  ));
  return null;
end;
$$;

create trigger profiles_audit
  after insert or update of role, is_active on public.profiles
  for each row execute function private.audit_profiles();
create trigger settings_audit
  after update on public.settings
  for each row execute function private.audit_settings();
create trigger invoices_audit_storno
  after insert on public.invoices
  for each row execute function private.audit_invoices();
create trigger payments_audit
  after insert on public.payments
  for each row execute function private.audit_payments();
create trigger inventory_movements_audit
  after insert on public.inventory_movements
  for each row execute function private.audit_stock_corrections();
create trigger orders_audit_assignment
  after update of assigned_to on public.orders
  for each row when (new.assigned_to is distinct from old.assigned_to)
  execute function private.audit_order_assignment();
create trigger products_audit_prices
  after update of buy_price, sell_price on public.products
  for each row when (new.buy_price is distinct from old.buy_price or new.sell_price is distinct from old.sell_price)
  execute function private.audit_product_prices();

revoke execute on function private.prevent_audit_change() from public;
revoke execute on function private.write_audit(text, text, text, jsonb) from public;
revoke execute on function private.audit_profiles() from public;
revoke execute on function private.audit_settings() from public;
revoke execute on function private.audit_invoices() from public;
revoke execute on function private.audit_payments() from public;
revoke execute on function private.audit_stock_corrections() from public;
revoke execute on function private.audit_order_assignment() from public;
revoke execute on function private.audit_product_prices() from public;

-- ---------------------------------------------------------------------------
-- Sign-up: an account gets access only when an admin created it
-- ---------------------------------------------------------------------------

-- Accounts are created by admins through the admin API, which sets app_metadata.role. Public sign-up is
-- disabled in Auth settings; if it is ever switched on, such an account stays inactive (no data access)
-- until an admin activates it.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'prodavac'),
    new.raw_app_meta_data ? 'role'
  );
  return new;
end;
$$;

-- The admin API (GoTrue) inserts the user first and writes app_metadata in a second UPDATE, so the insert
-- trigger never saw the role and every new account became prodavac. The role is applied here instead. Only the
-- service role can write app_metadata; an account that gets its first role this way is activated.
create function private.handle_user_role_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set role = (new.raw_app_meta_data ->> 'role')::public.app_role,
    is_active = case when old.raw_app_meta_data ? 'role' then is_active else true end
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_role_assigned
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data ? 'role'
    and (new.raw_app_meta_data ->> 'role') is distinct from (old.raw_app_meta_data ->> 'role'))
  execute function private.handle_user_role_assigned();

revoke execute on function private.handle_user_role_assigned() from public;

-- ---------------------------------------------------------------------------
-- Brute-force protection for sign-in and password reset (called by the server with the service role)
-- ---------------------------------------------------------------------------

-- Keys are hashes made by the server (e-mail and client IP), never the raw values.
create table private.auth_attempts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('login', 'reset')),
  key text not null,
  created_at timestamptz not null default now()
);

create index auth_attempts_lookup_idx on private.auth_attempts (kind, key, created_at desc);

-- Limits per 15 minutes: 5 failed sign-ins per e-mail and 20 per IP; 3 reset requests per e-mail and 10 per IP.
create function public.auth_attempt_allowed(p_kind text, p_email_key text, p_ip_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from private.auth_attempts as a
      where a.kind = p_kind and a.key = 'email:' || p_email_key and a.created_at > now() - interval '15 minutes')
      < case p_kind when 'login' then 5 else 3 end
    and
    (select count(*) from private.auth_attempts as a
      where a.kind = p_kind and a.key = 'ip:' || p_ip_key and a.created_at > now() - interval '15 minutes')
      < case p_kind when 'login' then 20 else 10 end
$$;

create function public.record_auth_attempt(p_kind text, p_email_key text, p_ip_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.auth_attempts where created_at < now() - interval '1 day';
  insert into private.auth_attempts (kind, key)
  values (p_kind, 'email:' || p_email_key), (p_kind, 'ip:' || p_ip_key);
$$;

-- A successful sign-in clears the e-mail's failed attempts (the IP counter keeps running).
create function public.clear_auth_attempts(p_kind text, p_email_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.auth_attempts where kind = p_kind and key = 'email:' || p_email_key;
$$;

revoke execute on function public.auth_attempt_allowed(text, text, text) from public, anon, authenticated;
revoke execute on function public.record_auth_attempt(text, text, text) from public, anon, authenticated;
revoke execute on function public.clear_auth_attempts(text, text) from public, anon, authenticated;
grant execute on function public.auth_attempt_allowed(text, text, text) to service_role;
grant execute on function public.record_auth_attempt(text, text, text) to service_role;
grant execute on function public.clear_auth_attempts(text, text) to service_role;
