-- Story Phone · NewOrder — Supabase / PostgreSQL schema
-- Run in Supabase SQL Editor AFTER schema.sql (Wolt tables are separate).
--
-- Synced from NewOrder API via backend (serverless). Dashboard reads from these tables.
-- Product duplicate policy: one active row per normalized SKU (barcode) and per normalized name.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function no_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sync metadata
-- ---------------------------------------------------------------------------

create table if not exists no_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  source text not null default 'neworder_api',
  products_upserted integer not null default 0,
  documents_upserted integer not null default 0,
  line_items_upserted integer not null default 0,
  error_message text,
  details jsonb not null default '{}'::jsonb
);

create index if not exists idx_no_sync_runs_started
  on no_sync_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- Branches, categories, suppliers
-- ---------------------------------------------------------------------------

create table if not exists no_branches (
  id uuid primary key default gen_random_uuid(),
  neworder_id text not null,
  company_name text,
  branch_name text not null default '',
  tax_id text,
  address text,
  phone_number text,
  is_active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_branches_neworder_id_unique unique (neworder_id)
);

create trigger no_branches_updated_at
  before update on no_branches
  for each row execute function no_set_updated_at();

create table if not exists no_categories (
  id uuid primary key default gen_random_uuid(),
  neworder_id text not null,
  name text not null,
  name_normalized text not null,
  is_active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_categories_neworder_id_unique unique (neworder_id)
);

create unique index if not exists idx_no_categories_name_active
  on no_categories (name_normalized)
  where is_active = true and name_normalized <> '';

create trigger no_categories_updated_at
  before update on no_categories
  for each row execute function no_set_updated_at();

create table if not exists no_suppliers (
  id uuid primary key default gen_random_uuid(),
  neworder_id text not null,
  name text not null,
  phone_number text,
  is_active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_suppliers_neworder_id_unique unique (neworder_id)
);

create trigger no_suppliers_updated_at
  before update on no_suppliers
  for each row execute function no_set_updated_at();

-- ---------------------------------------------------------------------------
-- Products (catalog) — dedupe by neworder_id + active name + active barcode
-- ---------------------------------------------------------------------------

create table if not exists no_products (
  id uuid primary key default gen_random_uuid(),
  neworder_id text not null,
  name text not null,
  name_normalized text not null,
  barcode text not null default '',
  barcode_normalized text not null default '',
  cost_no_tax numeric(12, 2),
  cost numeric(12, 2),
  price numeric(12, 2),
  is_serial boolean not null default false,
  category_id uuid references no_categories(id) on delete set null,
  category_name text,
  supplier_id uuid references no_suppliers(id) on delete set null,
  supplier_name text,
  is_tax_free boolean not null default false,
  is_stock boolean not null default true,
  is_active boolean not null default true,
  description text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_products_neworder_id_unique unique (neworder_id)
);

-- No two active products with the same name (case/space insensitive)
create unique index if not exists idx_no_products_unique_name_active
  on no_products (name_normalized)
  where is_active = true and name_normalized <> '';

-- No two active products with the same SKU/barcode (when barcode present)
create unique index if not exists idx_no_products_unique_barcode_active
  on no_products (barcode_normalized)
  where is_active = true and barcode_normalized <> '';

create index if not exists idx_no_products_active_name
  on no_products (is_active, name);

create index if not exists idx_no_products_category
  on no_products (category_id)
  where is_active = true;

create trigger no_products_updated_at
  before update on no_products
  for each row execute function no_set_updated_at();

-- Alternate barcodes — each normalized barcode unique among active rows
create table if not exists no_product_barcodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references no_products(id) on delete cascade,
  barcode text not null,
  barcode_normalized text not null,
  is_active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint no_product_barcodes_product_barcode_unique unique (product_id, barcode_normalized)
);

create unique index if not exists idx_no_product_barcodes_unique_active
  on no_product_barcodes (barcode_normalized)
  where is_active = true and barcode_normalized <> '';

create index if not exists idx_no_product_barcodes_product
  on no_product_barcodes (product_id);

-- Stock per branch
create table if not exists no_product_stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references no_products(id) on delete cascade,
  branch_id uuid not null references no_branches(id) on delete cascade,
  quantity numeric(12, 2) not null default 0,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_product_stock_product_branch_unique unique (product_id, branch_id)
);

create index if not exists idx_no_product_stock_branch
  on no_product_stock (branch_id);

create trigger no_product_stock_updated_at
  before update on no_product_stock
  for each row execute function no_set_updated_at();

-- Local alert thresholds (not provided by NewOrder API)
create table if not exists no_product_stock_thresholds (
  product_id uuid primary key references no_products(id) on delete cascade,
  min_quantity numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table if not exists no_customers (
  id uuid primary key default gen_random_uuid(),
  neworder_id text not null,
  name text not null,
  tax_id text,
  contact_person text,
  balance numeric(12, 2),
  phone_number1 text,
  phone_number2 text,
  email text,
  address text,
  city text,
  zipcode text,
  join_date date,
  last_purchase date,
  is_active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_customers_neworder_id_unique unique (neworder_id)
);

create index if not exists idx_no_customers_last_purchase
  on no_customers (last_purchase desc nulls last)
  where is_active = true;

create trigger no_customers_updated_at
  before update on no_customers
  for each row execute function no_set_updated_at();

-- ---------------------------------------------------------------------------
-- Documents (invoices / receipts) + line items
-- ---------------------------------------------------------------------------

create table if not exists no_documents (
  id uuid primary key default gen_random_uuid(),
  neworder_id text not null,
  document_number text,
  document_type smallint,
  bill_number text,
  create_date timestamptz,
  employee_name text,
  branch_id uuid references no_branches(id) on delete set null,
  customer_id uuid references no_customers(id) on delete set null,
  total_bill numeric(12, 2) not null default 0,
  paid_cash numeric(12, 2) not null default 0,
  paid_credit_card numeric(12, 2) not null default 0,
  paid_checks numeric(12, 2) not null default 0,
  paid_bank_transfer numeric(12, 2) not null default 0,
  paid_akafa numeric(12, 2) not null default 0,
  raw_paid_values jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_documents_neworder_id_unique unique (neworder_id)
);

create index if not exists idx_no_documents_create_date
  on no_documents (create_date desc nulls last);

create index if not exists idx_no_documents_branch_date
  on no_documents (branch_id, create_date desc nulls last);

create index if not exists idx_no_documents_employee
  on no_documents (employee_name)
  where employee_name is not null and employee_name <> '';

create trigger no_documents_updated_at
  before update on no_documents
  for each row execute function no_set_updated_at();

create table if not exists no_document_line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references no_documents(id) on delete cascade,
  neworder_product_id text,
  product_id uuid references no_products(id) on delete set null,
  sort_order integer not null default 0,
  item_name text not null,
  quantity numeric(12, 2) not null default 0,
  price numeric(12, 2),
  cost numeric(12, 2),
  line_revenue numeric(12, 2) not null default 0,
  line_cost numeric(12, 2) not null default 0,
  stock_after_operation numeric(12, 2),
  synced_at timestamptz not null default now(),
  constraint no_document_line_items_doc_product_sort_unique
    unique (document_id, neworder_product_id, sort_order)
);

create index if not exists idx_no_document_line_items_document
  on no_document_line_items (document_id, sort_order);

create index if not exists idx_no_document_line_items_product
  on no_document_line_items (product_id)
  where product_id is not null;

-- ---------------------------------------------------------------------------
-- Employees + attendance
-- ---------------------------------------------------------------------------

create table if not exists no_employees (
  id uuid primary key default gen_random_uuid(),
  neworder_id text not null,
  name text not null,
  phone_number text,
  branch_info jsonb not null default '{}'::jsonb,
  shift_info jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_employees_neworder_id_unique unique (neworder_id)
);

create unique index if not exists idx_no_employees_name_active
  on no_employees (lower(trim(name)))
  where is_active = true and trim(name) <> '';

create trigger no_employees_updated_at
  before update on no_employees
  for each row execute function no_set_updated_at();

create table if not exists no_employee_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references no_employees(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  year smallint not null check (year between 2000 and 2100),
  enter_date date,
  enter_time time,
  exit_date date,
  exit_time time,
  total_hours numeric(8, 2),
  remark text,
  synced_at timestamptz not null default now(),
  constraint no_employee_attendance_unique unique (employee_id, enter_date, enter_time)
);

create index if not exists idx_no_employee_attendance_period
  on no_employee_attendance (year desc, month desc);

-- ---------------------------------------------------------------------------
-- Daily rollups (optional fast dashboard reads)
-- ---------------------------------------------------------------------------

create table if not exists no_daily_metrics (
  metric_date date not null,
  branch_id uuid references no_branches(id) on delete cascade,
  total_sales numeric(14, 2) not null default 0,
  total_cost numeric(14, 2) not null default 0,
  net_revenue numeric(14, 2) not null default 0,
  units_sold numeric(14, 2) not null default 0,
  order_count integer not null default 0,
  new_customers integer not null default 0,
  computed_at timestamptz not null default now(),
  primary key (metric_date, branch_id)
);

create index if not exists idx_no_daily_metrics_date
  on no_daily_metrics (metric_date desc);

-- ---------------------------------------------------------------------------
-- Row Level Security (backend service role bypasses)
-- ---------------------------------------------------------------------------

alter table no_sync_runs enable row level security;
alter table no_branches enable row level security;
alter table no_categories enable row level security;
alter table no_suppliers enable row level security;
alter table no_products enable row level security;
alter table no_product_barcodes enable row level security;
alter table no_product_stock enable row level security;
alter table no_product_stock_thresholds enable row level security;
alter table no_customers enable row level security;
alter table no_documents enable row level security;
alter table no_document_line_items enable row level security;
alter table no_employees enable row level security;
alter table no_employee_attendance enable row level security;
alter table no_daily_metrics enable row level security;
