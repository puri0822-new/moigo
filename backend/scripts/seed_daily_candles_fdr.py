"""stock_daily_candles에 과거 일봉을 FinanceDataReader로 한 번에 채우는 1회성 스크립트.

실행 (backend 폴더에서):  venv/Scripts/python.exe scripts/seed_daily_candles_fdr.py
추가 패키지: finance-datareader (런타임에는 필요 없어서 requirements.txt에는 넣지 않았다)

- 오늘 봉은 장중이라 미확정이므로 제외하고 어제까지만 넣는다. 이후 봉은 서버가 토스에서 받아 저장한다.
- 이미 DB에 있는 봉(토스에서 받은 것)은 덮어쓰지 않는다.
- FinanceDataReader와 토스는 시가·거래량이 다를 수 있다(고가·저가·종가는 같았다).
"""
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import FinanceDataReader as fdr  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.dialects.postgresql import insert as pg_insert  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import Stock, StockDailyCandle  # noqa: E402

START = "2020-01-01"
PAUSE_SECONDS = 0.5


def main() -> None:
    today = datetime.now(ZoneInfo("Asia/Seoul")).date()
    with SessionLocal() as db:
        stocks = db.execute(select(Stock).order_by(Stock.id)).scalars().all()
        total_inserted = 0
        for stock in stocks:
            try:
                df = fdr.DataReader(stock.code, START)
            except Exception as e:  # noqa: BLE001 - 외부 라이브러리 오류 종류가 다양하다
                print(f"{stock.code} {stock.name}: 받기 실패 {e!r}")
                continue

            rows = [
                {
                    "stock_id": stock.id,
                    "trade_date": idx.date(),
                    "open_price": int(r.Open),
                    "high_price": int(r.High),
                    "low_price": int(r.Low),
                    "close_price": int(r.Close),
                    "volume": int(r.Volume),
                }
                for idx, r in df.iterrows()
                if idx.date() < today
            ]
            if rows:
                stmt = pg_insert(StockDailyCandle).values(rows).on_conflict_do_nothing(
                    index_elements=["stock_id", "trade_date"]
                )
                result = db.execute(stmt)
                db.commit()
                inserted = result.rowcount
            else:
                inserted = 0
            total_inserted += inserted
            print(f"{stock.code} {stock.name}: 받은 {len(df)}행 중 새로 저장 {inserted}행 "
                  f"({rows[0]['trade_date'] if rows else '-'} ~ {rows[-1]['trade_date'] if rows else '-'})")
            time.sleep(PAUSE_SECONDS)
        print(f"완료: 총 {total_inserted}행 저장")


if __name__ == "__main__":
    main()
