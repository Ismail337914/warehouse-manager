-- Fictional demo data for local development and the tests (never applied to the cloud project).
-- Supabase runs this file after the migrations on `supabase db reset`.

-- Test users, one per role. Local development only; password for all three: Demo1234
-- The on_auth_user_created trigger creates their profiles with the role from app_metadata.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Demo1234', extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', u.role),
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@demo.ba', 'admin', 'Admin Demo'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'menadzer@demo.ba', 'menadzer', 'Menadžer Demo'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'prodavac@demo.ba', 'prodavac', 'Prodavač Demo')
) as u (id, email, role, full_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users as u
where u.email like '%@demo.ba';

insert into public.categories (name) values
  ('Elektronika'),
  ('Potrošni materijal'),
  ('Namještaj'),
  ('Laptop pristup'),
  ('Sigurnost');

-- Products start at 0 pieces: stock arrives through receive_stock below, so the ledger explains every piece.
-- vat_rate comes from settings (17 %); prices are net (bez PDV-a).
insert into public.products (
  id, sku, barcode, oem_number, name, category_id, description, buy_price, sell_price,
  min_quantity, unit, location, status, created_at, updated_at
)
select v.id, v.sku, v.barcode, v.oem_number, v.name, c.id, v.description, v.buy_price, v.sell_price,
  v.min_quantity, v.unit, v.location, v.status::public.product_status,
  v.created_at::timestamptz, v.updated_at::timestamptz
from (values
  ('PRD-1021', 'SKU-1021', '3870000010214', 'OEM-LTP-14', 'Laptop Pro 14', 'Elektronika', 'Poslovni laptop za ured i administraciju.', 980, 1299, 5, 'kom', 'S-01-A', 'active', '2024-01-14', '2024-10-02'),
  ('PRD-1045', 'SKU-1045', '3870000010450', 'OEM-MON-27', 'Monitor 27" 4K', 'Elektronika', 'Monitor za dizajn i produkciju.', 320, 449, 6, 'kom', 'S-02-B', 'active', '2024-02-02', '2024-10-10'),
  ('PRD-2048', 'SKU-2048', '3870000020480', 'OEM-INK-2048', 'Tinta za štampač', 'Potrošni materijal', 'Originalna tinta za poslovni laser printer.', 42, 58, 10, 'pak', 'S-05-C', 'active', '2024-03-09', '2024-10-08'),
  ('PRD-3051', 'SKU-3051', '3870000030519', 'OEM-DESK-3051', 'Kancelarijski stol', 'Namještaj', 'Modularni stol za poslovni prostor.', 210, 299, 5, 'kom', 'S-03-D', 'active', '2024-01-26', '2024-10-04'),
  ('PRD-4030', 'SKU-4030', '3870000040303', 'OEM-DOCK-4030', 'USB-C docking', 'Laptop pristup', 'Docking station za poslovne laptopove.', 88, 139, 4, 'kom', 'S-04-A', 'active', '2024-04-18', '2024-10-03'),
  ('PRD-5102', 'SKU-5102', '3870000051026', 'OEM-CHAIR-5102', 'Službeni stolac', 'Namještaj', 'Stolica sa podesivom visinom i potporom za leđa.', 95, 149, 6, 'kom', 'S-03-E', 'active', '2024-05-20', '2024-10-09'),
  ('PRD-7781', 'SKU-7781', '3870000077811', 'OEM-CAM-4MP', 'IP kamera 4MP', 'Sigurnost', 'Kamera za poslovni parking i ulaz.', 170, 259, 3, 'kom', 'S-06-A', 'active', '2024-06-11', '2024-10-02'),
  ('PRD-8120', 'SKU-8120', '3870000081207', 'OEM-SET-8120', 'Kancelarijski set', 'Potrošni materijal', 'Set olovki, bilježnica i pribor za ured.', 18, 29, 8, 'set', 'S-05-A', 'inactive', '2023-12-10', '2024-08-16')
) as v (id, sku, barcode, oem_number, name, category, description, buy_price, sell_price, min_quantity, unit, location, status, created_at, updated_at)
join public.categories as c on c.name = v.category;

insert into public.customers (id, name, customer_type, jib, pdv_number, phone, email, address, city, notes, created_at) values
  ('CUS-1001', 'AutoServis Ciklus d.o.o.', 'pravno', '4200000000017', '200000000017', '+387 61 223 445', 'info@ciklus.ba', 'Vojvode Misica 17', 'Sarajevo', 'Redovni poslovni kupac, dostava na adresu poslovnog objekta.', '2024-06-01'),
  ('CUS-1002', 'Nela Hadžić', 'fizicko', null, null, '+387 62 118 990', 'nela.h@gmail.com', 'Alipašina 24', 'Sarajevo', 'Kupuje kancelarijski materijal i dodatnu opremu.', '2024-03-23'),
  ('CUS-1003', 'Mediatron BH', 'pravno', '4200000000025', null, '+387 33 555 888', 'office@mediatron.ba', 'Bulevar Mladih 3', 'Tuzla', 'Višekratni narudžbenik i servisna podrška.', '2024-01-15'),
  ('CUS-1004', 'Džemila Alić', 'fizicko', null, null, '+387 61 445 667', 'dzemila@studio.ba', 'Rimska 7', 'Mostar', 'Fokus na monitor i laptop dodatke.', '2024-09-16');

insert into public.suppliers (id, name) values
  ('SUP-1', 'TechNord d.o.o.'),
  ('SUP-2', 'Office Line');

-- Move ID sequences past the seeded IDs: the next product is PRD-8121, the first order created below SO-1024.
select setval('public.products_id_seq', (select max(substring(id from 5)::int) from public.products));
select setval('public.customers_id_seq', (select max(substring(id from 5)::int) from public.customers));
select setval('public.suppliers_id_seq', (select max(substring(id from 5)::int) from public.suppliers));
select setval('public.orders_id_seq', 1023);
select setval('public.orders_number_seq', 1023);

-- Stock and orders go through the same RPC functions the app uses (acting as the seeded admin), so
-- quantities, reservations and the ledger are consistent from the start.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated"}', false);

insert into public.listings (product_id, channel, external_id, url, price, status) values
  ('PRD-1021', 'olx', '', '', 1299, 'nacrt'),
  ('PRD-7781', 'olx', '', '', 259, 'potrebna_izmjena');

select public.receive_stock(gen_random_uuid(), 'SUP-1', 'POČETNO-STANJE', 'Početno stanje lagera', '[
  {"product_id": "PRD-1021", "quantity": 18, "unit_cost": 980},
  {"product_id": "PRD-1045", "quantity": 3, "unit_cost": 320},
  {"product_id": "PRD-2048", "quantity": 34, "unit_cost": 42},
  {"product_id": "PRD-3051", "quantity": 11, "unit_cost": 210},
  {"product_id": "PRD-4030", "quantity": 8, "unit_cost": 88},
  {"product_id": "PRD-5102", "quantity": 2, "unit_cost": 95},
  {"product_id": "PRD-7781", "quantity": 7, "unit_cost": 170},
  {"product_id": "PRD-8120", "quantity": 26, "unit_cost": 18}
]');

-- SO-1024 isporučena, SO-1025 potvrđena (rezervisano), SO-1026 nacrt, SO-1027 potvrđena (rezervisano).
do $$
declare
  v_order jsonb;
begin
  v_order := public.create_order(gen_random_uuid(), 'CUS-1001', 'web', 'Isporuka u poslovni prostor.',
    '[{"product_id": "PRD-1021", "quantity": 2}, {"product_id": "PRD-4030", "quantity": 1}]');
  perform public.confirm_order(gen_random_uuid(), v_order ->> 'id');
  perform public.deliver_order(gen_random_uuid(), v_order ->> 'id');

  v_order := public.create_order(gen_random_uuid(), 'CUS-1003', 'telefon', 'Potrebna instalacija i tehnička podrška.',
    '[{"product_id": "PRD-7781", "quantity": 2}]');
  perform public.confirm_order(gen_random_uuid(), v_order ->> 'id');

  perform public.create_order(gen_random_uuid(), 'CUS-1004', 'viber', 'U planu dostava u Mostar.',
    '[{"product_id": "PRD-1045", "quantity": 1}]');

  v_order := public.create_order(gen_random_uuid(), 'CUS-1002', 'olx', 'Spremno za prijem u skladište.',
    '[{"product_id": "PRD-3051", "quantity": 2}]');
  perform public.confirm_order(gen_random_uuid(), v_order ->> 'id');
end;
$$;

-- SO-1024 is invoiced and partly paid; two POS sales today, one of them invoiced to a customer.
do $$
declare
  v_invoice jsonb;
  v_sale jsonb;
begin
  v_invoice := public.invoice_order(gen_random_uuid(), 'ORD-1024');
  perform public.record_payment(gen_random_uuid(), v_invoice ->> 'id', 1000, 'virman', null, 'Prva rata');

  v_sale := public.complete_pos_sale(gen_random_uuid(), 'CUS-1002', 'kartica', 0,
    '[{"product_id": "PRD-2048", "quantity": 3}, {"product_id": "PRD-5102", "quantity": 1}]');
  perform public.invoice_pos_sale(gen_random_uuid(), v_sale ->> 'id');

  perform public.complete_pos_sale(gen_random_uuid(), null, 'gotovina', 5,
    '[{"product_id": "PRD-4030", "quantity": 1}]');
end;
$$;

-- The seller's own work: an order assigned to them and a POS sale (other demo documents belong to the admin).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000003", "role": "authenticated"}', false);

do $$
declare
  v_order jsonb;
begin
  v_order := public.create_order(gen_random_uuid(), 'CUS-1004', 'telefon', 'Kupac dolazi po robu.',
    '[{"product_id": "PRD-2048", "quantity": 4}]');
  perform public.confirm_order(gen_random_uuid(), v_order ->> 'id');

  perform public.complete_pos_sale(gen_random_uuid(), 'CUS-1002', 'gotovina', 0,
    '[{"product_id": "PRD-1021", "quantity": 1}]');
end;
$$;

select set_config('request.jwt.claims', '', false);

-- Original order dates of the demo data.
update public.orders as o set created_at = d.created_at::timestamptz
from (values ('ORD-1024', '2024-10-12'), ('ORD-1025', '2024-10-13'), ('ORD-1026', '2024-10-14'), ('ORD-1027', '2024-10-11'))
  as d (id, created_at)
where o.id = d.id;

insert into public.employees (id, name, role, department, phone, email, status) values
  ('EMP-101', 'Amra Kovač', 'Voditelj prodaje', 'Prodaja', '+387 61 120 100', 'amra.kovac@lob.ba', 'aktivan'),
  ('EMP-102', 'Eldin Softić', 'Skladištar', 'Lager', '+387 61 220 331', 'eldin.softic@lob.ba', 'aktivan'),
  ('EMP-103', 'Lejla Džafić', 'Bookkeeping', 'Finansije', '+387 61 644 405', 'lejla.dzafic@lob.ba', 'odmor');

-- In the app a reservation stores the product name; here it points to the product itself.
insert into public.reservations (id, customer_id, product_id, quantity, status, note, created_at) values
  ('RES-4401', 'CUS-1002', 'PRD-1021', 1, 'potvrđena', 'Rezervacija do 24h, potvrda na telefon.', '2024-10-11'),
  ('RES-4402', 'CUS-1004', 'PRD-1045', 1, 'nova', 'Potrebno da se potvrdi dostava.', '2024-10-14');

insert into public.procurement_docs (id, document_number, supplier_id, total, status, created_at) values
  ('PUR-210', 'PO-210', 'SUP-1', 5200, 'primljeno', '2024-10-09'),
  ('PUR-211', 'PO-211', 'SUP-2', 1840, 'u obradi', '2024-10-14');

select setval('public.employees_id_seq', (select max(substring(id from 5)::int) from public.employees));
select setval('public.reservations_id_seq', (select max(substring(id from 5)::int) from public.reservations));
select setval('public.procurement_docs_id_seq', (select max(substring(id from 5)::int) from public.procurement_docs));
select setval('public.procurement_docs_number_seq', (select max(substring(document_number from 4)::int) from public.procurement_docs));
