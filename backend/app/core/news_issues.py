"""종목의 최근 핵심 이슈 뉴스.

네이버 뉴스 API는 조회수·인기도를 주지 않으므로, 여러 언론사가 같은 사건을 동시에 다룰수록 큰 이슈로 본다.
최근 기사를 제목이 비슷한 것끼리 묶고, 묶음마다 다룬 언론사 수와 중요 키워드로 점수를 매긴다.
"""
import asyncio
import re
import time
from datetime import datetime, timedelta, timezone

import httpx

from app.core import naver_client

WINDOW_DAYS = 7
CACHE_TTL_SECONDS = 600
SIMILARITY_THRESHOLD = 0.2  # 묶음 기사들과의 제목 글자 2-gram 자카드 유사도 평균이 이 이상이면 같은 사건으로 본다
MERGE_THRESHOLD = 0.13  # 갈라진 묶음끼리의 평균 유사도가 이 이상이면 합친다 (0.1이면 다른 소식까지 섞였다)
MAX_RELATED = 5

# 제목에 있으면 시장에 영향이 큰 소식일 가능성이 높은 말
IMPORTANT_KEYWORDS = [
    "실적", "영업이익", "어닝", "공시", "인수", "합병", "M&A", "수주", "공급계약", "상한가", "하한가",
    "급등", "급락", "신고가", "신저가", "유상증자", "무상증자", "자사주", "배당", "소송", "리콜",
    "승인", "분할", "매각", "제재", "압수수색", "파업", "목표가",
]
KEYWORD_BONUS = 2

# 제목에 있으면 홍보·행사성 보도자료일 가능성이 높은 말
PROMO_KEYWORDS = [
    "수상", "혁신상", "어워즈", "어워드", "브랜드상", "시상", "후원", "기부", "봉사", "나눔", "성금", "장학",
    "사회공헌", "캠페인", "기념식", "협약식", "전달식", "데모데이", "개최", "공모전", "축제", "체험",
    "팝업", "이벤트", "프로모션", "할인", "응원", "다큐",
]
PROMO_PENALTY = 0.2

_BRACKET_RE = re.compile(r"\[[^\]]*\]|\([^)]*\)|【[^】]*】")
_NON_WORD_RE = re.compile(r"[^0-9a-z가-힣]+")

# (이슈 목록, 저장 시각)
_cache: dict[str, tuple[list[dict], float]] = {}


def _bigrams(title: str, names: list[str]) -> set[str]:
    """제목의 글자 2-gram. 모든 기사에 들어가는 종목명과 [단독] 같은 머리말은 빼서 비교를 흐리지 않게 한다."""
    text = _BRACKET_RE.sub(" ", title.lower())
    for name in names:
        text = text.replace(name, " ")
    text = _NON_WORD_RE.sub("", text)
    return {text[i:i + 2] for i in range(len(text) - 1)}


def _similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _cluster(items: list[dict], names: list[str]) -> list[list[dict]]:
    """제목이 비슷한 기사끼리 묶는다. 먼저 나온 기사부터 보며, 기존 묶음의 기사들과의 '평균' 유사도가
    기준 이상일 때만 그 묶음에 넣는다. (한 쌍만 비슷해도 잇는 방식은 두 소식을 한 제목에 담은
    브리핑 기사 하나 때문에 서로 다른 사건이 한 묶음으로 이어져 버린다)"""
    grams = [_bigrams(item["title"], names) for item in items]
    order = sorted(range(len(items)), key=lambda i: items[i]["published_at"])
    groups: list[list[int]] = []
    for i in order:
        best, best_sim = None, SIMILARITY_THRESHOLD
        for group in groups:
            sim = sum(_similarity(grams[i], grams[j]) for j in group) / len(group)
            if sim >= best_sim:
                best, best_sim = group, sim
        if best is None:
            groups.append([i])
        else:
            best.append(i)

    # 같은 사건인데 표현이 달라 갈라진 묶음끼리 다시 합친다 (묶음 사이 평균 유사도가 기준 이상이면).
    # 한 건짜리끼리는 앞 단계에서 이미 비교했으니 건너뛴다.
    sim = [[_similarity(a, b) for b in grams] for a in grams]
    while True:
        pair, pair_sim = None, MERGE_THRESHOLD
        for a in range(len(groups)):
            for b in range(a + 1, len(groups)):
                ga, gb = groups[a], groups[b]
                if len(ga) == 1 and len(gb) == 1:
                    continue
                s = sum(sim[i][j] for i in ga for j in gb) / (len(ga) * len(gb))
                if s >= pair_sim:
                    pair, pair_sim = (a, b), s
        if pair is None:
            break
        a, b = pair
        groups[a] += groups.pop(b)

    clusters = []
    for idxs in groups:
        # 대표 기사: 묶음 안의 다른 제목들과 가장 많이 겹치는 기사 (사건을 가장 잘 요약한 제목)
        def centrality(i: int) -> float:
            return sum(_similarity(grams[i], grams[j]) for j in idxs if j != i)

        rep = max(idxs, key=lambda i: (centrality(i), items[i]["published_at"]))
        others = sorted((i for i in idxs if i != rep), key=lambda i: items[i]["published_at"], reverse=True)
        clusters.append([items[rep]] + [items[i] for i in others])
    return clusters


def _is_promo(cluster: list[dict]) -> bool:
    """보도자료성 소식인지: 묶음 기사 제목의 절반 이상에 홍보·행사성 단어가 있으면."""
    hits = sum(1 for item in cluster if any(w in item["title"] for w in PROMO_KEYWORDS))
    return hits * 2 >= len(cluster)


def _score(cluster: list[dict]) -> tuple[float, list[str]]:
    sources = {item["source"] for item in cluster if item["source"]}
    titles = " ".join(item["title"] for item in cluster)
    tags = [k for k in IMPORTANT_KEYWORDS if k.lower() in titles.lower()]
    score = len(sources) + (KEYWORD_BONUS if tags else 0)
    # 수상·행사·후원 같은 보도자료는 언론사 수십 곳이 받아써도 주가와는 거리가 멀어 크게 깎는다.
    # 단 실적·수주 같은 중요 키워드가 함께 있으면 (예: 행사에서 공급계약 발표) 깎지 않는다
    if not tags and _is_promo(cluster):
        score *= PROMO_PENALTY
    return score, tags


async def _collect(stock_name: str) -> list[dict]:
    """최신순 100건과 정확도순 100건을 합쳐, 최근 WINDOW_DAYS일 안의 종목 기사만 모은다.
    (거래가 많은 종목은 최신순 100건이 몇 시간치뿐이라 정확도순으로 며칠 전 큰 기사를 보충한다)"""
    matched = naver_client.title_matcher(stock_name)
    queries = [stock_name, *naver_client.NEWS_ALIASES.get(stock_name, [])[:1]]
    async with httpx.AsyncClient(timeout=5) as client:
        results = await asyncio.gather(
            *(naver_client.search(client, q, sort) for q in queries for sort in ("date", "sim")),
            return_exceptions=True,
        )
    if all(isinstance(r, Exception) for r in results):
        raise next(r for r in results if isinstance(r, Exception))

    since = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)
    seen: set[str] = set()
    items = []
    for found in results:
        if isinstance(found, Exception):
            continue
        for item in matched(found):
            if item["url"] in seen or item["published_at"] < since:
                continue
            seen.add(item["url"])
            items.append(item)
    return items


async def top_issues(stock_name: str, limit: int = 5) -> list[dict]:
    """종목의 최근 핵심 이슈. 언론사 2곳 이상이 다뤘거나 중요 키워드가 있는 묶음만, 점수가 높은 순서로. 10분간 캐시."""
    now = time.monotonic()
    cached = _cache.get(stock_name)
    if cached and now - cached[1] < CACHE_TTL_SECONDS:
        return cached[0][:limit]

    items = await _collect(stock_name)
    names = [n.lower() for n in (stock_name, *naver_client.NEWS_ALIASES.get(stock_name, []))]

    issues = []
    for cluster in _cluster(items, names):
        score, tags = _score(cluster)
        source_count = len({item["source"] for item in cluster if item["source"]})
        if source_count < 2 and not tags:
            continue
        rep = cluster[0]
        times = [item["published_at"] for item in cluster]
        issues.append({
            "title": rep["title"],
            "summary": rep["summary"],
            "url": rep["url"],
            "source": rep["source"],
            "published_at": rep["published_at"],
            "first_published_at": min(times),
            "latest_published_at": max(times),
            "article_count": len(cluster),
            "source_count": source_count,
            "tags": tags,
            "score": score,
            "related": [
                {"title": item["title"], "url": item["url"], "source": item["source"], "published_at": item["published_at"]}
                for item in cluster[1:1 + MAX_RELATED]
            ],
        })

    # 점수가 같으면 더 최근에 다시 보도된 이슈를 먼저
    issues.sort(key=lambda x: (x["score"], x["latest_published_at"]), reverse=True)
    issues = issues[:10]

    async with httpx.AsyncClient(
        timeout=naver_client.IMAGE_TIMEOUT_SECONDS, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}
    ) as client:
        images = await asyncio.gather(*(naver_client.fetch_og_image(client, x["url"]) for x in issues))
    for issue, image in zip(issues, images):
        issue["image_url"] = image

    _cache[stock_name] = (issues, now)
    return issues[:limit]
