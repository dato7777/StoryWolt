"""HTTP client for the NewOrder read-only API."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class NewOrderApiError(Exception):
    def __init__(self, message: str, *, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class NewOrderClient:
    def __init__(
        self,
        token: str,
        *,
        base_url: str | None = None,
        max_calls: int = 95,
    ) -> None:
        self.token = token.strip()
        if not self.token:
            raise NewOrderApiError("NEWORDER_API_TOKEN is empty")
        self.base_url = (
            base_url or os.environ.get("NEWORDER_API_BASE", "https://neworderapi.azurewebsites.net")
        ).rstrip("/")
        self.max_calls = max(1, max_calls)
        self.api_calls = 0
        self.rate_limit_current: int | None = None
        self.rate_limit_max: int | None = None

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        if self.api_calls >= self.max_calls:
            raise NewOrderApiError(
                f"Stopped after {self.api_calls} API calls (limit {self.max_calls})"
            )

        query = urllib.parse.urlencode(
            {k: v for k, v in (params or {}).items() if v is not None and v != ""},
            doseq=True,
        )
        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{query}"

        request = urllib.request.Request(
            url,
            method="GET",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                self.api_calls += 1
                self._read_rate_limit_headers(response.headers)
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            self.api_calls += 1
            body = exc.read().decode("utf-8", errors="replace")
            raise NewOrderApiError(
                f"NewOrder API HTTP {exc.code}: {body[:300] or exc.reason}",
                status=exc.code,
            ) from exc
        except urllib.error.URLError as exc:
            raise NewOrderApiError(f"NewOrder API network error: {exc.reason}") from exc

        if not raw.strip():
            return []
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise NewOrderApiError("NewOrder API returned invalid JSON") from exc

    def _read_rate_limit_headers(self, headers: Any) -> None:
        for key, attr in (
            ("X-Rate-Limit-Current", "rate_limit_current"),
            ("X-Rate-Limit-Maximum", "rate_limit_max"),
        ):
            value = headers.get(key)
            if value is not None:
                try:
                    setattr(self, attr, int(value))
                except ValueError:
                    pass

    def get_paginated_list(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        page_size: int = 200,
    ) -> list[Any]:
        """Fetch all pages until a short page or API call budget is exhausted."""
        merged = dict(params or {})
        merged.setdefault("page_size", page_size)
        page_num = 1
        items: list[Any] = []

        while True:
            merged["page_num"] = page_num
            batch = self.get(path, merged)
            rows = as_list(batch)
            if not rows:
                break
            items.extend(rows)
            if len(rows) < page_size:
                break
            page_num += 1

        return items


def as_list(payload: Any) -> list[Any]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in (
            "items",
            "data",
            "results",
            "products",
            "documents",
            "branches",
            "categories",
            "suppliers",
            "customers",
            "employees",
            "attendance",
            "lineitems",
            "lineItems",
        ):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return [payload]


def is_configured() -> bool:
    return bool(os.environ.get("NEWORDER_API_TOKEN", "").strip())
