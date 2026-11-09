-- Phase 3: append-only stock ledger, idempotency keys and gap-free document numbering.

-- ---------------------------------------------------------------------------
-- Stock ledger (inventory_movements)
-- ---------------------------------------------------------------------------

-- New movement types. Old values are mapped: ulaz → prijem, izlaz → izlaz, otpis → korekcija.
alter type public.stock_movement_type rename to stock_movement_type_old;
create type public.stock_movement_type as enum (
  'prijem', 'izlaz', 'rezervacija', 'oslobadjanje', 'korekcija', 'inventura'
);

alter table public.inventory_movements drop constraint inventory_movements_sign_matches_type;
alter table public.inventory_movements
  alter column type type public.stock_movement_type using (
    case type::text when 'ulaz' then 'prijem' when 'izlaz' then 'izlaz' else 'korekcija' end
  )::public.stock_movement_type;
drop type public.stock_movement_type_old;

create type public.stock_source_type as enum ('narudzba', 'pos_prodaja', 'prijem', 'korekcija', 'inventura');

alter table public.inventory_movements rename column quantity_change to on_hand_change;
alter table public.inventory_movements
  add column reserved_change integer not null default 0,
  -- Balances right after the movement. Null only for rows written before the ledger existed.
  add column on_hand_after integer,
  add column reserved_after integer,
  add column source_type public.stock_source_type,
  add column source_id text,
  add column created_by uuid references public.profiles (id) on delete set null,
  add constraint inventory_movements_change_matches_type check (
    case type
      when 'prijem' then on_hand_change > 0 and reserved_change = 0
      when 'izlaz' then on_hand_change < 0 and reserved_change <= 0
      when 'rezervacija' then on_hand_change = 0 and reserved_change > 0
      when 'oslobadjanje' then on_hand_change = 0 and reserved_change < 0
      else on_hand_change <> 0 and reserved_change = 0
    end
  ),
  add constraint inventory_movements_source_check check ((source_type is null) = (source_id is null));

-- The link to the source document replaces order_id (an order is source_type 'narudzba').
drop index public.inventory_movements_order_id_idx;
alter table public.inventory_movements drop column order_id;

-- One movement of each type per product per document: the same document can never be posted twice.
create unique index inventory_movements_source_posting_key
  on public.inventory_movements (source_type, source_id, product_id, type)
  where source_type is not null;
create index inventory_movements_source_idx on public.inventory_movements (source_type, source_id);
create index inventory_movements_created_by_idx on public.inventory_movements (created_by);

-- Append-only: history is never edited or deleted, corrections are new movements.
create function private.prevent_ledger_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Kretanja zaliha se ne mogu mijenjati ni brisati. Unesite korekciju.'
    using errcode = '42501';
end;
$$;

create trigger inventory_movements_append_only
  before update or delete on public.inventory_movements
  for each row execute function private.prevent_ledger_change();

revoke execute on function private.prevent_ledger_change() from public;
revoke insert, update, delete, truncate on public.inventory_movements from anon, authenticated;

-- Writes a ledger row. Callers have already changed the product and pass the new balances.
create function private.record_movement(
  p_product_id text,
  p_type public.stock_movement_type,
  p_on_hand_change integer,
  p_reserved_change integer,
  p_on_hand_after integer,
  p_reserved_after integer,
  p_source_type public.stock_source_type,
  p_source_id text,
  p_reason text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.inventory_movements (
    product_id, type, on_hand_change, reserved_change, on_hand_after, reserved_after,
    source_type, source_id, reason, created_by
  )
  values (
    p_product_id, p_type, p_on_hand_change, p_reserved_change, p_on_hand_after, p_reserved_after,
    p_source_type, p_source_id, p_reason, auth.uid()
  )
$$;

revoke execute on function private.record_movement(
  text, public.stock_movement_type, integer, integer, integer, integer, public.stock_source_type, text, text
) from public;

-- ---------------------------------------------------------------------------
-- Idempotency keys: the same request posted twice is booked once
-- ---------------------------------------------------------------------------

create table public.idempotency_keys (
  key uuid primary key,
  operation text not null,
  result jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idempotency_keys_created_by_idx on public.idempotency_keys (created_by);

-- Internal table: RLS on, no policies, so the API can't read or write it.
alter table public.idempotency_keys enable row level security;
revoke all on public.idempotency_keys from anon, authenticated;

-- Claims a key at the start of a posting. Returns null when the caller should do the work, or the stored
-- result when this key was already used. A concurrent call with the same key waits on the unique index until
-- the first transaction ends, so a double click books once and both calls get the same answer.
create function private.claim_idempotency_key(p_key uuid, p_operation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation text;
  v_result jsonb;
  v_created_by uuid;
begin
  if p_key is null then
    raise exception 'Nedostaje ključ operacije.';
  end if;

  insert into public.idempotency_keys (key, operation, created_by)
  values (p_key, p_operation, auth.uid())
  on conflict (key) do nothing;
  if found then
    return null;
  end if;

  select k.operation, k.result, k.created_by into v_operation, v_result, v_created_by
  from public.idempotency_keys as k
  where k.key = p_key;

  if v_operation <> p_operation or v_created_by is distinct from auth.uid() then
    raise exception 'Ključ operacije je već iskorišten za drugu radnju.';
  end if;
  return v_result;
end;
$$;

create function private.complete_idempotency_key(p_key uuid, p_result jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  update public.idempotency_keys set result = p_result where key = p_key;
  select p_result;
$$;

revoke execute on function private.claim_idempotency_key(uuid, text) from public;
revoke execute on function private.complete_idempotency_key(uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Gap-free document numbers per type and year (invoices, POS receipts)
-- ---------------------------------------------------------------------------

create table public.document_counters (
  doc_type text not null,
  year integer not null,
  last_number integer not null check (last_number > 0),
  primary key (doc_type, year)
);

alter table public.document_counters enable row level security;
revoke all on public.document_counters from anon, authenticated;

-- Increments the counter row and keeps it locked until the transaction ends. A rollback also rolls the
-- counter back, so numbers have no gaps (unlike a sequence, and without the race of max() + 1).
create function private.next_document_number(p_doc_type text, p_year integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.document_counters (doc_type, year, last_number)
  values (p_doc_type, p_year, 1)
  on conflict (doc_type, year) do update set last_number = public.document_counters.last_number + 1
  returning last_number
$$;

revoke execute on function private.next_document_number(text, integer) from public;

-- ---------------------------------------------------------------------------
-- Shared guards for RPC functions
-- ---------------------------------------------------------------------------

-- Raises unless the signed-in, active user has one of the roles.
create function private.require_role(variadic roles public.app_role[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role(variadic roles) then
    raise exception 'Nemate ovlasti za ovu radnju.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function private.require_role(public.app_role[]) from public;
