-- Phase 3: goods receipts, stock corrections and stock counts (inventura). Admins and managers only.

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create sequence public.goods_receipts_id_seq;

create table public.goods_receipts (
  id text primary key default 'PRI-' || nextval('public.goods_receipts_id_seq'),
  supplier_id text references public.suppliers (id) on delete restrict,
  -- The supplier's delivery note or invoice number.
  document_number text not null default '',
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter sequence public.goods_receipts_id_seq owned by public.goods_receipts.id;

create table public.goods_receipt_items (
  receipt_id text not null references public.goods_receipts (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  primary key (receipt_id, product_id)
);

create sequence public.stock_counts_id_seq;

create table public.stock_counts (
  id text primary key default 'POP-' || nextval('public.stock_counts_id_seq'),
  reason text not null check (btrim(reason) <> ''),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter sequence public.stock_counts_id_seq owned by public.stock_counts.id;

create table public.stock_count_items (
  count_id text not null references public.stock_counts (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  expected_quantity integer not null,
  counted_quantity integer not null check (counted_quantity >= 0),
  primary key (count_id, product_id)
);

create index goods_receipts_supplier_id_idx on public.goods_receipts (supplier_id);
create index goods_receipts_created_at_idx on public.goods_receipts (created_at desc);
create index goods_receipts_created_by_idx on public.goods_receipts (created_by);
create index goods_receipt_items_product_id_idx on public.goods_receipt_items (product_id);
create index stock_counts_created_by_idx on public.stock_counts (created_by);
create index stock_count_items_product_id_idx on public.stock_count_items (product_id);

-- Readable by every active user; written only by the RPC functions below.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['goods_receipts', 'goods_receipt_items', 'stock_counts', 'stock_count_items']
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
-- RPC functions
-- ---------------------------------------------------------------------------

-- p_items: [{ "product_id": "PRD-1021", "quantity": 10, "unit_cost": 980 }]
create function public.receive_stock(
  p_idempotency_key uuid,
  p_supplier_id text,
  p_document_number text,
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
  v_receipt_id text;
  v_item record;
  v_product public.products;
begin
  perform private.require_role('admin', 'menadzer');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'receive_stock');
  if v_existing is not null then
    return v_existing;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Dodajte barem jednu stavku prijema.';
  end if;

  insert into public.goods_receipts (supplier_id, document_number, note, created_by)
  values (nullif(p_supplier_id, ''), coalesce(btrim(p_document_number), ''), coalesce(btrim(p_note), ''), auth.uid())
  returning id into v_receipt_id;

  -- The same product on several lines is merged into one line.
  for v_item in
    select item.product_id, sum(item.quantity)::integer as quantity, min(item.unit_cost) as unit_cost,
      count(distinct item.unit_cost) > 1 as mixed_cost,
      bool_or(item.quantity is null or item.quantity <= 0) as has_invalid_quantity
    from jsonb_to_recordset(p_items) as item (product_id text, quantity integer, unit_cost numeric)
    group by item.product_id
    order by item.product_id
  loop
    if v_item.mixed_cost then
      raise exception 'Isti proizvod je naveden više puta s različitom nabavnom cijenom.';
    end if;
    if v_item.has_invalid_quantity then
      raise exception 'Količina prijema mora biti cijeli broj veći od 0.';
    end if;
    if v_item.unit_cost is null or v_item.unit_cost < 0 then
      raise exception 'Nabavna cijena ne može biti negativna.';
    end if;

    insert into public.goods_receipt_items (receipt_id, product_id, quantity, unit_cost)
    values (v_receipt_id, v_item.product_id, v_item.quantity, private.round_money(v_item.unit_cost));

    update public.products set quantity = quantity + v_item.quantity
    where id = v_item.product_id
    returning * into v_product;
    if not found then
      raise exception 'Proizvod % ne postoji.', v_item.product_id;
    end if;

    perform private.record_movement(
      v_item.product_id, 'prijem', v_item.quantity, 0, v_product.quantity, v_product.reserved_quantity,
      'prijem', v_receipt_id, 'Prijem robe ' || v_receipt_id
    );
  end loop;

  return private.complete_idempotency_key(
    p_idempotency_key, jsonb_build_object('id', v_receipt_id)
  );
end;
$$;

-- Corrects the on-hand quantity of one product (damage, loss, found goods). The reason is mandatory and
-- stock can't drop below what confirmed orders have reserved.
create function public.adjust_stock(
  p_idempotency_key uuid,
  p_product_id text,
  p_quantity_change integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_product public.products;
begin
  perform private.require_role('admin', 'menadzer');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'adjust_stock');
  if v_existing is not null then
    return v_existing;
  end if;

  if p_quantity_change is null or p_quantity_change = 0 then
    raise exception 'Promjena količine ne može biti 0.';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Razlog korekcije je obavezan.';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Proizvod ne postoji.';
  end if;
  if v_product.quantity + p_quantity_change < v_product.reserved_quantity then
    raise exception 'Stanje ne može biti manje od rezervisane količine (%).', v_product.reserved_quantity;
  end if;

  update public.products set quantity = quantity + p_quantity_change
  where id = p_product_id
  returning * into v_product;

  -- The correction has no separate document; its idempotency key identifies it in the ledger.
  perform private.record_movement(
    p_product_id, 'korekcija', p_quantity_change, 0, v_product.quantity, v_product.reserved_quantity,
    'korekcija', p_idempotency_key::text, btrim(p_reason)
  );

  return private.complete_idempotency_key(
    p_idempotency_key,
    jsonb_build_object('product_id', p_product_id, 'quantity', v_product.quantity, 'available', v_product.available_quantity)
  );
end;
$$;

-- Stock count: sets each counted product to the counted quantity and books the differences.
-- p_items: [{ "product_id": "PRD-1021", "counted_quantity": 17 }]
create function public.stock_count(p_idempotency_key uuid, p_reason text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_count_id text;
  v_item record;
  v_product public.products;
  v_difference integer;
  v_changed integer := 0;
begin
  perform private.require_role('admin', 'menadzer');
  v_existing := private.claim_idempotency_key(p_idempotency_key, 'stock_count');
  if v_existing is not null then
    return v_existing;
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Razlog inventure je obavezan.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Dodajte barem jedan proizvod u inventuru.';
  end if;

  insert into public.stock_counts (reason, created_by)
  values (btrim(p_reason), auth.uid())
  returning id into v_count_id;

  for v_item in
    select item.product_id, min(item.counted_quantity) as counted_quantity,
      count(distinct item.counted_quantity) > 1 as conflicting
    from jsonb_to_recordset(p_items) as item (product_id text, counted_quantity integer)
    group by item.product_id
    order by item.product_id
  loop
    if v_item.conflicting then
      raise exception 'Proizvod % je naveden više puta s različitom količinom.', v_item.product_id;
    end if;
    if v_item.counted_quantity is null or v_item.counted_quantity < 0 then
      raise exception 'Prebrojana količina mora biti 0 ili više.';
    end if;

    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then
      raise exception 'Proizvod % ne postoji.', v_item.product_id;
    end if;
    if v_item.counted_quantity < v_product.reserved_quantity then
      raise exception 'Prebrojana količina za % je manja od rezervisane (%).', v_product.name, v_product.reserved_quantity;
    end if;

    insert into public.stock_count_items (count_id, product_id, expected_quantity, counted_quantity)
    values (v_count_id, v_item.product_id, v_product.quantity, v_item.counted_quantity);

    v_difference := v_item.counted_quantity - v_product.quantity;
    if v_difference <> 0 then
      update public.products set quantity = v_item.counted_quantity
      where id = v_item.product_id
      returning * into v_product;

      perform private.record_movement(
        v_item.product_id, 'inventura', v_difference, 0, v_product.quantity, v_product.reserved_quantity,
        'inventura', v_count_id, btrim(p_reason)
      );
      v_changed := v_changed + 1;
    end if;
  end loop;

  return private.complete_idempotency_key(
    p_idempotency_key, jsonb_build_object('id', v_count_id, 'changed_products', v_changed)
  );
end;
$$;

revoke execute on function public.receive_stock(uuid, text, text, text, jsonb) from public, anon;
revoke execute on function public.adjust_stock(uuid, text, integer, text) from public, anon;
revoke execute on function public.stock_count(uuid, text, jsonb) from public, anon;
grant execute on function public.receive_stock(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.adjust_stock(uuid, text, integer, text) to authenticated;
grant execute on function public.stock_count(uuid, text, jsonb) to authenticated;
