revoke all on public.listings from anon, authenticated;

grant select on public.listings to authenticated;
grant insert (product_id, channel, external_id, url, price, status) on public.listings to authenticated;
grant update (product_id, channel, external_id, url, price, status) on public.listings to authenticated;
grant usage, select on sequence public.listings_id_seq to authenticated;
