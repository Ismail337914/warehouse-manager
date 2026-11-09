-- Categories with the number of products in each, for Lager → Kategorije (a category with products can't be
-- deleted). Counted in the database: PostgREST aggregates (`products(count)`) are disabled on Supabase by default.
-- security_invoker: the caller's own RLS applies to both tables. count(p.id) instead of count(*), because the
-- products table has column-level SELECT grants (purchase prices are hidden).

create view public.category_list
with (security_invoker = true)
as
select
  c.id,
  c.name,
  (select count(p.id) from public.products as p where p.category_id = c.id)::integer as product_count
from public.categories as c;

revoke all on public.category_list from anon;
grant select on public.category_list to authenticated;
