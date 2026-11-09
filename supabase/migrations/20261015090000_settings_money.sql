-- Phase 3: company settings (VAT rate, discount limits) and the single place where money is rounded.

-- ---------------------------------------------------------------------------
-- Settings: exactly one row
-- ---------------------------------------------------------------------------

create table public.settings (
  id boolean primary key default true check (id),
  company_name text not null default '',
  company_address text not null default '',
  company_jib text check (company_jib ~ '^\d{13}$'),
  company_pdv_number text check (company_pdv_number ~ '^\d{12}$'),
  default_vat_rate numeric(5, 2) not null default 17.00 check (default_vat_rate between 0 and 100),
  -- Highest discount (percent) each role may give on a sale or an order line. Admins have no limit.
  max_discount_prodavac numeric(5, 2) not null default 10.00 check (max_discount_prodavac between 0 and 100),
  max_discount_menadzer numeric(5, 2) not null default 30.00 check (max_discount_menadzer between 0 and 100),
  invoice_due_days integer not null default 15 check (invoice_due_days between 0 and 365),
  updated_at timestamptz not null default now()
);

insert into public.settings (company_name, company_address)
values ('Warehouse Manager d.o.o.', 'Sarajevo');

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;

create policy "Active users can read"
  on public.settings for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins update settings"
  on public.settings for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

revoke insert, update, delete on public.settings from anon, authenticated;
grant update (
  company_name, company_address, company_jib, company_pdv_number, default_vat_rate,
  max_discount_prodavac, max_discount_menadzer, invoice_due_days
) on public.settings to authenticated;

-- ---------------------------------------------------------------------------
-- Money: every amount is numeric(12,2); rounding happens only here
-- ---------------------------------------------------------------------------

-- Half away from zero to 2 decimals (PostgreSQL's numeric round). src/lib/money.ts mirrors this for previews.
create function private.round_money(amount numeric)
returns numeric(12, 2)
language sql
immutable
parallel safe
set search_path = ''
as $$
  select round(amount, 2)::numeric(12, 2)
$$;

-- Amounts of one document line. Net = quantity × net unit price − discount; VAT is computed per line.
-- Document totals are the sums of the rounded line amounts.
create function private.line_amounts(
  quantity integer,
  unit_price numeric,
  discount_percent numeric,
  vat_rate numeric,
  out net_amount numeric(12, 2),
  out vat_amount numeric(12, 2),
  out gross_amount numeric(12, 2)
)
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    n.net,
    private.round_money(n.net * vat_rate / 100),
    n.net + private.round_money(n.net * vat_rate / 100)
  from (select private.round_money(quantity * unit_price * (1 - discount_percent / 100)) as net) as n
$$;

-- Default VAT rate for new products comes from settings, not from code.
create function private.default_vat_rate()
returns numeric(5, 2)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.default_vat_rate from public.settings as s), 17.00)
$$;

-- Maximum discount for the signed-in user's role.
create function private.max_discount_for_current_user()
returns numeric(5, 2)
language sql
stable
security definer
set search_path = ''
as $$
  select case private.current_app_role()
    when 'admin' then 100.00
    when 'menadzer' then (select s.max_discount_menadzer from public.settings as s)
    when 'prodavac' then (select s.max_discount_prodavac from public.settings as s)
  end
$$;

revoke execute on function private.round_money(numeric) from public;
revoke execute on function private.line_amounts(integer, numeric, numeric, numeric) from public;
revoke execute on function private.default_vat_rate() from public;
revoke execute on function private.max_discount_for_current_user() from public;
-- Used as a column default, so it must be callable by whoever inserts a product.
grant execute on function private.default_vat_rate() to authenticated;
