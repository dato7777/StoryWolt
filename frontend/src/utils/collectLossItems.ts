import type { CalculatedOrder } from "../types";
import { lineDisplayNetIncome } from "./netIncomeDisplay";

export type LossOutcome = "loss" | "break_even";

export interface LossLineItem {
  order_number: string;
  delivery_time: string;
  item_name: string;
  merchant_sku: string;
  quantity: number;
  menu_price_per_unit: number | null;
  menu_line_total: number | null;
  actual_price_per_unit: number;
  actual_line_total: number;
  net_income: number;
  net_income_per_item: number;
  allocated_ad_cost: number;
  outcome: LossOutcome;
}

export function collectLossItems(
  orders: CalculatedOrder[],
  includeAllocatedAdCost: boolean,
): LossLineItem[] {
  const items: LossLineItem[] = [];

  for (const order of orders) {
    for (const line of order.items) {
      const netIncome = lineDisplayNetIncome(line, includeAllocatedAdCost);
      if (netIncome > 0) continue;

      const quantity = line.quantity > 0 ? line.quantity : 1;
      const menuPrice = line.list_price ?? null;
      const actualUnit = round2(line.line_gross / quantity);

      items.push({
        order_number: order.order_number,
        delivery_time: order.delivery_time || order.order_placed,
        item_name: line.item_name,
        merchant_sku: line.merchant_sku,
        quantity: line.quantity,
        menu_price_per_unit: menuPrice,
        menu_line_total: menuPrice != null ? round2(menuPrice * line.quantity) : null,
        actual_price_per_unit: actualUnit,
        actual_line_total: line.line_gross,
        net_income: netIncome,
        net_income_per_item: lineDisplayNetIncome(line, includeAllocatedAdCost, true),
        allocated_ad_cost: includeAllocatedAdCost ? line.allocated_ad_cost ?? 0 : 0,
        outcome: netIncome < 0 ? "loss" : "break_even",
      });
    }
  }

  return items.sort((a, b) => a.net_income - b.net_income);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
