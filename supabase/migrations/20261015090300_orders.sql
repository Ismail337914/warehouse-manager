-- Phase 3: order workflow nacrt → potvrđena (reserves stock) → isporučena (removes stock) → fakturisana,
-- plus otkazana. Every change happens in one RPC transaction; the client never sends prices or totals.

-- ---------------------------------------------------------------------------
-- Statuses
-- ---------------------------------------------------------------------------

-- Old statuses are mapped: nova → nacrt, u obradi / spremna za isporuku → potvrđena, završena → isporučena.
alter type public.order_status rename to order_status_old;
create type public.order_status as enum ('nacrt', 'potvrđena', 'isporučena', 'fakturisana', 'otkazana');

alter table public.orders alter column status drop default;
alter table public.orders
  alter column status type public.order_status using (
    case status::text
      when 'nova' then 'nacrt'
      when 'završena' then 'isporučena'
      when 'otkazana' then 'otkazana'
      else 'potvrđena'
    end
  )::public.order_status;
alter table public.orders alter column status set default 'nacrt';
drop type public.order_status_old;

-- Allowed transitions. src/lib/order-status.ts mirrors this table for the UI.
create function private.order_transition_allowed(from_status public.order_status, to_status public.order_status)
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
    ('isporučena', 'fakturisana')
  )
$$;

-- security definer: it must call the private transition table whoever updates the row.
create function private.guard_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not private.order_transition_allowed(old.status, new.status) then
    raise exception 'Narudžba % ne može preći iz statusa „%“ u „%“.', old.number, old.status, new.status;
  end if;
  return new;
end;
$$;

create trigger orders_guard_status
  before update of status on public.orders
  for each row execute function private.guard_order_status();

-- ---------------------------------------------------------------------------
-- Amounts: net (bez PDV-a), VAT and gross per line and per order
-- ---------------------------------------------------------------------------

alter table public.orders
  add column subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  add column vat_total numeric(12, 2) not null default 0 check (vat_total >= 0),
  add column created_by uuid references public.profiles (id) on delete set null,
  add column confirmed_at timestamptz,
  add column delivered_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancel_reason text;

comment on column public.orders.total is 'Ukupno s PDV-om (subtotal + vat_total)';

create index orders_created_by_idx on public.orders (created_by);

alter table public.order_items
  add column discount_percent numeric(5, 2) not null default 0 check (discount_percent between 0 and 100),
  add column vat_rate numeric(5, 2) not null default 17.00 check (vat_rate between 0 and 100),
  add column net_amount numeric(12, 2) not null default 0 check (net_amount >= 0),
  add column vat_amount numeric(12, 2) not null default 0 check (vat_amount >= 0),
  add column gross_amount numeric(12, 2) not null default 0 check (gross_amount >= 0);

comment on column public.order_items.unit_price is 'Prodajna cijena bez PDV-a u trenutku narudžbe';

-- Order totals are the sums of the rounded line amounts.
create or replace function public.refresh_order_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.orders as o
  set subtotal = t.net, vat_total = t.vat, total = t.gross
  from (
    select ids.id,
      coalesce(sum(i.net_amount), 0) as net,
      coalesce(sum(i.vat_amount), 0) as vat,
      coalesce(sum(i.gross_amount), 0) as gross
    from (select new.order_id as id union select old.order_id) as ids
    left join public.order_items as i on i.order_id = ids.id
    where ids.id is not null
    group by ids.id
  ) as t
  where o.id = t.id;

  return null;
end;
$$;

-- Lines can change only while the order is a draft.
create function private.guard_order_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.order_status;
begin
  select o.status into v_status
  from public.orders as o
  where o.id = coalesce(new.order_id, old.order_id);

  if v_status is not null and v_status <> 'nacrt' then
    raise exception 'Stavke se mogu mijenjati samo dok je narudžba u nacrtu.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger order_items_guard_draft
  before insert or update or delete on public.order_items
  for each row execute function private.guard_order_items();

revoke execute on function private.order_transition_allowed(public.order_status, public.order_status) from public;
revoke execute on function private.guard_order_status() from public;
revoke execute on function private.guard_order_items() from public;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Validates draft lines and writes them with prices and VAT taken from the products table.
-- p_items: [{ "product_id": "PRD-1021", "quantity": 2, "discount_percent": 0 }]. The same product on several
-- lines is merged into one line.
create function private.write_order_items(p_order_id text, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_discount numeric := private.max_discount_for_current_user();
  v_line record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Dodajte barem jednu stavku.';
  end if;

  for v_line in
    select
      item.product_id,
      sum(item.quantity)::integer as quantity,
      min(item.discount_percent) as min_discount,
      max(item.discount_percent) as discount_percent,
      bool_or(item.quantity is null or item.quantity <= 0) as has_invalid_quantity
    from jsonb_to_recordset(p_items) as item (product_id text, quantity integer, discount_percent numeric)
    group by item.product_id
    order by item.product_id
  loop
    if v_line.product_id is null then
      raise exception 'Odaberite proizvod za svaku stavku.';
    end if;
    if v_line.has_invalid_quantity then
      raise exception 'Količina svake stavke mora biti cijeli broj veći od 0.';
    end if;
    if v_line.min_discount is distinct from v_line.discount_percent then
      raise exception 'Isti proizvod je naveden više puta s različitim popustom.';
    end if;
    if coalesce(v_line.discount_percent, 0) < 0 or coalesce(v_line.discount_percent, 0) > v_max_discount then
      raise exception 'Popust može biti najviše % %%.', v_max_discount;
    end if;

    insert into public.order_items (
      order_id, product_id, quantity, unit_price, discount_percent, vat_rate, net_amount, vat_amount, gross_amount
    )
    select p_order_id, p.id, v_line.quantity, p.sell_price, coalesce(v_line.discount_percent, 0), p.vat_rate,
      a.net_amount, a.vat_amount, a.gross_amount
    from public.products as p
    cross join lateral private.line_amounts(v_line.quantity, p.sell_price, coalesce(v_line.discount_percent, 0), p.vat_rate) as a
    where p.id = v_line.product_id and p.status = 'active';

    if not found then
      raise exception 'Proizvod % ne postoji ili nije aktivan.', v_line.product_id;
    end if;
  end loop;
end;
$$;

-- Locks the order row for the rest of the transaction and returns it.
create function private.lock_order(p_order_id text)
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
  return v_order;
end;
$$;

create function private.order_result(p_order_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'status', o.status,
    'subtotal', o.subtotal, 'vat_total', o.vat_total, 'total', o.total
  )
  from public.orders as o
  where o.id = p_order_id
$$;

revoke execute on function private.write_order_items(text, jsonb) from public;
revoke execute on function private.lock_order(text) from public;
revoke execute on function private.order_result(text) from public;

-- ---------------------------------------------------------------------------
-- RPC functions (called by Server Actions as the signed-in user)
-- ---------------------------------------------------------------------------

create function public.create_order(
  p_idempotency_key uuid,
  p_customer_id text,
  p_source public.order_source,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_order_id text;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'create_order');
  if v_existing is not null then
    return v_existing;
  end if;

  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'Odaberite postojećeg kupca.';
  end if;

  insert into public.orders (customer_id, source, note, status, created_by)
  values (p_customer_id, p_source, coalesce(btrim(p_note), ''), 'nacrt', auth.uid())
  returning id into v_order_id;

  perform private.write_order_items(v_order_id, p_items);

  return private.complete_idempotency_key(p_idempotency_key, private.order_result(v_order_id));
end;
$$;

-- Replaces customer, source, note and all lines of a draft. Repeating it gives the same result, so it needs
-- no idempotency key.
create function public.update_order_draft(
  p_order_id text,
  p_customer_id text,
  p_source public.order_source,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');
  v_order := private.lock_order(p_order_id);
  if v_order.status <> 'nacrt' then
    raise exception 'Narudžba % više nije nacrt i ne može se mijenjati.', v_order.number;
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'Odaberite postojećeg kupca.';
  end if;

  update public.orders
  set customer_id = p_customer_id, source = p_source, note = coalesce(btrim(p_note), '')
  where id = p_order_id;

  delete from public.order_items where order_id = p_order_id;
  perform private.write_order_items(p_order_id, p_items);

  return private.order_result(p_order_id);
end;
$$;

-- Reserves stock for every line. The conditional UPDATE (available >= quantity) makes concurrent
-- confirmations safe: two orders can never reserve the same last pieces. Lines are processed in
-- product_id order so concurrent transactions lock products in the same order (no deadlocks).
create function public.confirm_order(p_idempotency_key uuid, p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_order public.orders;
  v_item record;
  v_product public.products;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'confirm_order');
  if v_existing is not null then
    return v_existing;
  end if;

  v_order := private.lock_order(p_order_id);
  if v_order.status <> 'nacrt' then
    raise exception 'Narudžba % ne može preći iz statusa „%“ u „potvrđena“.', v_order.number, v_order.status;
  end if;

  for v_item in
    select i.product_id, i.quantity from public.order_items as i
    where i.order_id = p_order_id
    order by i.product_id
  loop
    update public.products
    set reserved_quantity = reserved_quantity + v_item.quantity
    where id = v_item.product_id and quantity - reserved_quantity >= v_item.quantity
    returning * into v_product;

    if not found then
      select * into v_product from public.products where id = v_item.product_id;
      raise exception 'Nedovoljno dostupno: % (dostupno %, traženo %).',
        v_product.name, v_product.available_quantity, v_item.quantity;
    end if;

    perform private.record_movement(
      v_item.product_id, 'rezervacija', 0, v_item.quantity, v_product.quantity, v_product.reserved_quantity,
      'narudzba', p_order_id, 'Rezervacija za narudžbu ' || v_order.number
    );
  end loop;

  update public.orders set status = 'potvrđena', confirmed_at = now() where id = p_order_id;

  return private.complete_idempotency_key(p_idempotency_key, private.order_result(p_order_id));
end;
$$;

create function public.cancel_order(p_idempotency_key uuid, p_order_id text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_order public.orders;
  v_item record;
  v_product public.products;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'cancel_order');
  if v_existing is not null then
    return v_existing;
  end if;

  v_order := private.lock_order(p_order_id);
  if v_order.status not in ('nacrt', 'potvrđena') then
    raise exception 'Narudžba % ne može preći iz statusa „%“ u „otkazana“.', v_order.number, v_order.status;
  end if;

  -- A confirmed order releases its reservation.
  if v_order.status = 'potvrđena' then
    for v_item in
      select i.product_id, i.quantity from public.order_items as i
      where i.order_id = p_order_id
      order by i.product_id
    loop
      update public.products
      set reserved_quantity = reserved_quantity - v_item.quantity
      where id = v_item.product_id
      returning * into v_product;

      perform private.record_movement(
        v_item.product_id, 'oslobadjanje', 0, -v_item.quantity, v_product.quantity, v_product.reserved_quantity,
        'narudzba', p_order_id, 'Otkazana narudžba ' || v_order.number
      );
    end loop;
  end if;

  update public.orders
  set status = 'otkazana', cancelled_at = now(), cancel_reason = nullif(btrim(p_reason), '')
  where id = p_order_id;

  return private.complete_idempotency_key(p_idempotency_key, private.order_result(p_order_id));
end;
$$;

-- Goods leave the warehouse: on-hand and reserved stock both go down by the reserved quantity.
create function public.deliver_order(p_idempotency_key uuid, p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_order public.orders;
  v_item record;
  v_product public.products;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'deliver_order');
  if v_existing is not null then
    return v_existing;
  end if;

  v_order := private.lock_order(p_order_id);
  if v_order.status <> 'potvrđena' then
    raise exception 'Narudžba % ne može preći iz statusa „%“ u „isporučena“.', v_order.number, v_order.status;
  end if;

  for v_item in
    select i.product_id, i.quantity from public.order_items as i
    where i.order_id = p_order_id
    order by i.product_id
  loop
    update public.products
    set quantity = quantity - v_item.quantity, reserved_quantity = reserved_quantity - v_item.quantity
    where id = v_item.product_id
    returning * into v_product;

    perform private.record_movement(
      v_item.product_id, 'izlaz', -v_item.quantity, -v_item.quantity, v_product.quantity, v_product.reserved_quantity,
      'narudzba', p_order_id, 'Isporuka narudžbe ' || v_order.number
    );
  end loop;

  update public.orders set status = 'isporučena', delivered_at = now() where id = p_order_id;

  return private.complete_idempotency_key(p_idempotency_key, private.order_result(p_order_id));
end;
$$;

revoke execute on function public.create_order(uuid, text, public.order_source, text, jsonb) from public, anon;
revoke execute on function public.update_order_draft(text, text, public.order_source, text, jsonb) from public, anon;
revoke execute on function public.confirm_order(uuid, text) from public, anon;
revoke execute on function public.cancel_order(uuid, text, text) from public, anon;
revoke execute on function public.deliver_order(uuid, text) from public, anon;
grant execute on function public.create_order(uuid, text, public.order_source, text, jsonb) to authenticated;
grant execute on function public.update_order_draft(text, text, public.order_source, text, jsonb) to authenticated;
grant execute on function public.confirm_order(uuid, text) to authenticated;
grant execute on function public.cancel_order(uuid, text, text) to authenticated;
grant execute on function public.deliver_order(uuid, text) to authenticated;
