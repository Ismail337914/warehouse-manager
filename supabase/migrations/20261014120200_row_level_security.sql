-- Row Level Security.
--
-- Supabase exposes every table in "public" through its API, so RLS must be on.
-- Without a policy the public "anon" key can read and write nothing.
-- For now every signed-in user (an employee) has full access. Narrow this per role
-- (e.g. only managers may delete) once authentication is added.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories',
    'products',
    'customers',
    'orders',
    'order_items',
    'invoices',
    'inventory_movements',
    'employees',
    'reservations',
    'suppliers',
    'procurement_docs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy "Signed-in users have full access" on public.%I
         for all to authenticated using (true) with check (true)',
      table_name
    );
  end loop;
end;
$$;
