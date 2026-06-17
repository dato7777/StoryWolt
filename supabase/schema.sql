-- Future Supabase / PostgreSQL schema for persisting calculation runs.
-- Not required for MVP; serverless API works with bundled offers_commission.xlsx.

create table if not exists calculation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  uploaded_file_name text,
  row_count integer not null default 0,
  matched_count integer not null default 0,
  total_gross numeric(12, 2) not null default 0,
  total_commission_with_vat numeric(12, 2) not null default 0,
  total_net_income numeric(12, 2) not null default 0
);

create table if not exists calculation_rows (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references calculation_runs(id) on delete cascade,
  item_name text not null,
  merchant_sku text,
  quantity integer not null default 0,
  gross_total numeric(12, 2) not null default 0,
  commission_percent numeric(5, 2),
  commission_before_vat numeric(12, 2) not null default 0,
  commission_with_vat numeric(12, 2) not null default 0,
  net_income numeric(12, 2) not null default 0,
  status text not null default 'ok',
  match_method text
);

create index if not exists idx_calculation_rows_run_id on calculation_rows(run_id);

-- Commission catalog mirror (optional future sync from offers_commission.xlsx)
create table if not exists commission_offers (
  id uuid primary key default gen_random_uuid(),
  merchant_sku text,
  product_name text not null,
  list_price numeric(12, 2),
  commission_home_delivery numeric(5, 2),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_commission_offers_name on commission_offers(product_name);
