"""
네이버 뉴스 검색 API 호출 테스트 (NAVER API HUB, 2026년 이관 버전)
문서: https://guide.ncloud-docs.com/docs/apihub-migration
- 기존 developers.naver.com 인증 정보는 사용 불가. NCP > NAVER API HUB에서 새로 발급받은
  Client ID / Secret을 사용해야 함.
"""
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/news"


def search_news(query: str, display: int = 10, sort: str = "date"):
    if not CLIENT_ID or not CLIENT_SECRET:
        print("[FAIL] .env에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 설정되지 않았습니다.")
        sys.exit(1)

    headers = {
        "X-NCP-APIGW-API-KEY-ID": CLIENT_ID,
        "X-NCP-APIGW-API-KEY": CLIENT_SECRET,
    }
    params = {
        "query": query,
        "display": display,
        "sort": sort,  # date(최신순) or sim(정확도순)
    }

    resp = requests.get(ENDPOINT, headers=headers, params=params, timeout=5)

    print(f"[STATUS] {resp.status_code}")

    if resp.status_code != 200:
        print(f"[FAIL] {resp.text}")
        return None

    data = resp.json()
    print(f"[OK] total={data.get('total')}, 반환된 기사 수={len(data.get('items', []))}")
    for i, item in enumerate(data.get("items", []), 1):
        title = item["title"].replace("<b>", "").replace("</b>", "").replace("&quot;", '"')
        print(f"  {i}. {title} | {item['pubDate']}")

    return data


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "삼성전자 주가"
    search_news(query)
