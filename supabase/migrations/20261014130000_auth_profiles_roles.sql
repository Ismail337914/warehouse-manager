-- Phase 2: user profiles, roles and role-based Row Level Security.
--
-- Roles live in public.profiles (one row per auth.users row). Only an admin can change
-- another user's role or deactivate them, and nobody can change their own role.
-- Helper functions sit in the "private" schema, which the Supabase API does not expose.

-- ---------------------------------------------------------------------------
-- Function privileges: nothing new is callable by PUBLIC or anon unless granted explicitly
-- ---------------------------------------------------------------------------

alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.refresh_order_total() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'menadzer', 'prodavac');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'prodavac',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS policies and, from Phase 3, by RPC functions)
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Role of the signed-in user, or null when signed out or deactivated.
create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid() and p.is_active
$$;

create function private.has_role(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = any (roles), false)
$$;

revoke execute on function private.current_app_role() from public;
revoke execute on function private.has_role(public.app_role[]) from public;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.has_role(public.app_role[]) to authenticated;

-- A profile is created for every new auth user. The role comes from app_metadata, which only
-- the service role (admin API) can set; users cannot pick their own role.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'prodavac')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- Nobody can change their own role or deactivate themselves (an admin can't lock themselves out).
create function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id = auth.uid() and (new.role <> old.role or new.is_active <> old.is_active) then
    raise exception 'Ne možete mijenjati vlastitu ulogu ili status.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

revoke execute on function private.handle_new_user() from public;
revoke execute on function private.handle_user_email_change() from public;
revoke execute on function private.guard_profile_update() from public;

-- Only these columns can ever be changed through the API.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, role, is_active) on public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "Users see their own profile, admins see all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_role('admin')));

create policy "Admins update profiles"
  on public.profiles for update to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

-- ---------------------------------------------------------------------------
-- Replace "every signed-in user has full access" with role-based policies
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories', 'products', 'customers', 'orders', 'order_items', 'invoices',
    'inventory_movements', 'employees', 'reservations', 'suppliers', 'procurement_docs'
  ]
  loop
    execute format('drop policy "Signed-in users have full access" on public.%I', table_name);

    -- Every active user can read business data; deactivated users and anon see nothing.
    execute format(
      'create policy "Active users can read" on public.%I
         for select to authenticated
         using ((select private.current_app_role()) is not null)',
      table_name
    );
  end loop;
end;
$$;

-- Master data managed by admins and managers.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['categories', 'products', 'suppliers']
  loop
    execute format(
      'create policy "Admins and managers insert" on public.%I
         for insert to authenticated
         with check ((select private.has_role(''admin'', ''menadzer'')))',
      table_name
    );
    execute format(
      'create policy "Admins and managers update" on public.%I
         for update to authenticated
         using ((select private.has_role(''admin'', ''menadzer'')))
         with check ((select private.has_role(''admin'', ''menadzer'')))',
      table_name
    );
    execute format(
      'create policy "Admins and managers delete" on public.%I
         for delete to authenticated
         using ((select private.has_role(''admin'', ''menadzer'')))',
      table_name
    );
  end loop;
end;
$$;

-- Stock levels only change through stock operations (Phase 3 RPC functions), never by editing a product.
revoke insert, update on public.products from authenticated;
grant insert (sku, name, category_id, description, buy_price, sell_price, min_quantity, unit, location, status)
  on public.products to authenticated;
grant update (sku, name, category_id, description, buy_price, sell_price, min_quantity, unit, location, status)
  on public.products to authenticated;

-- Every role works with customers; only admins delete them.
create policy "Active users insert customers"
  on public.customers for insert to authenticated
  with check ((select private.current_app_role()) is not null);

create policy "Active users update customers"
  on public.customers for update to authenticated
  using ((select private.current_app_role()) is not null)
  with check ((select private.current_app_role()) is not null);

create policy "Admins delete customers"
  on public.customers for delete to authenticated
  using ((select private.has_role('admin')));

-- Staff list is maintained by admins.
create policy "Admins manage employees"
  on public.employees for all to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));

-- Documents (orders, order_items, invoices, inventory_movements, reservations, procurement_docs)
-- get no write policies: from Phase 3 they change only through RPC functions in one transaction.
