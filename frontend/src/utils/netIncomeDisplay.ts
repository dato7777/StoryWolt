/** Helpers for optional allocated ad-cost deduction on order/product net income. */

export function orderDisplayNetIncome(
  order: { net_income: number; net_income_after_ad_cost?: number },
  includeAllocatedAdCost: boolean,
): number {
  if (includeAllocatedAdCost && order.net_income_after_ad_cost != null) {
    return order.net_income_after_ad_cost;
  }
  return order.net_income;
}

export function lineDisplayNetIncome(
  line: {
    net_income: number;
    net_income_after_ad_cost?: number;
    net_income_per_item?: number;
    net_income_after_ad_cost_per_item?: number;
  },
  includeAllocatedAdCost: boolean,
  perItem = false,
): number {
  if (includeAllocatedAdCost) {
    if (perItem && line.net_income_after_ad_cost_per_item != null) {
      return line.net_income_after_ad_cost_per_item;
    }
    if (line.net_income_after_ad_cost != null) {
      return line.net_income_after_ad_cost;
    }
  }
  if (perItem && line.net_income_per_item != null) {
    return line.net_income_per_item;
  }
  return line.net_income;
}

export function rowDisplayNetIncome(
  row: {
    net_income: number;
    net_income_after_ad_cost?: number;
    net_income_per_item?: number;
    net_income_after_ad_cost_per_item?: number;
  },
  includeAllocatedAdCost: boolean,
  perItem = false,
): number {
  return lineDisplayNetIncome(row, includeAllocatedAdCost, perItem);
}
