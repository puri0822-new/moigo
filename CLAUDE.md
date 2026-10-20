# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

모이고 (Moigo): a Korean-stock mock-trading web service (AI news analysis is planned). The UI, comments and API messages are all in Korean, so keep new user-facing strings and code comments in Korean to match.

- `backend/`: FastAPI + SQLAlchemy 2 (sync sessions over psycopg2) + PostgreSQL
- `design/`: the frontend (React 18 + TypeScript + Vite). Despite the name, this is the real app, not just mockups.
- `docs/`: `schema.sql`, `seed_stocks.sql`, `migrations/*.sql`, `ERD.md`, `API_SPEC.md` (the copy in `docs/` is canonical, and a duplicate sits at the repo root)
- `api_test/`: standalone scripts that probe the Toss and Naver APIs (they need their own `.env`)

## Commands

The frontend runs from `design/`:
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build; this is the only type check / "lint" step
```

The backend runs from the repo root, using the venv at `backend/venv` (Windows):
```bash
backend/venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/venv/Scripts/python.exe -m uvicorn app.main:app --reload --reload-dir backend/app --app-dir backend --port 8000
```
`.claude/launch.json` defines both of these as `moigo-frontend` and `moigo-backend`.

There is no test suite, linter config or formatter in the repo.

Database setup: run `docs/schema.sql` on a fresh DB, then `docs/seed_stocks.sql`. There is no Alembic. Schema changes go into `schema.sql` and also into a new idempotent `docs/migrations/NNN_*.sql` file, which existing DBs run by hand. When you change the schema, keep `backend/app/models/` in sync with both.

## Configuration

- The backend reads `backend/.env` (path resolved in `app/core/config.py`; see `backend/.env.example`): `DATABASE_URL` (written as `postgresql+asyncpg://`, which `database.py` rewrites to `+psycopg2`), JWT settings, Toss and Naver credentials, and `FIREBASE_SERVICE_ACCOUNT_PATH` (resolved relative to `backend/`; the key lives in the git-ignored `backend/secrets/`).
- The frontend reads `VITE_API_BASE_URL` (default `http://localhost:8000/v1`) and the `VITE_FIREBASE_*` variables.
- The Toss Open API only accepts registered IPs. A 403 `access_denied` means the caller's IP must be added under Toss WTS settings > Open API > 허용 IP 관리.

## Backend architecture

- **Response envelope**: every endpoint returns `{"success", "data", "message"}`. `main.py` rewrites `HTTPException` and validation errors into this shape, so raise `HTTPException(status, detail="한국어 메시지")` and the frontend will display `message`. All routers are mounted under `/v1`.
- **Auth**: there are two ways to log in. Email and password use bcrypt, and Google login goes through a Firebase ID token verified in `core/firebase.py`. Both issue the app's own JWT. Protected routes use `Depends(get_current_user)` from `core/dependencies.py`. Signing up also creates the user's 1:1 `Account` (₩10,000,000 virtual cash).
- **Market data never comes from Toss on a user request.** Two background loops start in the `main.py` lifespan:
  - `core/price_sync.py` refreshes the `stock_price_cache` table from the Toss rankings API (top 100 by trading value, `1d`) every 30 s. For stocks outside the top 100 it computes prices from the current-price and daily-candle endpoints. List, ranking and portfolio endpoints read only this table (`core/price_cache.py`).
  - `core/order_matching.py` re-matches `PENDING` orders against the live order book every 3 s. A fill walks the book level by level (`plan_fill`), with no partial fills. Limit orders never fill at a price worse than their limit. Orders expire at market close (KRX 09:00–15:30 KST, `core/market_hours.py`), and a stale order book (one from a holiday) is never used for a fill. Cash reserved by pending buys is subtracted from the available balance.
- **`core/toss_client.py`** is the only place that talks to Toss. It handles the OAuth client-credentials token (only one token is valid per client), a global rate limiter (16 req/s against a 20/s limit, with 429 retries), and short in-memory TTL caches. The price and order-book caches are 2 s, kept below the frontend's 3 s polling interval on purpose. Route new Toss calls through this module and reuse the shared semaphore in `core/price_fetch.py` for fan-out candle calls.
- **Daily candles** are persisted in `stock_daily_candles` (`core/candle_store.py`). Past bars are fetched once. Only the most recent few bars are re-fetched, at most every 2 s. `candle_agg.py` builds weekly and monthly bars from them.
- Market indices (KOSPI/KOSDAQ) and news come from Naver (`naver_index.py`, `naver_client.py`).
- The routers use sync `Session` from `get_db()`. The background loops are async but open their own `SessionLocal()`.

## Frontend architecture

- Routes live in `App.tsx`. `/`, `/login` and `/signup` are public. Everything else sits behind `PrivateRoute` inside `AppLayout` (header plus `GlobalRightPanel`).
- `lib/api.ts` holds all API calls and response types. It has a fetch-based `request()` helper that attaches `localStorage.access_token` and throws `Error(message)` when `success` is false, plus an axios instance. `AuthContext` stores `access_token` and `nickname` in localStorage.
- Styling uses **inline styles driven by `ThemeContext`** (`const { theme } = useTheme()`, e.g. `theme.bg` and `theme.text`). There are no CSS classes or CSS framework.
- Charts use `lightweight-charts`. It cannot parse `oklch()` colors, so pass every color through `lib/color.ts#toRgb` first.
- Pages poll for live data (stock detail every 3 s). `data/mockData.ts` still supplies the AI recommendations and insights that have no backend yet.
