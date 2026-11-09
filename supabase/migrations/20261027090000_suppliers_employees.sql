-- Suppliers as real master data (JIB, PDV broj, address, contact), and the staff directory from user accounts.
-- Policies and grants for suppliers already exist: staff read and write them (auth_profiles_roles.sql, rbac.sql).
-- Deleting a supplier with goods receipts or purchasing documents is blocked by their ON DELETE RESTRICT keys.

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------

alter table public.suppliers
  -- JIB: 13-digit identification number of a company in BiH; PDV broj: 12 digits (same rules as customers).
  add column jib text check (jib ~ '^\d{13}$'),
  add column pdv_number text check (pdv_number ~ '^\d{12}$'),
  add column address text not null default '' check (char_length(address) <= 200),
  add column city text not null default '' check (char_length(city) <= 100),
  add column phone text not null default '' check (char_length(phone) <= 50),
  add column email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column note text not null default '' check (char_length(note) <= 1000),
  add column updated_at timestamptz not null default now();

create unique index suppliers_jib_key on public.suppliers (jib) where jib is not null;

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Employees: every user account with its role and status
-- ---------------------------------------------------------------------------

-- Profiles are readable only by admins (RLS), but managers may see who works in the company (employees.read).
-- Inactive accounts are listed too, after the active ones.
create function public.employee_directory()
returns table (id uuid, full_name text, email text, role public.app_role, is_active boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'menadzer');
  return query
    select p.id, p.full_name, p.email, p.role, p.is_active
    from public.profiles as p
    order by p.is_active desc, nullif(p.full_name, '') nulls last, p.email;
end;
$$;

revoke execute on function public.employee_directory() from public, anon;
grant execute on function public.employee_directory() to authenticated;
