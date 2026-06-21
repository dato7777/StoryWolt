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
  /** From standardSummary.csv — Total, goods sold incl. VAT */
  wolt_summary_gross_goods?: number | null;
  /** Sum of WOLT INVOICE NET column */
  wolt_summary_expenses_net?: number | null;
  /** Sum of all WOLT INVOICE TOTAL column (distribution + ads + discounts + …) */
  wolt_summary_expenses_incl_vat?: number | null;
  wolt_summary_distribution_incl_vat?: number | null;
  wolt_summary_remunerations?: number | null;
  wolt_summary_self_billing_deductions_incl_vat?: number | null;
  /** Sum of |TOTAL| for all negative self-billing rows — added to expenses */
  wolt_summary_self_billing_negative_incl_vat?: number | null;
  wolt_summary_payout?: number | null;
  /** Payout NET − product self cost (when standardSummary uploaded) */
  wolt_summary_net_income?: number | null;
  /** Total ad campaign charges on WOLT INVOICE */
  wolt_summary_ad_campaigns_incl_vat?: number | null;
  /** Ad cost allocated to orders by campaign date window */
  wolt_summary_ad_campaigns_allocated_incl_vat?: number | null;
  /** Non-distribution, non-ad WOLT INVOICE fees (lateness, delivery discount, …) */
  wolt_summary_other_fees_incl_vat?: number | null;
  /** Wolt distribution invoice − per-order commission estimate */
  wolt_summary_distribution_gap_incl_vat?: number | null;
  /** Invoice expenses not in default per-item net income */
  per_item_expenses_excluded_incl_vat?: number | null;
  /** Remaining excluded after allocated ad cost is applied (toggle on) */
  per_item_expenses_excluded_after_ads_incl_vat?: number | null;
  /** Display label e.g. "1–15 Apr 2026" */
  report_period_label?: string | null;
  report_period_start?: string | null;
  report_period_end?: string | null;
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
  allocated_ad_cost?: number;
  net_income_after_ad_cost?: number;
  net_income_after_ad_cost_per_item?: number;
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
  allocated_ad_cost?: number;
  net_income_after_ad_cost?: number;
  net_income_after_ad_cost_per_item?: number;
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
  allocated_ad_cost?: number;
  net_income_after_ad_cost?: number;
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

export interface MissingCommissionProduct {
  item_name: string;
  merchant_sku: string;
  quantity: number;
  sold_total: number;
  status: "missing_commission" | "not_found" | string;
  match_method: string;
}

export interface CalculationResponse {
  summary: CalculationSummary;
  rows: CalculatedRow[];
  orders: CalculatedOrder[];
  missing_commission_products?: MissingCommissionProduct[];
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
