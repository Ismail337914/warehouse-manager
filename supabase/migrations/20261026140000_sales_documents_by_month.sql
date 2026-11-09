create function public.sales_documents_by_month(p_month date)
returns table (
  document_type text,
  document_id text,
  document_number text,
  customer_name text,
  document_date date,
  amount numeric,
  source_id text,
  source_number text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', coalesce(p_month, private.local_today()))::date;
  v_all boolean := private.is_staff();
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');

  return query
  select documents.document_type, documents.document_id, documents.document_number,
    documents.customer_name, documents.document_date, documents.amount, documents.source_id, documents.source_number
  from (
    select
      'pos_sale'::text as document_type,
      s.id as document_id,
      s.number as document_number,
      coalesce(c.name, 'Gotovinski kupac') as customer_name,
      (s.created_at at time zone 'Europe/Sarajevo')::date as document_date,
      s.total as amount,
      null::text as source_id,
      null::text as source_number
    from public.pos_sales as s
    left join public.customers as c on c.id = s.customer_id
    where (s.created_at at time zone 'Europe/Sarajevo')::date >= v_month
      and (s.created_at at time zone 'Europe/Sarajevo')::date < (v_month + interval '1 month')::date
      and (v_all or private.owns_pos_sale(s.id))

    union all

    select
      case when i.storno_of is null then 'invoice'::text else 'storno'::text end,
      i.id,
      i.number,
      i.customer_name,
      i.issue_date,
      i.total,
      i.order_id,
      o.number
    from public.invoices as i
    left join public.orders as o on o.id = i.order_id
    where i.order_id is not null
      and i.issue_date >= v_month
      and i.issue_date < (v_month + interval '1 month')::date
      and (v_all or private.can_read_invoice(i.id))
  ) as documents
  order by documents.document_date desc, documents.document_number desc;
end;
$$;

revoke execute on function public.sales_documents_by_month(date) from public, anon;
grant execute on function public.sales_documents_by_month(date) to authenticated;
