from datetime import datetime

from pydantic import BaseModel


class NewsItem(BaseModel):
    id: int
    title: str
    summary: str | None
    url: str
    source: str | None
    published_at: datetime
    image_url: str | None = None


class IssueRelatedArticle(BaseModel):
    title: str
    url: str
    source: str | None
    published_at: datetime


class NewsIssue(BaseModel):
    """여러 언론사가 함께 다룬 하나의 사건(이슈). 대표 기사와 같은 사건의 다른 기사들."""
    id: int
    title: str
    summary: str | None
    url: str
    source: str | None
    published_at: datetime
    image_url: str | None = None
    first_published_at: datetime
    latest_published_at: datetime
    article_count: int
    source_count: int
    tags: list[str]
    related: list[IssueRelatedArticle]
    # 이 종목 주가에 호재(POSITIVE)/중립(NEUTRAL)/악재(NEGATIVE)인지 AI 판단. 아직 판단 못 했으면 null
    sentiment: str | None = None
    sentiment_reason: str | None = None


class IssueStock(BaseModel):
    id: int
    code: str
    name: str


class MarketNewsIssue(NewsIssue):
    """뉴스 탭의 시장 전체 핵심 이슈. 어느 종목의 이슈인지 함께 내려준다 (한 사건이 여러 종목에 걸릴 수 있다)."""
    stocks: list[IssueStock]
