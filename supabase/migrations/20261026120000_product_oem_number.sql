alter table public.products
  add column oem_number text check (oem_number is null or btrim(oem_number) <> '');

create index products_oem_number_trgm_idx
  on public.products using gin (oem_number extensions.gin_trgm_ops)
  where oem_number is not null;

grant select (oem_number) on public.products to authenticated;
grant insert (oem_number) on public.products to authenticated;
grant update (oem_number) on public.products to authenticated;
