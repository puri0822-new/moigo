import asyncio
import json
import logging
import re

from google import genai

from app.core.config import settings

logger = logging.getLogger(__name__)

_JSON_RE = re.compile(r"\{[\s\S]*\}")

_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "한국어 요약 2~4문장"},
        "recommendation": {
            "type": "string",
            "enum": ["BUY", "HOLD", "SELL"],
            "description": "매매 의견",
        },
        "sentiment": {
            "type": "string",
            "enum": ["POSITIVE", "NEUTRAL", "NEGATIVE"],
            "description": "뉴스 전반 감성",
        },
    },
    "required": ["summary", "recommendation", "sentiment"],
}

_SYSTEM = """당신은 한국 주식 뉴스 분석가다.
주어진 종목의 뉴스 목록만 근거로 요약하고 매매 의견을 낸다.
뉴스가 없거나 판단이 어려우면 HOLD/NEUTRAL로 두고 이유를 summary에 적는다.
"""


def _api_key() -> str:
    return (settings.GOOGLE_API_KEY or settings.GEMINI_API_KEY or "").strip()


def _build_prompt(stock_name: str, news_items: list[dict]) -> str:
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
    return f"{_SYSTEM}\n\n종목: {stock_name}\n\n뉴스:\n{body}"


def _parse_result(text: str) -> dict:
    match = _JSON_RE.search(text)
    if not match:
        raise ValueError("Gemini 응답에서 JSON을 찾지 못했습니다")
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


def _extract_text_from_interaction(interaction) -> str:
    text = getattr(interaction, "output_text", None)
    if isinstance(text, str) and text.strip():
        return text

    steps = getattr(interaction, "steps", None) or []
    chunks: list[str] = []
    for step in steps:
        step_type = step.get("type") if isinstance(step, dict) else getattr(step, "type", None)
        if step_type != "model_output":
            continue
        content = step.get("content") if isinstance(step, dict) else getattr(step, "content", None)
        if not content:
            continue
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text" and block.get("text"):
                    chunks.append(block["text"])
            else:
                block_type = getattr(block, "type", None)
                block_text = getattr(block, "text", None)
                if block_type == "text" and block_text:
                    chunks.append(block_text)
    if chunks:
        return "\n".join(chunks)
    raise ValueError("Gemini 응답에서 텍스트를 찾지 못했습니다")


def _analyze_sync(stock_name: str, news_items: list[dict]) -> dict:
    client = genai.Client(api_key=_api_key())
    interaction = client.interactions.create(
        model=settings.GEMINI_MODEL,
        input=_build_prompt(stock_name, news_items),
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": _ANALYSIS_SCHEMA,
        },
    )
    return _parse_result(_extract_text_from_interaction(interaction))


async def analyze_news(stock_name: str, news_items: list[dict]) -> dict | None:
    """뉴스 기반 Gemini 분석. 키 없거나 실패하면 None."""
    if not _api_key():
        return None

    try:
        return await asyncio.to_thread(_analyze_sync, stock_name, news_items)
    except Exception as e:
        # 키 값이 예외 메시지에 섞일 수 있어 메시지는 짧게만 남긴다
        logger.error("Gemini 분석 실패: %s: %s", type(e).__name__, str(e)[:300])
        return None
