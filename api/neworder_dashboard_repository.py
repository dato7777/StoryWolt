"""Read NewOrder dashboard aggregates from Supabase."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from supabase_client import db_connection

STORE_TZ = ZoneInfo("Asia/Jerusalem")
VALID_PERIODS = frozenset({"today", "yesterday", "range"})
MAX_RANGE_DAYS = 366
ORDERS_LIST_LIMIT = 5000
PRODUCTS_LIST_LIMIT = 10000


def parse_iso_date(value: str) -> date:
    """Parse YYYY-MM-DD in store calendar."""
    text = (value or "").strip()
    if len(text) != 10:
        raise ValueError("Dates must use YYYY-MM-DD format.")
    parsed = date.fromisoformat(text)
    return parsed


def resolve_date_range(date_from: date, date_to: date) -> tuple[date, date, str]:
    if date_to < date_from:
        raise ValueError("End date must be on or after start date.")
    span = (date_to - date_from).days + 1
    if span > MAX_RANGE_DAYS:
        raise ValueError(f"Date range cannot exceed {MAX_RANGE_DAYS} days.")
    return date_from, date_to, _format_range_label(date_from, date_to)


def _format_range_label(start: date, end: date) -> str:
    def day_num(d: date) -> str:
        return str(d.day)

    if start == end:
        return f"{day_num(start)} {start.strftime('%b %Y')}"
    same_year = start.year == end.year
    if same_year and start.month == end.month:
        return f"{day_num(start)}–{day_num(end)} {start.strftime('%b %Y')}"
    if same_year:
        return f"{day_num(start)} {start.strftime('%b')} – {day_num(end)} {end.strftime('%b %Y')}"
    return f"{day_num(start)} {start.strftime('%b %Y')} – {day_num(end)} {end.strftime('%b %Y')}"


def resolve_period(period: str) -> tuple[str, str, date | None, date | None]:
    """Return (period_key, period_label, start_date, end_date inclusive in store TZ)."""
    key = (period or "today").strip().lower()
    if key not in VALID_PERIODS:
        key = "today"

    today = datetime.now(STORE_TZ).date()

    if key == "today":
        return key, "Today", today, today
    if key == "yesterday":
        day = today - timedelta(days=1)
        return key, "Yesterday", day, day
    return key, "Custom range", None, None


def _document_period_sql(
    period_key: str,
    *,
    alias: str = "d",
    hours: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> str:
    """Filter documents by store calendar dates (evaluated in PostgreSQL)."""
    col = f"({alias}.create_date at time zone 'Asia/Jerusalem')::date"
    jerusalem_today = "(now() at time zone 'Asia/Jerusalem')::date"

    if period_key == "hours" and hours is not None:
        return f"{alias}.create_date >= (now() at time zone 'utc' - make_interval(hours => {int(hours)}))"

    if period_key == "today":
        return f"{col} = {jerusalem_today}"
    if period_key == "yesterday":
        return f"{col} = {jerusalem_today} - 1"
    if period_key == "range" and start_date is not None and end_date is not None:
        return f"{col} >= '{start_date.isoformat()}' and {col} <= '{end_date.isoformat()}'"
    return f"{col} = {jerusalem_today}"


def fetch_dashboard_data(
    *,
    period: str = "today",
    hours: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[str, Any]:
    if hours is not None:
        hours = max(1, min(int(hours), 24 * 366))
        period_key = "hours"
        period_label = f"Last {hours} hours"
        start_date = None
        end_date = None
        since_ts = datetime.now(timezone.utc) - timedelta(hours=hours)
        until_ts = None
    else:
        period_key, period_label, start_date, end_date = resolve_period(period)
        if period_key == "range":
            if date_from is None or date_to is None:
                raise ValueError("from and to dates are required for a custom range.")
            start_date, end_date, period_label = resolve_date_range(date_from, date_to)
        since_ts, until_ts = _period_bounds_utc(start_date, end_date)

    range_kwargs = {"start_date": start_date, "end_date": end_date}

    with db_connection() as conn:
        with conn.cursor() as cur:
            kpi = _fetch_kpi(cur, period_key, hours=hours, **range_kwargs)
            chart = _fetch_chart_series(cur, period_key, hours=hours, **range_kwargs)
            daily_sales = chart["points"]
            top_products = _fetch_top_products(
                cur, period_key, hours=hours, limit=5, **range_kwargs
            )
            best_net = _fetch_best_net_revenue(
                cur, period_key, hours=hours, limit=10, **range_kwargs
            )
            orders = _fetch_recent_orders(
                cur, period_key, hours=hours, limit=ORDERS_LIST_LIMIT, **range_kwargs
            )
            products = _fetch_products(cur, limit=PRODUCTS_LIST_LIMIT)
            products_total = _count_products(cur)
            employees = _fetch_employee_sales(cur, period_key, hours=hours, **range_kwargs)
            low_stock = _fetch_low_stock(cur, limit=20)

    return {
        "period": period_key,
        "period_label": period_label,
        "since": since_ts.isoformat(),
        "until": until_ts.isoformat() if until_ts else None,
        "kpi": kpi,
        "chart_granularity": chart["granularity"],
        "chart_title": chart["title"],
        "daily_sales": daily_sales,
        "top_products": top_products,
        "best_net_revenue": best_net,
        "orders": orders,
        "orders_total": kpi["order_count"],
        "products": products,
        "products_total": products_total,
        "employees": employees,
        "low_stock": low_stock,
    }


def _period_bounds_utc(start: date | None, end: date | None) -> tuple[datetime, datetime | None]:
    if start is None or end is None:
        now = datetime.now(timezone.utc)
        return now, None
    start_local = datetime.combine(start, datetime.min.time(), tzinfo=STORE_TZ)
    end_exclusive = datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=STORE_TZ)
    return start_local.astimezone(timezone.utc), end_exclusive.astimezone(timezone.utc)


def _fetch_kpi(
    cur: Any,
    period_key: str,
    *,
    hours: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    period_sql = _period_sql_for(
        period_key, hours=hours, start_date=start_date, end_date=end_date
    )
    cur.execute(
        f"""
        with docs as (
          select d.id, d.total_bill, d.customer_id
          from no_documents d
          where {period_sql}
        ),
        line_agg as (
          select
            coalesce(sum(li.quantity), 0)::numeric as units_sold,
            coalesce(sum(coalesce(li.cost, 0) * li.quantity), 0)::numeric as total_cost
          from no_document_line_items li
          join docs on docs.id = li.document_id
        )
        select
          coalesce((select sum(total_bill) from docs), 0)::numeric as total_sales,
          coalesce((select count(*) from docs), 0)::integer as order_count,
          coalesce(
            (select count(distinct customer_id) from docs where customer_id is not null),
            0
          )::integer as unique_customer_count,
          coalesce(
            (select count(*) from docs where customer_id is not null),
            0
          )::integer as orders_with_customer,
          la.units_sold,
          la.total_cost
        from line_agg la
        """
    )
    row = dict(cur.fetchone() or {})
    total_sales = float(row.get("total_sales") or 0)
    total_cost = float(row.get("total_cost") or 0)
    units_sold = int(row.get("units_sold") or 0)
    order_count = int(row.get("order_count") or 0)
    unique_customers = int(row.get("unique_customer_count") or 0)
    customer_volume_pct = (
        round((unique_customers / order_count) * 100, 1) if order_count > 0 else 0.0
    )
    return {
        "total_sales": round(total_sales, 2),
        "total_cost": round(total_cost, 2),
        "net_revenue": round(total_sales - total_cost, 2),
        "units_sold": units_sold,
        "order_count": order_count,
        "customer_count": unique_customers,
        "unique_customer_count": unique_customers,
        "orders_with_customer": int(row.get("orders_with_customer") or 0),
        "customer_volume_pct": customer_volume_pct,
        "low_stock_count": _count_attention_needed(cur),
        "attention_needed_count": _count_attention_needed(cur),
    }


def _count_attention_needed(cur: Any) -> int:
    cur.execute(
        """
        select count(distinct p.id)::integer as total
        from no_products p
        join no_product_stock_thresholds t on t.product_id = p.id
        join no_product_stock ps on ps.product_id = p.id
        where p.is_active = true
          and p.is_stock = true
          and t.min_quantity > 0
          and ps.quantity <= t.min_quantity
        """
    )
    row = cur.fetchone()
    return int(row["total"]) if row else 0


def _count_low_stock(cur: Any) -> int:
    return _count_attention_needed(cur)


def _period_sql_for(
    period_key: str,
    *,
    hours: int | None = None,
    alias: str = "d",
    start_date: date | None = None,
    end_date: date | None = None,
) -> str:
    if period_key == "hours":
        return _document_period_sql("hours", alias=alias, hours=hours)
    return _document_period_sql(
        period_key,
        alias=alias,
        start_date=start_date,
        end_date=end_date,
    )


def _attendance_period_sql(
    period_key: str,
    *,
    alias: str = "a",
    hours: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> str:
    """Filter attendance rows by shift enter_date (store calendar) or rolling hours."""
    date_col = f"{alias}.enter_date"
    jerusalem_today = "(now() at time zone 'Asia/Jerusalem')::date"

    if period_key == "hours" and hours is not None:
        shift_start = (
            f"(({alias}.enter_date + coalesce({alias}.enter_time, time '00:00')) "
            f"at time zone 'Asia/Jerusalem')"
        )
        return (
            f"{shift_start} >= (now() at time zone 'utc' - make_interval(hours => {int(hours)}))"
        )

    if period_key == "today":
        return f"{date_col} = {jerusalem_today}"
    if period_key == "yesterday":
        return f"{date_col} = {jerusalem_today} - 1"
    if period_key == "range" and start_date is not None and end_date is not None:
        return (
            f"{date_col} >= '{start_date.isoformat()}' "
            f"and {date_col} <= '{end_date.isoformat()}'"
        )
    return f"{date_col} = {jerusalem_today}"


def _fetch_chart_series(
    cur: Any,
    period_key: str,
    *,
    hours: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    period_sql = _period_sql_for(
        period_key, hours=hours, start_date=start_date, end_date=end_date
    )

    use_hour_buckets = period_key in {"today", "yesterday", "hours"} or (
        period_key == "range"
        and start_date is not None
        and end_date is not None
        and start_date == end_date
    )

    if use_hour_buckets:
        cur.execute(
            f"""
            select
              date_trunc('hour', d.create_date at time zone 'Asia/Jerusalem') as bucket_start,
              coalesce(sum(d.total_bill), 0)::numeric as revenue,
              count(*)::integer as orders
            from no_documents d
            where {period_sql}
            group by 1
            order by 1
            """
        )
        revenue_by_hour: dict[tuple[date, int], float] = {}
        orders_by_hour: dict[tuple[date, int], int] = {}
        for row in cur.fetchall():
            local_hour = _as_jerusalem(row["bucket_start"])
            key = (local_hour.date(), local_hour.hour)
            revenue_by_hour[key] = float(row.get("revenue") or 0)
            orders_by_hour[key] = int(row.get("orders") or 0)
    else:
        cur.execute(
            f"""
            select
              (d.create_date at time zone 'Asia/Jerusalem')::date as bucket_start,
              coalesce(sum(d.total_bill), 0)::numeric as revenue,
              count(*)::integer as orders
            from no_documents d
            where {period_sql}
            group by 1
            order by 1
            """
        )
        revenue_by_hour = {}
        orders_by_hour = {}
        revenue_by_day: dict[date, float] = {}
        orders_by_day: dict[date, int] = {}
        for row in cur.fetchall():
            day_key = row["bucket_start"]
            if not isinstance(day_key, date):
                day_key = day_key.date() if hasattr(day_key, "date") else day_key
            revenue_by_day[day_key] = float(row.get("revenue") or 0)
            orders_by_day[day_key] = int(row.get("orders") or 0)

    now_local = datetime.now(STORE_TZ)
    today = now_local.date()

    if use_hour_buckets:
        if period_key == "yesterday" or (
            period_key == "range" and start_date is not None and start_date < today
        ):
            anchor = (
                today - timedelta(days=1)
                if period_key == "yesterday"
                else start_date
            )
            hour_range = range(0, 24)
        elif period_key == "hours" and hours is not None:
            anchor = today
            hour_range = range(max(0, now_local.hour - hours + 1), now_local.hour + 1)
        elif period_key == "range" and start_date == today:
            anchor = today
            hour_range = range(0, now_local.hour + 1)
        elif period_key == "range" and start_date is not None:
            anchor = start_date
            hour_range = range(0, 24)
        else:
            anchor = today
            hour_range = range(0, now_local.hour + 1)

        slots: list[dict[str, Any]] = []
        for hour in hour_range:
            revenue = revenue_by_hour.get((anchor, hour), 0.0)
            orders = orders_by_hour.get((anchor, hour), 0)
            bucket_dt = datetime.combine(anchor, time(hour, 0), tzinfo=STORE_TZ)
            slots.append(
                {
                    "day": f"{hour:02d}:00",
                    "sub_label": anchor.strftime("%d/%m"),
                    "date": bucket_dt.isoformat(),
                    "revenue": round(revenue, 2),
                    "orders": orders,
                }
            )
        title = "Revenue by Hour"
        granularity = "hour"
    else:
        slots = []
        range_start = start_date if period_key == "range" and start_date else today - timedelta(days=6)
        range_end = end_date if period_key == "range" and end_date else today
        span_days = (range_end - range_start).days
        for offset in range(span_days + 1):
            day = range_start + timedelta(days=offset)
            revenue = revenue_by_day.get(day, 0.0)
            orders = orders_by_day.get(day, 0)
            bucket_dt = datetime.combine(day, time.min, tzinfo=STORE_TZ)
            slots.append(
                {
                    "day": day.strftime("%a"),
                    "sub_label": day.strftime("%d/%m"),
                    "date": bucket_dt.isoformat(),
                    "revenue": round(revenue, 2),
                    "orders": orders,
                }
            )
        title = "Revenue by Day"
        granularity = "day"

    max_rev = max((s["revenue"] for s in slots), default=0.0) or 1.0
    for slot in slots:
        slot["value"] = round((slot["revenue"] / max_rev) * 100, 1) if max_rev else 0.0

    return {"granularity": granularity, "title": title, "points": slots}


def _as_jerusalem(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=STORE_TZ)
    return value.astimezone(STORE_TZ)


def _fetch_daily_sales(
    cur: Any,
    period_key: str,
    *,
    hours: int | None = None,
) -> list[dict[str, Any]]:
    """Deprecated — use _fetch_chart_series."""
    return _fetch_chart_series(cur, period_key, hours=hours)["points"]


def _fetch_top_products(
    cur: Any,
    period_key: str,
    *,
    hours: int | None = None,
    limit: int,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict[str, Any]]:
    period_sql = _period_sql_for(
        period_key, hours=hours, start_date=start_date, end_date=end_date
    )

    cur.execute(
        f"""
        select
          coalesce(max(p.name), max(li.item_name), 'Unknown') as name,
          coalesce(max(p.category_name), 'General') as category,
          coalesce(sum(li.quantity), 0)::numeric as units,
          coalesce(sum(coalesce(li.price, 0) * li.quantity), 0)::numeric as revenue
        from no_document_line_items li
        join no_documents d on d.id = li.document_id
        left join no_products p on p.id = li.product_id
        where {period_sql}
        group by coalesce(li.product_id::text, lower(trim(li.item_name)))
        order by units desc, revenue desc
        limit %s
        """,
        (limit,),
    )
    out: list[dict[str, Any]] = []
    for index, row in enumerate(cur.fetchall(), start=1):
        out.append(
            {
                "rank": index,
                "name": row["name"],
                "category": row["category"],
                "orders": int(float(row["units"])),
                "revenue": round(float(row["revenue"] or 0), 2),
            }
        )
    return out


def _fetch_best_net_revenue(
    cur: Any,
    period_key: str,
    *,
    hours: int | None = None,
    limit: int,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict[str, Any]]:
    period_sql = _period_sql_for(
        period_key, hours=hours, start_date=start_date, end_date=end_date
    )

    cur.execute(
        f"""
        select
          coalesce(max(p.name), max(li.item_name), 'Unknown') as name,
          coalesce(sum(coalesce(li.price, 0) * li.quantity), 0)::numeric as revenue,
          coalesce(sum(coalesce(li.cost, 0) * li.quantity), 0)::numeric as cost
        from no_document_line_items li
        join no_documents d on d.id = li.document_id
        left join no_products p on p.id = li.product_id
        where {period_sql}
        group by coalesce(li.product_id::text, lower(trim(li.item_name)))
        having coalesce(sum(coalesce(li.price, 0) * li.quantity), 0) > 0
        order by (coalesce(sum(coalesce(li.price, 0) * li.quantity), 0)
                  - coalesce(sum(coalesce(li.cost, 0) * li.quantity), 0)) desc
        limit %s
        """,
        (limit,),
    )
    out: list[dict[str, Any]] = []
    for row in cur.fetchall():
        revenue = float(row["revenue"] or 0)
        cost = float(row["cost"] or 0)
        net = revenue - cost
        margin_pct = round((net / revenue) * 100, 1) if revenue > 0 else 0.0
        out.append(
            {
                "name": row["name"],
                "net": round(net, 2),
                "margin_pct": margin_pct,
            }
        )
    return out


def _fetch_recent_orders(
    cur: Any,
    period_key: str,
    *,
    hours: int | None = None,
    limit: int,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict[str, Any]]:
    period_sql = _period_sql_for(
        period_key, hours=hours, start_date=start_date, end_date=end_date
    )

    cur.execute(
        f"""
        select
          d.id,
          d.neworder_id,
          coalesce(d.document_number, d.bill_number, d.neworder_id) as document_number,
          d.create_date,
          coalesce(d.employee_name, '—') as employee_name,
          coalesce(d.total_bill, 0)::numeric as total_bill,
          (
            select li.item_name
            from no_document_line_items li
            where li.document_id = d.id
            order by li.sort_order, li.id
            limit 1
          ) as product_label,
          (
            select count(*)::integer
            from no_document_line_items li
            where li.document_id = d.id
          ) as line_count
        from no_documents d
        where {period_sql}
        order by d.create_date desc nulls last
        limit %s
        """,
        (limit,),
    )
    out: list[dict[str, Any]] = []
    for row in cur.fetchall():
        label = row.get("product_label") or "—"
        line_count = int(row.get("line_count") or 0)
        if line_count > 1:
            label = f"{label} (+{line_count - 1} more)"
        create_date = row.get("create_date")
        out.append(
            {
                "id": str(row["id"]),
                "document_number": row["document_number"],
                "product_label": label,
                "category": "—",
                "date": create_date.isoformat() if create_date else "",
                "status": "completed",
                "total": round(float(row["total_bill"] or 0), 2),
                "employee": row["employee_name"],
            }
        )
    return out


def _count_products(cur: Any) -> int:
    cur.execute("select count(*)::integer as total from no_products")
    row = cur.fetchone()
    return int(row["total"]) if row else 0


def _fetch_products(cur: Any, *, limit: int) -> list[dict[str, Any]]:
    cur.execute(
        """
        select
          p.id,
          p.neworder_id,
          coalesce(nullif(p.barcode, ''), p.neworder_id) as sku,
          p.name,
          coalesce(p.category_name, '—') as category,
          coalesce(p.cost, 0)::numeric as cost,
          coalesce(p.price, 0)::numeric as price,
          coalesce(sum(ps.quantity), 0)::numeric as stock,
          max(t.min_quantity) filter (where t.min_quantity > 0) as min_stock,
          (max(t.min_quantity) filter (where t.min_quantity > 0) is not null) as has_min_threshold,
          p.is_active,
          p.is_stock
        from no_products p
        left join no_product_stock ps on ps.product_id = p.id
        left join no_product_stock_thresholds t on t.product_id = p.id
        where p.is_active = true
        group by p.id
        order by p.name
        limit %s
        """,
        (limit,),
    )
    out: list[dict[str, Any]] = []
    for row in cur.fetchall():
        min_raw = row.get("min_stock")
        has_min = bool(row.get("has_min_threshold"))
        out.append(
            {
                "id": str(row["id"]),
                "sku": row["sku"],
                "name": row["name"],
                "category": row["category"],
                "cost": round(float(row["cost"] or 0), 2),
                "price": round(float(row["price"] or 0), 2),
                "stock": int(float(row["stock"] or 0)),
                "min_stock": round(float(min_raw), 2) if has_min and min_raw is not None else None,
                "has_min_threshold": has_min,
                "is_stock": bool(row["is_stock"]),
                "is_active": bool(row["is_active"]),
            }
        )
    return out


def _fetch_employee_sales(
    cur: Any,
    period_key: str,
    *,
    hours: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict[str, Any]]:
    period_sql = _period_sql_for(
        period_key, hours=hours, start_date=start_date, end_date=end_date
    )

    cur.execute(
        f"""
        select
          coalesce(nullif(trim(d.employee_name), ''), 'Unknown') as name,
          coalesce(sum(d.total_bill), 0)::numeric as sales_total,
          count(*)::integer as order_count
        from no_documents d
        where {period_sql}
        group by 1
        order by sales_total desc, order_count desc
        """
    )
    sales_rows = {str(r["name"]): dict(r) for r in cur.fetchall()}

    attendance_period_sql = _attendance_period_sql(
        period_key,
        hours=hours,
        start_date=start_date,
        end_date=end_date,
    )
    cur.execute(
        f"""
        select
          e.name,
          coalesce(sum(a.total_hours), 0)::numeric as hours_in_period
        from no_employees e
        left join no_employee_attendance a
          on a.employee_id = e.id
         and {attendance_period_sql}
        where e.is_active = true
        group by e.id, e.name
        """
    )
    hours_by_name: dict[str, float] = {}
    for row in cur.fetchall():
        key = str(row["name"]).strip().casefold()
        hours_by_name[key] = float(row["hours_in_period"] or 0)

    names = set(sales_rows)
    out: list[dict[str, Any]] = []
    for name in sorted(names, key=lambda n: float(sales_rows.get(n, {}).get("sales_total") or 0), reverse=True):
        sales = sales_rows.get(name, {})
        hours = round(hours_by_name.get(str(name).strip().casefold(), 0), 1)
        out.append(
            {
                "id": name,
                "name": name,
                "sales_total": round(float(sales.get("sales_total") or 0), 2),
                "order_count": int(sales.get("order_count") or 0),
                "hours_in_period": hours,
            }
        )
    return out


def _fetch_low_stock(cur: Any, *, limit: int) -> list[dict[str, Any]]:
    cur.execute(
        """
        select
          p.id,
          p.name,
          coalesce(nullif(p.barcode, ''), p.neworder_id) as sku,
          coalesce(sum(ps.quantity), 0)::numeric as stock,
          max(t.min_quantity)::numeric as min_stock
        from no_products p
        join no_product_stock_thresholds t on t.product_id = p.id and t.min_quantity > 0
        join no_product_stock ps on ps.product_id = p.id
        where p.is_active = true
          and p.is_stock = true
        group by p.id
        having coalesce(sum(ps.quantity), 0) <= max(t.min_quantity)
        order by coalesce(sum(ps.quantity), 0), p.name
        limit %s
        """,
        (limit,),
    )
    return [
        {
            "id": str(row["id"]),
            "name": row["name"],
            "sku": row["sku"],
            "stock": int(float(row["stock"] or 0)),
            "min_stock": round(float(row["min_stock"] or 0), 2),
            "has_min_threshold": True,
        }
        for row in cur.fetchall()
    ]
