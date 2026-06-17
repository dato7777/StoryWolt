/** Shared TypeScript types for API responses from /api/calculate */

export interface CalculationSummary {
  row_count: number;
  matched_count: number;
  unmatched_count: number;
  delivered_order_count?: number;
  rejected_order_count?: number;
  rejected_order_total?: number;
  total_gross: number;
  total_list_value?: number;
  total_sold_value?: number;
  total_commission_before_vat: number;
  total_commission_with_vat: number;
  total_net_income: number;
  total_product_self_cost?: number;
}

export interface CalculatedRow {
  item_name: string;
  merchant_sku: string;
  quantity: number;
  list_price?: number | null;
  list_total?: number | null;
  sold_total?: number;
  gross_total: number;
  commission_percent: number | null;
  commission_before_vat: number;
  commission_with_vat: number;
  commission_with_vat_per_item?: number;
  product_self_cost: number;
  net_income: number;
  net_income_per_item: number;
  status: string;
  match_method: string;
}

export interface OrderLineItem {
  item_name: string;
  merchant_sku: string;
  quantity: number;
  line_gross: number;
  list_price: number | null;
  commission_percent: number | null;
  commission_before_vat: number;
  commission_with_vat: number;
  commission_with_vat_per_item?: number;
  product_self_cost: number;
  net_income: number;
  net_income_per_item: number;
  status: string;
  match_method: string;
}

export interface CalculatedOrder {
  order_number: string;
  order_placed: string;
  delivery_time: string;
  delivery_status: string;
  order_gross: number;
  commission_before_vat: number;
  commission_with_vat: number;
  net_income: number;
  items: OrderLineItem[];
}

export interface UploadFiles {
  orderNumbers: File | null;
  itemsSold: File | null;
  paymentDetails: File | null;
}

export interface InvoiceStep {
  id: string;
  label: string;
  label_he: string;
  amount: number;
  running_total: number;
  step_type: string;
  note: string;
  phase: string;
}

export interface InvoicePhase {
  id: string;
  title: string;
  subtitle: string;
  steps: InvoiceStep[];
}

export interface InvoiceReconciliation {
  source: string;
  gross_goods_sold: number | null;
  merchant_discounts: number | null;
  net_sold_from_invoice: number | null;
  net_sold_from_orders: number;
  orders_match_invoice: boolean | null;
  remunerations: number | null;
  net_after_remunerations: number | null;
  wolt_distribution_fees: number;
  net_income_after_wolt: number;
  payout_amount: number | null;
  total_wolt_invoice?: number | null;
  payout_gap_from_app_net?: number | null;
  steps: InvoiceStep[];
  phases?: InvoicePhase[];
}

export interface CalculationResponse {
  summary: CalculationSummary;
  rows: CalculatedRow[];
  orders: CalculatedOrder[];
  invoice_reconciliation?: InvoiceReconciliation;
  data_source: string;
  rejected_excluded: boolean;
  warning?: string;
  upload_format: string;
  formula: {
    commission_base?: string;
    commission_before_vat: string;
    commission_with_vat: string;
    net_income: string;
  };
}
