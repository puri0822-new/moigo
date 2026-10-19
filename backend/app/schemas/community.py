import re

from pydantic import BaseModel, Field, field_validator

from app.core.uploads import POST_IMAGE_URL_PREFIX

POST_MAX_LENGTH = 1000
COMMENT_MAX_LENGTH = 500

# 업로드 API가 돌려준 경로만 받는다 (임의의 외부 주소나 다른 경로를 글에 붙이지 못하게)
_POST_IMAGE_URL_RE = re.compile(rf"^{re.escape(POST_IMAGE_URL_PREFIX)}/[0-9a-f]{{32}}\.(jpg|png|webp)$")


def _strip_required(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("내용을 입력해주세요")
    return value


class PostCreate(BaseModel):
    content: str = Field(max_length=POST_MAX_LENGTH)
    stock_id: int | None = None
    image_url: str | None = None

    _strip_content = field_validator("content")(_strip_required)

    @field_validator("image_url")
    @classmethod
    def _check_image_url(cls, value: str | None) -> str | None:
        if value is not None and not _POST_IMAGE_URL_RE.match(value):
            raise ValueError("올바르지 않은 사진 경로입니다")
        return value


class CommentCreate(BaseModel):
    content: str = Field(max_length=COMMENT_MAX_LENGTH)

    _strip_content = field_validator("content")(_strip_required)
