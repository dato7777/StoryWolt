-- Story Phone · Wolt Net Income — Supabase / PostgreSQL schema
-- Run in Supabase SQL Editor (Dashboard → SQL → New query).
--
-- Stores:
--   1) Commission catalog (offers_commission.xlsx) — versioned, updatable
--   2) Saved report timelines — full dashboard snapshots per Wolt period

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Commission catalog (replaces bundled offers_commission.xlsx in production)
-- ---------------------------------------------------------------------------

create table if not exists commission_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_label text not null default 'offers_commission.xlsx',
  notes text,
  row_count integer not null default 0,
  is_active boolean not null default false
);

create unique index if not exists idx_commission_catalog_one_active
  on commission_catalog_versions (is_active)
  where is_active = true;

create table if not exists commission_offers (
  id uuid primary key default gen_random_uuid(),
  catalog_version_id uuid not null references commission_catalog_versions(id) on delete cascade,
  merchant_sku text not null default '',
  product_name text not null,
  list_price numeric(12, 2),
  commission_home_delivery numeric(5, 2),
  commission_takeaway numeric(5, 2),
  product_self_cost numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_commission_offers_version
  on commission_offers (catalog_version_id);

create index if not exists idx_commission_offers_sku
  on commission_offers (catalog_version_id, merchant_sku);

create index if not exists idx_commission_offers_name
  on commission_offers (catalog_version_id, lower(product_name));

-- ---------------------------------------------------------------------------
-- Saved report timelines (one row per calculated Wolt period / upload)
-- ---------------------------------------------------------------------------

create table if not exists report_timelines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  period_label text not null,
  period_start date,
  period_end date,
  catalog_version_id uuid references commission_catalog_versions(id) on delete set null,
  data_source text not null default 'orderNumbers_delivered_only',
  upload_format text,
  rejected_excluded boolean not null default true,
  warning text,
  formula jsonb not null default '{}'::jsonb,
  invoice_reconciliation jsonb,
  order_numbers_file_name text,
  payment_details_file_name text
);

create index if not exists idx_report_timelines_created
  on report_timelines (created_at desc);

create index if not exists idx_report_timelines_period
  on report_timelines (period_start desc nulls last, period_end desc nulls last);

-- Summary KPIs (mirrors CalculationSummary)
create table if not exists report_timeline_summaries (
  timeline_id uuid primary key references report_timelines(id) on delete cascade,
  row_count integer not null default 0,
  matched_count integer not null default 0,
  unmatched_count integer not null default 0,
  delivered_order_count integer not null default 0,
  rejected_order_count integer not null default 0,
  rejected_order_total numeric(12, 2) not null default 0,
  total_gross numeric(12, 2) not null default 0,
  total_list_value numeric(12, 2),
  total_sold_value numeric(12, 2),
  total_commission_before_vat numeric(12, 2) not null default 0,
  total_commission_with_vat numeric(12, 2) not null default 0,
  total_net_income numeric(12, 2) not null default 0,
  total_product_self_cost numeric(12, 2) not null default 0,
  wolt_summary_gross_goods numeric(12, 2),
  wolt_summary_expenses_net numeric(12, 2),
  wolt_summary_expenses_incl_vat numeric(12, 2),
  wolt_summary_distribution_incl_vat numeric(12, 2),
  wolt_summary_remunerations numeric(12, 2),
  wolt_summary_self_billing_deductions_incl_vat numeric(12, 2),
  wolt_summary_self_billing_negative_incl_vat numeric(12, 2),
  wolt_summary_payout numeric(12, 2),
  wolt_summary_net_income numeric(12, 2),
  wolt_summary_ad_campaigns_incl_vat numeric(12, 2),
  wolt_summary_ad_campaigns_allocated_incl_vat numeric(12, 2),
  wolt_summary_other_fees_incl_vat numeric(12, 2),
  wolt_summary_distribution_gap_incl_vat numeric(12, 2),
  per_item_expenses_excluded_incl_vat numeric(12, 2),
  per_item_expenses_excluded_after_ads_incl_vat numeric(12, 2),
  report_period_label text,
  report_period_start date,
  report_period_end date
);

-- Aggregated product rows (Products tab)
create table if not exists report_product_rows (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references report_timelines(id) on delete cascade,
  sort_order integer not null default 0,
  item_name text not null,
  merchant_sku text not null default '',
  quantity integer not null default 0,
  list_price numeric(12, 2),
  list_total numeric(12, 2),
  sold_total numeric(12, 2),
  gross_total numeric(12, 2) not null default 0,
  commission_percent numeric(5, 2),
  commission_before_vat numeric(12, 2) not null default 0,
  commission_with_vat numeric(12, 2) not null default 0,
  commission_with_vat_per_item numeric(12, 2),
  product_self_cost numeric(12, 2) not null default 0,
  net_income numeric(12, 2) not null default 0,
  net_income_per_item numeric(12, 2) not null default 0,
  allocated_ad_cost numeric(12, 2) not null default 0,
  net_income_after_ad_cost numeric(12, 2) not null default 0,
  net_income_after_ad_cost_per_item numeric(12, 2) not null default 0,
  status text not null default 'ok',
  match_method text not null default ''
);

create index if not exists idx_report_product_rows_timeline
  on report_product_rows (timeline_id, sort_order);

-- Orders (Orders tab)
create table if not exists report_orders (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references report_timelines(id) on delete cascade,
  sort_order integer not null default 0,
  order_number text not null,
  order_placed text not null default '',
  delivery_time text not null default '',
  delivery_status text not null default '',
  order_gross numeric(12, 2) not null default 0,
  commission_before_vat numeric(12, 2) not null default 0,
  commission_with_vat numeric(12, 2) not null default 0,
  net_income numeric(12, 2) not null default 0,
  allocated_ad_cost numeric(12, 2) not null default 0,
  net_income_after_ad_cost numeric(12, 2) not null default 0
);

create index if not exists idx_report_orders_timeline
  on report_orders (timeline_id, sort_order);

-- Order line items (nested under each order)
create table if not exists report_order_line_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references report_orders(id) on delete cascade,
  sort_order integer not null default 0,
  item_name text not null,
  merchant_sku text not null default '',
  quantity integer not null default 0,
  line_gross numeric(12, 2) not null default 0,
  list_price numeric(12, 2),
  commission_percent numeric(5, 2),
  commission_before_vat numeric(12, 2) not null default 0,
  commission_with_vat numeric(12, 2) not null default 0,
  commission_with_vat_per_item numeric(12, 2),
  product_self_cost numeric(12, 2) not null default 0,
  net_income numeric(12, 2) not null default 0,
  net_income_per_item numeric(12, 2) not null default 0,
  allocated_ad_cost numeric(12, 2) not null default 0,
  net_income_after_ad_cost numeric(12, 2) not null default 0,
  net_income_after_ad_cost_per_item numeric(12, 2) not null default 0,
  status text not null default 'ok',
  match_method text not null default ''
);

create index if not exists idx_report_order_line_items_order
  on report_order_line_items (order_id, sort_order);

-- Missing commission products panel
create table if not exists report_missing_commission_products (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references report_timelines(id) on delete cascade,
  sort_order integer not null default 0,
  item_name text not null,
  merchant_sku text not null default '',
  quantity integer not null default 0,
  sold_total numeric(12, 2) not null default 0,
  status text not null default 'missing_commission',
  match_method text not null default ''
);

create index if not exists idx_report_missing_commission_timeline
  on report_missing_commission_products (timeline_id, sort_order);

create index if not exists idx_report_product_rows_sku
  on report_product_rows (timeline_id, merchant_sku);

create index if not exists idx_report_product_rows_status
  on report_product_rows (timeline_id, status);

create index if not exists idx_report_order_line_items_sku
  on report_order_line_items (merchant_sku);

create index if not exists idx_report_order_line_items_order_sku
  on report_order_line_items (order_id, merchant_sku);

-- ---------------------------------------------------------------------------
-- Row Level Security (optional — service role bypasses; enable for direct client)
-- ---------------------------------------------------------------------------

alter table commission_catalog_versions enable row level security;
alter table commission_offers enable row level security;
alter table report_timelines enable row level security;
alter table report_timeline_summaries enable row level security;
alter table report_product_rows enable row level security;
alter table report_orders enable row level security;
alter table report_order_line_items enable row level security;
alter table report_missing_commission_products enable row level security;

-- Service role used by Python API has full access; anon/authenticated blocked by default.
