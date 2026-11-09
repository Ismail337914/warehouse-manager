create type public.listing_status as enum (
  'nacrt',
  'spreman',
  'objavljen',
  'pauziran',
  'prodat',
  'potrebna_izmjena'
);

create table public.listings (
  id bigint generated always as identity primary key,
  product_id text not null references public.products (id) on delete restrict,
  channel text not null check (channel in ('olx', 'web', 'viber', 'other')),
  external_id text not null default '',
  url text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  status public.listing_status not null default 'nacrt',
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_product_id_idx on public.listings (product_id);
create index listings_status_updated_at_idx on public.listings (status, updated_at desc);
create unique index listings_external_reference_key on public.listings (channel, external_id)
  where external_id <> '';

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

alter table public.listings enable row level security;

create policy "Staff can read listings" on public.listings
  for select to authenticated using ((select private.is_staff()));
create policy "Staff can create listings" on public.listings
  for insert to authenticated with check ((select private.is_staff()) and created_by = (select auth.uid()));
create policy "Staff can update listings" on public.listings
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

revoke all on public.listings from anon, authenticated;
grant select on public.listings to authenticated;
grant insert (product_id, channel, external_id, url, price, status) on public.listings to authenticated;
grant update (product_id, channel, external_id, url, price, status) on public.listings to authenticated;
grant usage, select on sequence public.listings_id_seq to authenticated;
revoke delete, truncate on public.listings from anon, authenticated;

create function private.audit_listings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'create' else 'update' end,
    'listing',
    new.id::text,
    jsonb_build_object(
      'old', case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
      'new', to_jsonb(new)
    )
  );
  return new;
end;
$$;

create trigger listings_audit
  after insert or update on public.listings
  for each row execute function private.audit_listings();

revoke execute on function private.audit_listings() from public, anon, authenticated;
