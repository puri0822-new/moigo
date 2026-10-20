"""AI 추천을 손으로 실행하는 명령. backend 폴더에서 실행한다.

    venv/bin/python -m app.jobs.ai_jobs generate              # 오늘 추천이 없는 모델만 추천 생성
    venv/bin/python -m app.jobs.ai_jobs generate --model CLOVA --force   # 오늘 만들었어도 다시 생성
    venv/bin/python -m app.jobs.ai_jobs evaluate              # 검증일이 지난 추천 채점
    venv/bin/python -m app.jobs.ai_jobs summarize             # 한 줄 요약(summary)이 없는 추천 채우기

장중에 만들면 추천가가 그 순간 현재가가 된다. 자동 실행(평일 장 마감 뒤)과 기준이 달라지니 테스트용으로만 쓴다.
"""

import argparse
import asyncio
import logging

from app.core import ai_recommender, llm
from app.database import SessionLocal


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["generate", "evaluate", "summarize"])
    parser.add_argument("--model", help="ai_models.code (예: CLOVA). 없으면 사용 가능한 모델 모두")
    parser.add_argument("--force", action="store_true", help="오늘 이미 만들었어도 다시 만든다")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.command == "evaluate":
            print(f"채점: {await ai_recommender.evaluate_pending(db)}개")
            return
        if args.command == "summarize":
            print(f"요약 채움: {await ai_recommender.fill_missing_summaries(db)}개")
            return

        codes = [args.model] if args.model else ai_recommender.active_model_codes(db)
        for code in codes:
            if not args.force and ai_recommender.generated_today(db, code):
                print(f"{code}: 오늘 이미 추천을 만들었습니다 (--force로 다시 만들 수 있음)")
                continue
            try:
                recs = await ai_recommender.generate(db, code)
            except llm.LlmError as e:
                db.rollback()
                print(f"{code}: 실패 — {e}")
                continue
            print(f"{code}: {len(recs)}개 저장")
            for r in recs:
                print(f"  [{r.period_type}] stock_id={r.stock_id} {r.opinion} {r.price_at_recommendation:,}원 — {r.reason}")
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(main())
