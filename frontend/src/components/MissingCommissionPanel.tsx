/**
 * Products from delivered orders with no commission % in commission catalog.
 */

import { useI18n } from "../i18n/LanguageContext";
import type { MissingCommissionProduct } from "../types";

interface MissingCommissionPanelProps {
  products: MissingCommissionProduct[];
}

function formatIls(value: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(value);
}

export function MissingCommissionPanel({ products }: MissingCommissionPanelProps) {
  const { t } = useI18n();

  if (products.length === 0) {
    return null;
  }

  const missingPct = products.filter((p) => p.status === "missing_commission").length;
  const notFound = products.filter((p) => p.status === "not_found").length;

  function statusLabel(status: string): string {
    if (status === "missing_commission") {
      return t("missingCommission.inCatalogNoPct");
    }
    if (status === "not_found") {
      return t("missingCommission.notInCatalog");
    }
    return status;
  }

  return (
    <section className="modern-panel overflow-hidden border-amber-200 bg-amber-50/40">
      <div className="border-b border-amber-200/80 px-4 py-4 sm:px-6">
        <h2 className="text-lg font-bold text-amber-950 sm:text-xl">
          {t("missingCommission.title", { count: products.length })}
        </h2>
        <p className="mt-1 text-sm font-medium text-amber-900/80">
          {t("missingCommission.body")}
          {missingPct > 0 && notFound > 0 &&
            t("missingCommission.bothIssues", { missing: missingPct, notFound })}
        </p>
      </div>

      <div className="table-scroll max-h-[min(24rem,50vh)]">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr>
              <th className="table-sticky-th w-[40%]">{t("missingCommission.productName")}</th>
              <th className="table-sticky-th hidden w-[18%] sm:table-cell">{t("fields.sku")}</th>
              <th className="table-sticky-th w-12 text-center">{t("fields.qty")}</th>
              <th className="table-sticky-th hidden w-[14%] md:table-cell">{t("fields.sold")}</th>
              <th className="table-sticky-th w-[28%] sm:w-[22%]">{t("fields.issue")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={`${product.item_name}-${product.merchant_sku}-${product.status}`}
                className="border-t border-amber-200/60 hover:bg-amber-50/80"
              >
                <td className="table-cell-wrap font-medium text-ink" title={product.item_name}>
                  {product.item_name}
                </td>
                <td
                  className="table-cell-wrap hidden font-mono text-xs text-ink-muted sm:table-cell"
                  title={product.merchant_sku || undefined}
                >
                  {product.merchant_sku || "—"}
                </td>
                <td className="table-cell text-center tabular-nums">{product.quantity}</td>
                <td className="table-cell hidden tabular-nums md:table-cell">
                  {formatIls(product.sold_total)}
                </td>
                <td className="table-cell">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold leading-snug ${
                      product.status === "not_found"
                        ? "bg-red-100 text-red-900"
                        : "bg-amber-200 text-amber-950"
                    }`}
                  >
                    {statusLabel(product.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
