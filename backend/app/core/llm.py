"""AI 모델 호출. 모델마다 API가 달라도 '시스템 지시 + 사용자 입력 → JSON 객체' 하나로 맞춘다.
ai_models.code로 어떤 API를 쓸지 고르고, 키가 없는 모델은 사용할 수 없는 것으로 본다."""

import asyncio
import json
import logging
import re
import uuid
from collections.abc import Awaitable, Callable

import anthropic
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 120
# 일시적인 과부하(503)·요청 제한(429)은 잠시 기다렸다 다시 시도한다
RETRY_STATUS = (429, 503)
RETRY_DELAYS_SECONDS = (5, 20)
_JSON_RE = re.compile(r"\{[\s\S]*\}")


class LlmError(Exception):
    def __init__(self, message: str, status: int | None = None, raw_text: str | None = None):
        super().__init__(message)
        self.status = status
        # JSON을 못 찾았을 때 모델이 실제로 돌려준 글
        self.raw_text = raw_text


def _parse_json(text: str) -> dict:
    # 모델이 JSON 앞뒤에 설명이나 ```json 표시를 붙여도 본문 객체만 꺼낸다
    match = _JSON_RE.search(text)
    if not match:
        raise LlmError(f"응답에서 JSON을 찾지 못했습니다: {text[:200]}", raw_text=text)
    try:
        return json.loads(match.group())
    except json.JSONDecodeError as e:
        raise LlmError(f"JSON 해석 실패: {e}") from e


async def _clova(system: str, user: str, max_tokens: int) -> dict:
    url = f"https://clovastudio.stream.ntruss.com/v3/chat-completions/{settings.CLOVA_MODEL}"
    payload = {
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "maxTokens": max_tokens,
        "temperature": 0.3,
        "topP": 0.8,
        "repetitionPenalty": 1.1,
    }
    headers = {
        "Authorization": f"Bearer {settings.CLOVA_API_KEY}",
        "X-NCP-CLOVASTUDIO-REQUEST-ID": str(uuid.uuid4()),
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        resp = await client.post(url, headers=headers, json=payload)
    if resp.status_code >= 400:
        raise LlmError(f"CLOVA {resp.status_code}: {resp.text[:300]}", resp.status_code)
    data = resp.json()
    code = str((data.get("status") or {}).get("code", ""))
    if code and code != "20000":
        raise LlmError(f"CLOVA 상태 {data.get('status')}")
    return _parse_json(((data.get("result") or {}).get("message") or {}).get("content") or "")


async def _gemini(system: str, user: str, max_tokens: int) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.3,
            "maxOutputTokens": max_tokens,
            # 생각을 길게 하면 응답이 수십 초씩 늦어진다. 뉴스 요약·판단에는 짧게도 충분하다
            "thinkingConfig": {"thinkingLevel": "low"},
        },
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        resp = await client.post(url, headers={"x-goog-api-key": settings.GEMINI_API_KEY}, json=payload)
    if resp.status_code >= 400:
        raise LlmError(f"Gemini {resp.status_code}: {resp.text[:300]}", resp.status_code)
    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise LlmError(f"Gemini 응답 없음: {json.dumps(data)[:300]}")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return _parse_json("".join(p.get("text", "") for p in parts))


async def _claude(system: str, user: str, max_tokens: int) -> dict:
    # 공식 SDK를 쓴다. SDK가 429·5xx를 알아서 재시도하므로 여기서는 상태 코드를 넘기지 않아 이중 재시도를 막는다
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=TIMEOUT_SECONDS * 2)
    try:
        response = await client.beta.messages.create(
            model=settings.ANTHROPIC_MODEL,
            # 생각(thinking)이 항상 켜져 있고 그 토큰도 max_tokens에 들어가므로 넉넉히 준다
            max_tokens=max(max_tokens, 16000),
            output_config={"effort": "high"},
            # 안전 분류기가 거절하면 서버가 권장 모델로 다시 돌린다
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=system,
            messages=[{"role": "user", "content": user}],
        )
    except anthropic.APIStatusError as e:
        raise LlmError(f"Claude {e.status_code}: {e.message} (request_id={e.request_id})") from e
    except anthropic.APIConnectionError as e:
        raise LlmError(f"Claude 연결 실패: {e}") from e
    finally:
        await client.close()
    if response.stop_reason == "refusal":
        raise LlmError(f"Claude가 요청을 거절했습니다 (request_id={response._request_id})")
    if response.stop_reason == "max_tokens":
        raise LlmError(f"Claude 응답이 max_tokens에서 잘렸습니다 (request_id={response._request_id})")
    return _parse_json("".join(b.text for b in response.content if b.type == "text"))


# ai_models.code → (호출 함수, 키)
_PROVIDERS: dict[str, tuple[Callable[[str, str, int], Awaitable[dict]], Callable[[], str]]] = {
    "CLOVA": (_clova, lambda: settings.CLOVA_API_KEY),
    "GEMINI": (_gemini, lambda: settings.GEMINI_API_KEY),
    "CLAUDE": (_claude, lambda: settings.ANTHROPIC_API_KEY),
}


def is_available(model_code: str) -> bool:
    provider = _PROVIDERS.get(model_code)
    return bool(provider and provider[1]().strip())


async def complete_json(model_code: str, system: str, user: str, max_tokens: int = 4000) -> dict:
    """모델에게 JSON 객체 하나를 받아 온다. 실패하면 LlmError."""
    if not is_available(model_code):
        raise LlmError(f"{model_code}: 사용할 수 없는 모델입니다 (키가 없거나 연결되지 않음)")
    call, _ = _PROVIDERS[model_code]
    for delay in (*RETRY_DELAYS_SECONDS, None):
        try:
            return await call(system, user, max_tokens)
        except httpx.HTTPError as e:
            raise LlmError(f"{model_code} 호출 실패: {type(e).__name__} {e}") from e
        except LlmError as e:
            if e.status not in RETRY_STATUS or delay is None:
                raise
            logger.warning("%s %s, %d초 뒤 다시 시도", model_code, e.status, delay)
            await asyncio.sleep(delay)
    raise AssertionError("unreachable")
