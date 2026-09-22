from datetime import datetime

from pydantic import BaseModel


class NewsItem(BaseModel):
    id: int
    title: str
    summary: str | None
    url: str
    source: str | None
    published_at: datetime
