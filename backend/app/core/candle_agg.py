from datetime import date


def _period_key(day: date, interval: str) -> tuple:
    if interval == "1w":
        iso = day.isocalendar()
        return (iso.year, iso.week)
    if interval == "1mo":
        return (day.year, day.month)
    if interval == "1y":
        return (day.year,)
    raise ValueError(f"묶을 수 없는 interval: {interval}")


def aggregate_daily(candles: list[dict], interval: str) -> list[dict]:
    """오래된 봉부터 정렬된 일봉을 주/월/년 단위 봉으로 묶는다.
    시가는 기간 첫 거래일의 시가, 종가는 마지막 거래일의 종가, 고가/저가는 기간 내 최고/최저,
    거래량은 합계. 봉의 시각은 기간 첫 거래일의 것을 쓴다."""
    bars: list[dict] = []
    current_key = None
    for c in candles:
        key = _period_key(date.fromisoformat(c["timestamp"][:10]), interval)
        o, h, l, cl, v = (float(c[k]) for k in ("openPrice", "highPrice", "lowPrice", "closePrice", "volume"))
        if key != current_key:
            bars.append({"timestamp": c["timestamp"], "openPrice": o, "highPrice": h, "lowPrice": l, "closePrice": cl, "volume": v})
            current_key = key
        else:
            bar = bars[-1]
            bar["highPrice"] = max(bar["highPrice"], h)
            bar["lowPrice"] = min(bar["lowPrice"], l)
            bar["closePrice"] = cl
            bar["volume"] += v
    return bars
