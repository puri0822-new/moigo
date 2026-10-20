"""서버 안에서 도는 AI 추천 스케줄러.

10분마다 깨어나서
1) 검증일이 지난 추천을 채점하고
2) 평일 AI_RECOMMEND_HOUR(KST) 이후이고 오늘 장이 열렸으면, 오늘 추천이 없는 모델의 추천을 만든다.
"오늘 이미 만들었는지"를 DB로 확인하므로 서버가 재시작돼도 같은 날 두 번 만들지 않는다.
"""

import asyncio
import logging

from app.core import ai_recommender, llm
from app.core.config import settings
from app.database import SessionLocal

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 600
# 서버가 켜지자마자 외부 API를 몰아 부르지 않도록 첫 실행을 조금 미룬다
STARTUP_DELAY_SECONDS = 60

_lock = asyncio.Lock()


async def run_once() -> None:
    async with _lock:
        db = SessionLocal()
        try:
            await ai_recommender.evaluate_pending(db)

            now = ai_recommender.now_kst()
            if now.hour < settings.AI_RECOMMEND_HOUR or not await ai_recommender.market_closed_today():
                return
            for code in ai_recommender.active_model_codes(db):
                if ai_recommender.generated_today(db, code):
                    continue
                try:
                    await ai_recommender.generate(db, code)
                except llm.LlmError as e:
                    db.rollback()
                    # 다음 주기(10분 뒤)에 다시 시도한다
                    logger.error("AI 추천 생성 실패 %s: %s", code, e)
        except Exception:
            db.rollback()
            logger.exception("AI 스케줄러 실행 중 오류")
        finally:
            db.close()


async def loop() -> None:
    await asyncio.sleep(STARTUP_DELAY_SECONDS)
    while True:
        await run_once()
        await asyncio.sleep(INTERVAL_SECONDS)
