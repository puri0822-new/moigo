import httpx

# 외부 API(토스/네이버) 호출에 공용으로 쓰는 클라이언트.
# 요청마다 새로 만들면 매번 TCP/TLS 연결을 새로 맺어 수백 ms씩 느려지므로 연결을 재사용한다.
client = httpx.AsyncClient(
    timeout=5,
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
)


async def close() -> None:
    await client.aclose()
