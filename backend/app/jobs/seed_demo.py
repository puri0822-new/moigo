"""전시용 체험 계정 시드. 랭킹·피드가 비어 보이지 않도록 체험 사용자(users.is_demo)와 그 활동을 넣는다.
backend 폴더에서 실행한다. 다시 실행하면 기존 체험 계정(과 거래·글·댓글·좋아요)을 지우고 새로 넣는다.

    venv/bin/python -m app.jobs.seed_demo --dry-run   # DB에 쓰지 않고 결과만 출력
    venv/bin/python -m app.jobs.seed_demo             # 실제로 넣기
    venv/bin/python -m app.jobs.seed_demo --remove    # 체험 계정만 지우기

- 거래는 과거 날짜의 실제 종가(stock_daily_candles)로 체결해, 수익률이 지금 시세로 실제 계산되게 한다
- 오늘 날짜 글은 수집된 실제 뉴스·실제 등락만 언급하고, 이전 날짜 글은 사실을 지어내지 않도록 의견 위주로 쓴다
- 체험 계정은 로그인할 수 없도록 임의 비밀번호를 쓴다
"""

import argparse
import asyncio
import random
import secrets
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.core import toss_client
from app.core.security import hash_password
from app.database import SessionLocal

KST = ZoneInfo("Asia/Seoul")
INITIAL_BALANCE = 10_000_000

# (닉네임, 가입일, [(날짜, 매수/매도, 종목명, 금액 또는 수량)])  금액은 그 금액 안에서 살 수 있는 만큼, "all"은 보유 전량 매도
DEMO_USERS = [
    ("반도체러버", "2026-08-28", [("2026-09-01", "BUY", "삼성전자", 4_000_000), ("2026-09-15", "BUY", "SK하이닉스", 4_500_000),
                                ("2026-10-10", "SELL", "삼성전자", 8)]),
    ("가치투자왕", "2026-08-25", [("2026-09-08", "BUY", "KB금융", 3_000_000), ("2026-09-08", "BUY", "신한지주", 3_000_000),
                                ("2026-09-22", "BUY", "KT&G", 3_000_000)]),
    ("바이오탐험가", "2026-09-01", [("2026-09-03", "BUY", "셀트리온", 3_500_000), ("2026-09-10", "BUY", "삼성바이오로직스", 3_000_000),
                                  ("2026-09-24", "BUY", "한미약품", 2_500_000)]),
    ("2차전지존버", "2026-08-30", [("2026-09-02", "BUY", "LG에너지솔루션", 3_500_000), ("2026-09-02", "BUY", "삼성SDI", 3_000_000),
                                ("2026-09-16", "BUY", "SK이노베이션", 2_500_000)]),
    ("단타의신", "2026-09-20", [("2026-10-01", "BUY", "현대차", 3_000_000), ("2026-10-08", "SELL", "현대차", "all"),
                              ("2026-10-13", "BUY", "크래프톤", 4_000_000), ("2026-10-15", "BUY", "NAVER", 3_000_000)]),
    ("엔터덕후", "2026-09-03", [("2026-09-05", "BUY", "하이브", 4_000_000), ("2026-09-19", "BUY", "SM엔터테인먼트", 3_000_000)]),
    ("배당모아", "2026-08-27", [("2026-09-01", "BUY", "KT&G", 3_000_000), ("2026-09-09", "BUY", "한국전력", 3_000_000),
                              ("2026-09-29", "BUY", "삼성화재", 3_000_000)]),
    ("IT개미", "2026-09-08", [("2026-09-11", "BUY", "NAVER", 3_500_000), ("2026-09-11", "BUY", "카카오", 2_500_000),
                            ("2026-10-06", "BUY", "엔씨소프트", 2_000_000)]),
    ("자동차매니아", "2026-09-02", [("2026-09-04", "BUY", "현대차", 3_500_000), ("2026-09-04", "BUY", "기아", 3_000_000),
                                 ("2026-09-25", "BUY", "현대모비스", 2_000_000)]),
    ("분산투자러", "2026-09-10", [("2026-09-15", "BUY", "삼성전자", 2_500_000), ("2026-09-15", "BUY", "SK하이닉스", 2_000_000),
                                ("2026-09-15", "BUY", "LG화학", 1_500_000), ("2026-09-15", "BUY", "대한항공", 1_500_000),
                                ("2026-10-14", "BUY", "삼성물산", 1_500_000)]),
]

# (작성자, 며칠 전, 시각, 종목명 또는 None, 내용). 0일 전(오늘) 글은 실제 뉴스·실제 등락만 언급한다
DEMO_POSTS = [
    ("반도체러버", 0, "10:12", "SK하이닉스", "오늘 하이닉스 5% 가까이 빠지네요. 코스피 전체가 급락한 날이라 일단 버팁니다. HBM4 증산 일정 기사 나온 거 보면 길게는 괜찮다고 봐요."),
    ("가치투자왕", 0, "11:05", "KT&G", "시장 다 빠지는데 KT&G만 버티는 거 보면 확실히 경기방어주네요. 주주환원이랑 해외 전자담배 직판 기사도 나왔던데 계속 들고 갑니다."),
    ("바이오탐험가", 0, "11:40", "셀트리온", "셀트리온 램시마 일본 점유율 48% 기사 봤어요. 오늘 같은 급락장에서 낙폭이 작은 편이라 든든합니다."),
    ("2차전지존버", 0, "13:20", "LG에너지솔루션", "S&P가 보조금 없는 미래라고 한 기사 때문에 엔솔이 크게 빠졌네요... 존버 중인데 오늘은 좀 아픕니다 😢"),
    ("단타의신", 0, "14:02", "크래프톤", "지스타 2026 출품작 5종 공개됐던데 크래프톤 이번 주 계속 봅니다. 오늘 시장 급락에도 상대적으로 덜 빠진 편."),
    ("IT개미", 0, "14:30", "NAVER", "네이버 데이터센터 성장성 보고 목표가 36만원 리포트 나왔던데, 주가는 오늘 또 내렸네요. 리포트랑 주가가 따로 노는 느낌"),
    ("자동차매니아", 0, "09:48", "현대차", "현대차·기아 레벨4 자율주행 트럭 상용화 기사 좋던데 시장이 다 빠져서 묻혔네요. 오늘 현대차 -5%대..."),
    ("분산투자러", 0, "15:10", "삼성물산", "삼성물산 여의도 시범아파트 재건축 시공사 선정됐다는 기사 보고 지난주에 조금 담았어요. 오늘은 같이 빠졌지만 정비사업 수주는 꾸준할 것 같아요."),
    ("가치투자왕", 0, "15:25", "신한지주", "신한금융이 롯데손보 인수 계약했다는 기사. 보험 이익으로 KB 추격한다는데 금융지주 둘 다 들고 있어서 흥미롭게 보는 중"),
    ("엔터덕후", 0, "12:15", None, "오늘 코스피 진짜 많이 빠졌네요. 이런 날은 앱 안 보는 게 정신건강에 좋은 듯ㅋㅋ"),
    ("배당모아", 0, "13:55", None, "급락장에서 배당주 위주 포트가 확실히 덜 흔들리네요. 오늘 같은 날 버티라고 담아 둔 거라 만족합니다."),
    ("바이오탐험가", 0, "15:40", None, "AI 분석 페이지에서 Claude랑 Gemini가 둘 다 셀트리온 매수 추천했네요. AI 공통 픽에 떠서 신기했어요."),
    ("반도체러버", 1, "20:30", "삼성전자", "삼성전자 일부 익절했는데 남은 물량은 계속 가져갑니다. 반도체는 길게 보는 중"),
    ("IT개미", 1, "19:10", "카카오", "카카오 언제쯤 다시 오를까요... 평단 물려서 그냥 적립식으로 가볼까 고민 중"),
    ("단타의신", 2, "21:05", None, "모의투자라 부담 없이 단타 연습 중인데, 손절 타이밍 잡는 게 제일 어렵네요."),
    ("분산투자러", 2, "18:20", None, "처음엔 한 종목 몰빵했다가 분산으로 바꿨는데, 이번처럼 시장 전체가 빠지면 분산해도 피하기 어렵네요 ㅠ 그래도 공부는 많이 됩니다"),
    ("2차전지존버", 3, "22:00", "삼성SDI", "2차전지 다들 힘드시죠... 그래도 길게 보면 다시 온다고 믿습니다."),
    ("엔터덕후", 3, "17:45", "하이브", "하이브 신인 그룹 소식 꾸준히 보고 있어요. 엔터주는 뉴스 하나에 출렁여서 재밌네요"),
    ("자동차매니아", 4, "20:15", "기아", "기아는 배당도 괜찮아서 그냥 장기 보유용으로 들고 갑니다."),
    ("배당모아", 4, "08:50", "한국전력", "한국전력은 변동성이 커서 비중 조절 중입니다. 다들 배당주 몇 % 정도 담으세요?"),
    ("가치투자왕", 5, "21:40", None, "주간 수익 랭킹 보는 재미가 있네요ㅋㅋ 이번 주는 수비적으로 갑니다."),
    ("IT개미", 5, "12:30", "엔씨소프트", "엔씨 조금 담아봤습니다. 신작 소식 기다리는 중"),
    ("반도체러버", 6, "22:10", None, "모이고 처음 써보는데 AI 추천 근거 뉴스까지 보여줘서 공부가 되네요."),
]

DEMO_COMMENTS = [
    (0, "가치투자왕", "저도 오늘 버티는 중입니다 화이팅!"),
    (0, "분산투자러", "HBM 기사 저도 봤어요. 길게 보면 괜찮을 듯"),
    (1, "배당모아", "KT&G 진짜 효자 종목이네요"),
    (3, "반도체러버", "오늘은 다 같이 아픈 날이네요 ㅠㅠ"),
    (3, "엔터덕후", "존버는 승리한다..!"),
    (4, "IT개미", "크래프톤 신작 기대돼요"),
    (6, "단타의신", "자율주행 트럭 기사 좋던데 아쉽네요"),
    (9, "바이오탐험가", "ㅋㅋㅋ 공감합니다"),
    (9, "2차전지존버", "앱 끄고 내일 봐야겠어요"),
    (11, "반도체러버", "AI 공통 픽 저도 봤어요 ㅎㅎ"),
    (13, "단타의신", "카카오는 저도 물려 있어요..."),
    (15, "가치투자왕", "분산 투자 동의합니다"),
    (16, "자동차매니아", "길게 보면 다시 옵니다!"),
    (19, "가치투자왕", "저는 20% 정도로 두고 있어요"),
]


def _close_on(db, stock_id: int, day: str) -> int:
    row = db.execute(text(
        "SELECT close_price FROM stock_daily_candles WHERE stock_id = :s AND trade_date <= :d ORDER BY trade_date DESC LIMIT 1"
    ), {"s": stock_id, "d": day}).first()
    if not row:
        raise RuntimeError(f"{day} 이전 일봉이 없습니다 (stock_id={stock_id})")
    return int(row[0])


def _plan(db) -> list[dict]:
    """체험 사용자마다 주문·보유·현금을 계산한다 (orders.py와 같은 평균 매수가 계산)."""
    stocks = {name: (sid, code) for sid, name, code in db.execute(text("SELECT id, name, code FROM stocks")).all()}
    plans = []
    for nickname, joined, trades in DEMO_USERS:
        cash = INITIAL_BALANCE
        position: dict[str, tuple[int, int]] = {}
        orders = []
        for i, (day, kind, name, amount) in enumerate(trades):
            sid, code = stocks[name]
            price = _close_on(db, sid, day)
            qty_now, avg = position.get(name, (0, 0))
            if kind == "BUY":
                qty = min(amount, cash) // price
                if qty <= 0:
                    continue
                cash -= qty * price
                total = qty_now + qty
                position[name] = (total, (avg * qty_now + price * qty) // total)
            else:
                qty = qty_now if amount == "all" else min(amount, qty_now)
                if qty <= 0:
                    continue
                cash += qty * price
                position[name] = (qty_now - qty, avg) if qty_now > qty else (0, 0)
            # 장중 체결처럼 보이도록 10시대 시각을 준다
            at = datetime.combine(date.fromisoformat(day), time(10, 5 + i * 7), KST)
            orders.append({"stock_id": sid, "code": code, "name": name, "type": kind, "qty": qty, "price": price, "at": at})
        holdings = {name: v for name, v in position.items() if v[0] > 0}
        plans.append({"nickname": nickname, "joined": joined, "cash": cash, "orders": orders,
                      "holdings": {n: (stocks[n][0], stocks[n][1], q, a) for n, (q, a) in holdings.items()}})
    return plans


def _remove(db) -> int:
    # 계좌·주문·보유·글·댓글·좋아요는 users 외래 키의 ON DELETE CASCADE로 함께 지워진다
    return db.execute(text("DELETE FROM users WHERE is_demo")).rowcount


def _insert(db, plans: list[dict]) -> None:
    now = datetime.now(KST)
    user_ids: dict[str, int] = {}
    for n, p in enumerate(plans, 1):
        joined = datetime.combine(date.fromisoformat(p["joined"]), time(21, 0), KST)
        uid = db.execute(text(
            "INSERT INTO users (email, password_hash, nickname, login_type, is_demo, created_at, updated_at) "
            "VALUES (:e, :pw, :n, 'LOCAL', TRUE, :c, :c) RETURNING id"
        ), {"e": f"demo{n:02d}@demo.moigo.local", "pw": hash_password(secrets.token_urlsafe(24)), "n": p["nickname"], "c": joined}).scalar()
        user_ids[p["nickname"]] = uid
        acc = db.execute(text(
            "INSERT INTO accounts (user_id, balance, initial_balance, created_at, updated_at) VALUES (:u, :b, :i, :c, :c) RETURNING id"
        ), {"u": uid, "b": p["cash"], "i": INITIAL_BALANCE, "c": joined}).scalar()
        for o in p["orders"]:
            db.execute(text(
                "INSERT INTO orders (user_id, account_id, stock_id, order_type, quantity, price, total_amount, ordered_at) "
                "VALUES (:u, :a, :s, :t, :q, :p, :tot, :at)"
            ), {"u": uid, "a": acc, "s": o["stock_id"], "t": o["type"], "q": o["qty"], "p": o["price"], "tot": o["qty"] * o["price"], "at": o["at"]})
        for _, (sid, _, qty, avg) in p["holdings"].items():
            db.execute(text(
                "INSERT INTO holdings (user_id, stock_id, quantity, avg_price, updated_at) VALUES (:u, :s, :q, :a, :t)"
            ), {"u": uid, "s": sid, "q": qty, "a": avg, "t": now})

    stocks = {name: sid for sid, name in db.execute(text("SELECT id, name FROM stocks")).all()}
    times = []
    for i, (_, days_ago, hhmm, _, _) in enumerate(DEMO_POSTS):
        h, m = map(int, hhmm.split(":"))
        at = datetime.combine(now.date() - timedelta(days=days_ago), time(h, m), KST)
        times.append(min(at, now - timedelta(minutes=5 + i)))  # 오늘 아직 안 된 시각이면 지금보다 조금 앞으로
    # 피드 최신순은 글 번호(id) 순이라, 오래된 글부터 넣어야 시간 순서와 번호 순서가 맞는다
    post_ids = [0] * len(DEMO_POSTS)
    for i in sorted(range(len(DEMO_POSTS)), key=lambda i: times[i]):
        author, _, _, stock_name, content = DEMO_POSTS[i]
        post_ids[i] = db.execute(text(
            "INSERT INTO posts (user_id, stock_id, content, created_at) VALUES (:u, :s, :c, :t) RETURNING id"
        ), {"u": user_ids[author], "s": stocks.get(stock_name) if stock_name else None, "c": content, "t": times[i]}).scalar()

    created = {pid: at for pid, at in db.execute(text("SELECT id, created_at FROM posts WHERE id = ANY(:ids)"), {"ids": post_ids}).all()}
    for idx, author, content in DEMO_COMMENTS:
        pid = post_ids[idx]
        db.execute(text("INSERT INTO post_comments (post_id, user_id, content, created_at) VALUES (:p, :u, :c, :t)"),
                   {"p": pid, "u": user_ids[author], "c": content, "t": min(created[pid] + timedelta(minutes=17), now)})

    # 좋아요: 글마다 작성자를 뺀 체험 사용자 중 일부 (같은 결과가 나오도록 시드 고정)
    rng = random.Random(20261021)
    others = list(user_ids.items())
    for pid, (author, *_rest) in zip(post_ids, DEMO_POSTS):
        voters = [uid for name, uid in others if name != author]
        for uid in rng.sample(voters, rng.randint(1, 6)):
            db.execute(text("INSERT INTO post_likes (post_id, user_id, created_at) VALUES (:p, :u, :t) ON CONFLICT DO NOTHING"),
                       {"p": pid, "u": uid, "t": min(created[pid] + timedelta(minutes=30), now)})


async def _print_summary(plans: list[dict]) -> None:
    codes = sorted({c for p in plans for (_, c, _, _) in p["holdings"].values()})
    prices = await toss_client.get_prices(codes)
    rows = []
    for p in plans:
        evals = {n: int(float(prices[c]["lastPrice"])) * q for n, (_, c, q, _) in p["holdings"].items()}
        total = p["cash"] + sum(evals.values())
        rows.append((total, p, evals))
    for rank, (total, p, evals) in enumerate(sorted(rows, key=lambda r: -r[0]), 1):
        rate = (total - INITIAL_BALANCE) / INITIAL_BALANCE * 100
        print(f"{rank:2}. {p['nickname']:<8} 총자산 {total:>12,}원 ({rate:+.2f}%)  현금 {p['cash']:,}원")
        for o in p["orders"]:
            print(f"      {o['at']:%m-%d} {'매수' if o['type'] == 'BUY' else '매도'} {o['name']} {o['qty']}주 @ {o['price']:,}원")
    print(f"\n글 {len(DEMO_POSTS)}개 (오늘 {sum(1 for p in DEMO_POSTS if p[1] == 0)}개), 댓글 {len(DEMO_COMMENTS)}개")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="DB에 쓰지 않고 계획만 출력")
    parser.add_argument("--remove", action="store_true", help="체험 계정만 지운다")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.remove:
            print(f"체험 계정 {_remove(db)}명 삭제")
            db.commit()
            return
        plans = _plan(db)
        asyncio.run(_print_summary(plans))
        if args.dry_run:
            print("\n(dry-run: DB에 쓰지 않았습니다)")
            return
        removed = _remove(db)
        _insert(db, plans)
        db.commit()
        print(f"\n기존 체험 계정 {removed}명 지우고 {len(plans)}명 넣음")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
