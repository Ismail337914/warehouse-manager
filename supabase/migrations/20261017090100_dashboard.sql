-- Phase 5: invoice lists and dashboard aggregates, computed in the database.
--
-- Turnover (promet, with VAT) = POS sales + invoices of orders − storno documents of those invoices.
-- Number of sales = POS sales + invoiced orders whose invoice is still valid.
-- POS invoices are not counted again: the POS sale itself is the turnover.

-- ---------------------------------------------------------------------------
-- Invoice list views
-- ---------------------------------------------------------------------------

-- security_invoker: the caller's RLS on invoices, orders and pos_sales applies.
create view public.invoice_list
with (security_invoker = true)
as
select
  i.id,
  i.number,
  i.status,
  i.customer_id,
  i.customer_name,
  i.issue_date,
  i.due_date,
  i.subtotal,
  i.vat_total,
  i.total,
  i.paid_amount,
  case when i.storno_of is null and i.status <> 'stornirana' then i.total - i.paid_amount else 0 end as balance,
  i.order_id,
  o.number as order_number,
  i.pos_sale_id,
  s.number as pos_sale_number,
  i.storno_of,
  i.created_at,
  (
    i.storno_of is null
    and i.status in ('izdata', 'djelimicno_placena')
    and i.due_date < (now() at time zone 'Europe/Sarajevo')::date
  ) as is_overdue
from public.invoices as i
left join public.orders as o on o.id = i.order_id
left join public.pos_sales as s on s.id = i.pos_sale_id;

-- Invoices that still have something to pay; overdue follows from due_date.
create view public.unpaid_invoices
with (security_invoker = true)
as
select
  l.id,
  l.number,
  l.status,
  l.customer_id,
  l.customer_name,
  l.issue_date,
  l.due_date,
  l.total,
  l.paid_amount,
  l.balance,
  l.is_overdue,
  greatest((now() at time zone 'Europe/Sarajevo')::date - l.due_date, 0) as days_overdue
from public.invoice_list as l
where l.storno_of is null and l.status in ('izdata', 'djelimicno_placena');

-- POS receipts with the customer's name and the receipt's valid invoice, for the till's history.
create view public.pos_sale_list
with (security_invoker = true)
as
select
  s.id,
  s.number,
  s.customer_id,
  c.name as customer_name,
  s.payment_method,
  s.discount_percent,
  s.subtotal,
  s.vat_total,
  s.total,
  s.created_at,
  i.id as invoice_id,
  i.number as invoice_number
from public.pos_sales as s
left join public.customers as c on c.id = s.customer_id
left join public.invoices as i
  on i.pos_sale_id = s.id and i.storno_of is null and i.status <> 'stornirana';

-- ---------------------------------------------------------------------------
-- Turnover sources (private: read only through the functions below)
-- ---------------------------------------------------------------------------

-- One row per document that changes turnover, dated in Bosnian time.
create view private.revenue_documents
as
select (s.created_at at time zone 'Europe/Sarajevo')::date as day, s.total, 1 as sales
from public.pos_sales as s
union all
select i.issue_date, i.total,
  case when i.storno_of is null and i.status <> 'stornirana' then 1 else 0 end
from public.invoices as i
where i.order_id is not null;

-- The same turnover per product line, for the best sellers.
create view private.revenue_lines
as
select (s.created_at at time zone 'Europe/Sarajevo')::date as day, si.product_id, si.quantity, si.gross_amount
from public.pos_sale_items as si
join public.pos_sales as s on s.id = si.pos_sale_id
union all
select i.issue_date, ii.product_id, ii.quantity, ii.gross_amount
from public.invoice_items as ii
join public.invoices as i on i.id = ii.invoice_id
where i.order_id is not null;

revoke all on private.revenue_documents from public, anon, authenticated;
revoke all on private.revenue_lines from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard RPC functions
-- ---------------------------------------------------------------------------

create function public.dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.local_today();
  v_month_start date := date_trunc('month', private.local_today())::date;
  v_result jsonb;
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');

  select jsonb_build_object(
    'revenue_today', coalesce(sum(d.total) filter (where d.day = v_today), 0),
    'revenue_month', coalesce(sum(d.total) filter (where d.day >= v_month_start), 0),
    'sales_today', coalesce(sum(d.sales) filter (where d.day = v_today), 0),
    'sales_month', coalesce(sum(d.sales) filter (where d.day >= v_month_start), 0),
    'average_basket', coalesce(
      round(sum(d.total) filter (where d.day >= v_month_start)
        / nullif(sum(d.sales) filter (where d.day >= v_month_start), 0), 2),
      0
    )
  )
  into v_result
  from private.revenue_documents as d
  where d.day >= v_month_start;

  return v_result || jsonb_build_object(
    'top_products', coalesce((
      select jsonb_agg(t order by t.revenue desc)
      from (
        select l.product_id, p.name, p.unit, sum(l.quantity)::integer as quantity, sum(l.gross_amount) as revenue
        from private.revenue_lines as l
        join public.products as p on p.id = l.product_id
        where l.day >= v_month_start
        group by l.product_id, p.name, p.unit
        having sum(l.gross_amount) > 0
        order by sum(l.gross_amount) desc
        limit 5
      ) as t
    ), '[]'::jsonb),
    'low_stock_count', (select count(*) from public.products where is_low_stock and status = 'active'),
    'open_orders', (select count(*) from public.orders where status in ('nacrt', 'potvrđena')),
    'unpaid_count', (select count(*) from public.unpaid_invoices),
    'unpaid_amount', (select coalesce(sum(balance), 0) from public.unpaid_invoices),
    'overdue_count', (select count(*) from public.unpaid_invoices where is_overdue),
    'overdue_amount', (select coalesce(sum(balance), 0) from public.unpaid_invoices where is_overdue)
  );
end;
$$;

-- Turnover per calendar month for the last p_months months (current month included), months without sales as 0.
create function public.sales_by_month(p_months integer default 12)
returns table (month date, revenue numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current date := date_trunc('month', private.local_today())::date;
  v_months integer := least(greatest(coalesce(p_months, 12), 1), 36);
begin
  perform private.require_role('admin', 'menadzer', 'prodavac');

  return query
  select m.month::date, coalesce(sum(d.total), 0)::numeric
  from generate_series(v_current - make_interval(months => v_months - 1), v_current, interval '1 month') as m (month)
  left join private.revenue_documents as d
    on d.day >= m.month::date and d.day < (m.month + interval '1 month')::date
  group by m.month
  order by m.month;
end;
$$;

revoke execute on function public.dashboard_summary() from public, anon;
revoke execute on function public.sales_by_month(integer) from public, anon;
grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.sales_by_month(integer) to authenticated;
