import json
import logging
import re
import uuid

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_JSON_RE = re.compile(r"\{[\s\S]*\}")
_BASE_URL = "https://clovastudio.stream.ntruss.com"

_SYSTEM = """당신은 한국 주식 뉴스 분석가다.
주어진 종목의 뉴스 목록만 근거로 요약하고 매매 의견을 낸다.
반드시 아래 JSON만 출력한다. 다른 문구·마크다운 금지.
{
  "summary": "한국어 요약 2~4문장",
  "recommendation": "BUY" | "HOLD" | "SELL",
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE"
}
뉴스가 없거나 판단이 어려우면 HOLD/NEUTRAL로 두고 이유를 summary에 적는다.
"""


def _api_key() -> str:
    return (settings.CLOVA_API_KEY or "").strip()


def _build_user_prompt(stock_name: str, news_items: list[dict]) -> str:
    if not news_items:
        body = "(뉴스 없음)"
    else:
        lines = []
        for i, n in enumerate(news_items, 1):
            lines.append(
                f"{i}. [{n.get('source') or 'unknown'}] {n['title']}\n"
                f"   {n.get('summary') or ''}\n"
                f"   {n.get('published_at')}"
            )
        body = "\n".join(lines)
    return f"종목: {stock_name}\n\n뉴스:\n{body}"


def _parse_result(text: str) -> dict:
    match = _JSON_RE.search(text)
    if not match:
        raise ValueError("CLOVA 응답에서 JSON을 찾지 못했습니다")
    data = json.loads(match.group())
    rec = str(data.get("recommendation", "HOLD")).upper()
    sent = str(data.get("sentiment", "NEUTRAL")).upper()
    if rec not in ("BUY", "HOLD", "SELL"):
        rec = "HOLD"
    if sent not in ("POSITIVE", "NEUTRAL", "NEGATIVE"):
        sent = "NEUTRAL"
    return {
        "summary": str(data.get("summary") or "").strip() or "요약 없음",
        "recommendation": rec,
        "sentiment": sent,
    }


async def analyze_news(stock_name: str, news_items: list[dict]) -> dict | None:
    """뉴스 기반 CLOVA Studio 분석. 키 없거나 실패하면 None."""
    api_key = _api_key()
    if not api_key:
        return None

    model = settings.CLOVA_MODEL or "HCX-005"
    url = f"{_BASE_URL}/v3/chat-completions/{model}"
    payload = {
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _build_user_prompt(stock_name, news_items)},
        ],
        "topP": 0.8,
        "topK": 0,
        "maxTokens": 800,
        "temperature": 0.2,
        "repetitionPenalty": 1.1,
        "stop": [],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-NCP-CLOVASTUDIO-REQUEST-ID": str(uuid.uuid4()),
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code >= 400:
                logger.error("CLOVA 분석 실패 status=%s body=%s", resp.status_code, resp.text[:300])
                return None
            data = resp.json()
        status = (data.get("status") or {}).get("code")
        if status and str(status) not in ("20000", "200"):
            logger.error("CLOVA 분석 실패 status=%s", data.get("status"))
            return None
        text = ((data.get("result") or {}).get("message") or {}).get("content") or ""
        return _parse_result(text)
    except Exception:
        logger.exception("CLOVA 분석 실패")
        return None
