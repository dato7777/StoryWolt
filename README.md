# Story Phone — Wolt Net Income (Serverless)

Serverless dashboard that calculates **net income after Wolt commission** for Story Phone.

## Upload files

### Required: `orderNumbers.csv`

Example: `../../sales 0106-1506 orderNumbers.csv`

Only **delivered** orders are used. **Rejected** orders are excluded (matches Wolt invoice).

### Optional: `itemsSold.csv`

Example: `../../sales 0106-1506 itemsSold.csv`

Adds merchant SKUs to the product view. Not used for totals when orderNumbers is uploaded.

| Column (orderNumbers) | Required | Purpose |
|--------|----------|---------|
| Order number | Yes | Order tab grouping |
| Delivery status | Yes | Filter delivered vs rejected |
| Items | Yes | Per-item lines inside each order |
| Price | Yes | Order gross (commission base) |

| Column (itemsSold) | Required | Purpose |
|--------|----------|---------|
| Item name | Yes | SKU enrichment |
| Merchant SKU | No | Faster matching |

## Commission formula

```
commission_before_vat = sold_total × (commission_percent / 100)   # sold_total from itemsSold.csv
total_wolt_commission = commission_before_vat × 1.18   # VAT on Wolt fee
net_income = sold_total - total_wolt_commission
```

List prices from `offers_commission.xlsx` are shown for reference only; fees match Wolt invoices on actual sold amounts.

Commission rates come from `data/offers_commission.xlsx` (merchant SKU + name + fee %).

## Architecture

```
wolt-net-income/
├── api/                    # Vercel Python serverless functions
│   ├── commission_engine.py  # Core calculation logic (commented)
│   ├── calculate.py          # POST /api/calculate
│   └── health.py             # GET /api/health
├── data/
│   └── offers_commission.xlsx
├── frontend/               # React + Vite + Tailwind dashboard
├── supabase/
│   └── schema.sql          # Future PostgreSQL tables
├── dev_server.py           # Local API for development
└── vercel.json             # Serverless deployment config
```

**Why serverless (Vercel)?** No 50–60s Render cold start; functions spin up in milliseconds.

**Database (Supabase):** `supabase/schema.sql` defines commission catalog + saved report timelines. Set `DATABASE_URL` in `.env` / Vercel env vars.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | For DB features | Supabase PostgreSQL URI (Settings → Database) |
| `OFFERS_XLSX_PATH` | No | Local xlsx fallback if DB unset |

### Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in **SQL Editor**.
3. Add `DATABASE_URL` to `.env` (use pooler URI for Vercel).
4. Seed commission catalog (move off public GitHub):

```bash
pip install -r requirements.txt
python scripts/seed_commission_offers.py
```

After setup: each **Calculate** saves a timeline; **Saved reports** buttons on the dashboard reload any period instantly.

## Admin login (no Supabase)

The dashboard is gated behind admin login. Credentials live in **environment variables** on the server — never in the frontend.

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | **Yes** | Admin password |
| `ADMIN_USERNAME` | No | Login name (default: `admin`) |
| `AUTH_SECRET` | Production | Random string to sign session tokens |
| `AUTH_TOKEN_TTL_SECONDS` | No | Session length (default: 86400 = 24h) |

### Local development

```bash
cd STORY/wolt-net-income
cp .env.example .env
# Edit .env — set ADMIN_PASSWORD and AUTH_SECRET
python3 dev_server.py
```

`dev_server.py` loads `.env` from the project root automatically.

### Vercel deployment

Project → **Settings** → **Environment Variables** — add the same names (`ADMIN_PASSWORD`, `AUTH_SECRET`, etc.) for Production.

After login, the browser stores a signed token in `sessionStorage` (cleared when the tab closes). All `POST /api/calculate` requests require `Authorization: Bearer <token>`.

## Local development

### 1. Python API

```bash
cd STORY/wolt-net-income
pip install -r requirements.txt
python dev_server.py
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to port 3001.

### 3. Test calculation from CLI

```bash
python -c "
from pathlib import Path
import sys
sys.path.insert(0, 'api')
from commission_engine import run_calculation
csv = Path('../../sales 0106-1506 itemsSold.csv').read_text(encoding='utf-8')
result = run_calculation(csv, Path('data/offers_commission.xlsx'))
print(result['summary'])
"
```

## Deploy to Vercel

```bash
npm i -g vercel
cd STORY/wolt-net-income
vercel
```

Set environment variable (optional):

- `OFFERS_XLSX_PATH` — override path to commission workbook

## API

### `POST /api/calculate`

```json
{ "csvText": "Merchant SKU,GTIN,Item name,Total,Quantity,POS ID\n..." }
```

### `GET /api/health`

Returns `{ "status": "ok" }`.
