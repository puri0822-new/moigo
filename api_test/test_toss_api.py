"""
토스증권 Open API 호출 테스트
문서: https://openapi.tossinvest.com (OpenAPI 3.1.0, v1.2.17)
인증: OAuth 2.0 Client Credentials Grant
- POST /oauth2/token 으로 access_token 발급 (client 당 유효 토큰 1개, 재발급 시 이전 토큰 즉시 무효화)
- 이후 모든 요청은 Authorization: Bearer {access_token} 헤더 사용
- 403 access_denied 가 뜨면: 토스증권 WTS 설정 > Open API > 허용 IP 관리 에서
  현재 호출 IP가 등록되어 있는지 확인
"""
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("TOSS_CLIENT_ID")
CLIENT_SECRET = os.getenv("TOSS_CLIENT_SECRET")

BASE_URL = "https://openapi.tossinvest.com"


def get_access_token() -> str:
    if not CLIENT_ID or not CLIENT_SECRET:
        print("[FAIL] .env에 TOSS_CLIENT_ID / TOSS_CLIENT_SECRET이 설정되지 않았습니다.")
        sys.exit(1)

    resp = requests.post(
        f"{BASE_URL}/oauth2/token",
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        timeout=5,
    )

    print(f"[TOKEN STATUS] {resp.status_code}")

    if resp.status_code != 200:
        print(f"[FAIL] {resp.text}")
        if resp.status_code == 403:
            print("힌트: 허용 IP 목록에 현재 IP가 등록되어 있는지 확인하세요 "
                  "(토스증권 WTS 설정 > Open API > 허용 IP 관리)")
        sys.exit(1)

    data = resp.json()
    print(f"[OK] token_type={data['token_type']}, expires_in={data['expires_in']}초")
    return data["access_token"]


def get_prices(access_token: str, symbols: str = "005930"):
    resp = requests.get(
        f"{BASE_URL}/api/v1/prices",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"symbols": symbols},
        timeout=5,
    )

    print(f"[PRICES STATUS] {resp.status_code}")

    if resp.status_code != 200:
        print(f"[FAIL] {resp.text}")
        return None

    data = resp.json()
    for item in data.get("result", []):
        print(f"  {item['symbol']}: {item['lastPrice']} {item['currency']} (기준시각 {item['timestamp']})")

    return data


if __name__ == "__main__":
    symbols = sys.argv[1] if len(sys.argv) > 1 else "005930"
    token = get_access_token()
    get_prices(token, symbols)
