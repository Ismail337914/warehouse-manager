-- Company details printed on POS receipts and invoices: city, phone, e-mail, bank account and a line at the
-- bottom of the receipt. The legal identity on an issued invoice (name, address, JIB, PDV) stays in the
-- invoice's own snapshot; these contact details are read from settings when a document is printed.

alter table public.settings
  add column company_city text not null default '' check (char_length(company_city) <= 100),
  add column company_phone text not null default '' check (char_length(company_phone) <= 50),
  add column company_email text not null default '' check (char_length(company_email) <= 200),
  add column company_bank_account text not null default '' check (company_bank_account ~ '^[0-9 -]{0,40}$'),
  add column receipt_footer text not null default '' check (char_length(receipt_footer) <= 500);

-- The existing policy lets only admins update settings; these grants only open the new columns to it.
grant update (company_city, company_phone, company_email, company_bank_account, receipt_footer)
  on public.settings to authenticated;
