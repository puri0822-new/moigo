from pydantic import BaseModel, Field, field_validator

POST_MAX_LENGTH = 1000
COMMENT_MAX_LENGTH = 500


def _strip_required(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("내용을 입력해주세요")
    return value


class PostCreate(BaseModel):
    content: str = Field(max_length=POST_MAX_LENGTH)
    stock_id: int | None = None

    _strip_content = field_validator("content")(_strip_required)


class CommentCreate(BaseModel):
    content: str = Field(max_length=COMMENT_MAX_LENGTH)

    _strip_content = field_validator("content")(_strip_required)
