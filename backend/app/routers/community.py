from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy import exists, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.uploads import POST_IMAGE_DIR, POST_IMAGE_URL_PREFIX
from app.database import get_db
from app.models.community import Post, PostComment, PostLike
from app.models.stock import Stock
from app.models.user import User
from app.schemas.community import CommentCreate, PostCreate

router = APIRouter(prefix="/posts", tags=["community"])

IMAGE_MAX_BYTES = 5 * 1024 * 1024
# 인기 글·많이 언급된 종목을 집계하는 기간
TREND_WINDOW = text("posts.created_at >= now() - interval '7 days'")


def _image_extension(data: bytes) -> str | None:
    """파일 앞부분으로 실제 형식을 판별한다 (클라이언트가 보낸 파일명·Content-Type은 믿지 않는다)."""
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _image_path(image_url: str):
    return POST_IMAGE_DIR / image_url.rsplit("/", 1)[-1]


PostSort = Literal["latest", "oldest", "popular"]


def _load_posts(
    db: Session, me: User, *where, limit: int | None = None, offset: int = 0, sort: PostSort = "latest"
) -> list[dict]:
    """글과 작성자·종목·좋아요 수·댓글 수·내가 좋아요 했는지를 한 번에 조회.
    sort: latest(최신순) / oldest(오래된순) / popular(좋아요, 같으면 댓글이 많은 순)."""
    like_count = select(func.count()).where(PostLike.post_id == Post.id).correlate(Post).scalar_subquery()
    comment_count = select(func.count()).where(PostComment.post_id == Post.id).correlate(Post).scalar_subquery()
    liked_by_me = exists().where(PostLike.post_id == Post.id, PostLike.user_id == me.id).correlate(Post)

    query = (
        select(Post, User.nickname, Stock, like_count, comment_count, liked_by_me)
        .join(User, User.id == Post.user_id)
        .outerjoin(Stock, Stock.id == Post.stock_id)
        .where(*where)
    )
    if sort == "oldest":
        query = query.order_by(Post.id)
    elif sort == "popular":
        query = query.order_by(like_count.desc(), comment_count.desc(), Post.id.desc())
    else:
        query = query.order_by(Post.id.desc())
    if offset:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)

    return [
        {
            "id": post.id,
            "author": nickname,
            "is_mine": post.user_id == me.id,
            "content": post.content,
            "image_url": post.image_url,
            "stock": {"id": stock.id, "code": stock.code, "name": stock.name} if stock else None,
            "like_count": likes,
            "comment_count": comments,
            "liked": liked,
            "created_at": post.created_at,
        }
        for post, nickname, stock, likes, comments, liked in db.execute(query).all()
    ]


def _check_image(db: Session, image_url: str | None, post_id: int | None = None) -> None:
    """글에 붙이려는 사진이 실제로 올라와 있고 다른 글에 쓰이지 않았는지 확인한다.
    (다른 글의 사진 경로를 붙였다가 자기 글을 지워 남의 사진 파일을 지우는 일을 막는다)"""
    if image_url is None:
        return
    if not _image_path(image_url).is_file():
        raise HTTPException(status_code=400, detail="사진을 찾을 수 없습니다. 다시 올려주세요")
    used = db.query(Post.id).filter(Post.image_url == image_url, Post.id != post_id).first()
    if used:
        raise HTTPException(status_code=400, detail="이미 다른 글에 쓰인 사진입니다")


def _get_post_or_404(db: Session, post_id: int) -> Post:
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다")
    return post


def _comment_dict(comment: PostComment, nickname: str, me: User) -> dict:
    return {
        "id": comment.id,
        "author": nickname,
        "is_mine": comment.user_id == me.id,
        "content": comment.content,
        "created_at": comment.created_at,
    }


@router.get("")
def list_posts(
    stock_id: int | None = None,
    before_id: int | None = None,
    sort: PostSort = "latest",
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """피드. stock_id를 주면 그 종목 글만. 이어 받기는 최신순이면 before_id(그보다 오래된 글),
    오래된순·인기순이면 offset(이미 받은 글 수)을 쓴다."""
    where = []
    if stock_id is not None:
        where.append(Post.stock_id == stock_id)
    if before_id is not None:
        where.append(Post.id < before_id)

    data = _load_posts(db, current_user, *where, limit=limit, offset=offset, sort=sort)
    return {"success": True, "data": data, "message": "요청 성공"}


@router.get("/popular")
def list_popular_posts(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """최근 7일 글 중 좋아요(같으면 댓글)가 많은 순."""
    data = _load_posts(db, current_user, TREND_WINDOW, limit=limit, sort="popular")
    return {"success": True, "data": data, "message": "요청 성공"}


@router.get("/trending-stocks")
def list_trending_stocks(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """최근 7일 동안 글이 많이 달린 종목."""
    post_count = func.count(Post.id)
    rows = db.execute(
        select(Stock, post_count)
        .join(Post, Post.stock_id == Stock.id)
        .where(TREND_WINDOW)
        .group_by(Stock.id)
        .order_by(post_count.desc(), Stock.id)
        .limit(limit)
    ).all()

    data = [{"id": stock.id, "code": stock.code, "name": stock.name, "post_count": count} for stock, count in rows]
    return {"success": True, "data": data, "message": "요청 성공"}


@router.post("/images", status_code=201)
async def upload_post_image(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    """글에 붙일 사진을 올린다. 돌려받은 image_url을 글을 올릴 때 함께 보낸다."""
    data = await file.read(IMAGE_MAX_BYTES + 1)
    if len(data) > IMAGE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="사진은 5MB 이하만 올릴 수 있습니다")
    extension = _image_extension(data)
    if not extension:
        raise HTTPException(status_code=400, detail="JPG, PNG, WebP 사진만 올릴 수 있습니다")

    name = f"{uuid4().hex}.{extension}"
    POST_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    (POST_IMAGE_DIR / name).write_bytes(data)

    return {"success": True, "data": {"image_url": f"{POST_IMAGE_URL_PREFIX}/{name}"}, "message": "사진을 올렸습니다"}


@router.post("", status_code=201)
def create_post(
    body: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.stock_id is not None and not db.get(Stock, body.stock_id):
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    _check_image(db, body.image_url)

    post = Post(user_id=current_user.id, stock_id=body.stock_id, content=body.content, image_url=body.image_url)
    db.add(post)
    db.commit()

    return {"success": True, "data": _load_posts(db, current_user, Post.id == post.id)[0], "message": "글을 올렸습니다"}


@router.put("/{post_id}")
def update_post(
    post_id: int,
    body: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """내 글의 내용·종목·사진을 보낸 값으로 바꾼다. image_url을 비우면 사진을 뺀다."""
    post = _get_post_or_404(db, post_id)
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="내가 쓴 글만 수정할 수 있습니다")
    if body.stock_id is not None and not db.get(Stock, body.stock_id):
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")
    _check_image(db, body.image_url, post_id)

    old_image = post.image_url
    post.content = body.content
    post.stock_id = body.stock_id
    post.image_url = body.image_url
    db.commit()
    if old_image and old_image != body.image_url:
        _image_path(old_image).unlink(missing_ok=True)

    return {"success": True, "data": _load_posts(db, current_user, Post.id == post_id)[0], "message": "글을 수정했습니다"}


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(db, post_id)
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="내가 쓴 글만 삭제할 수 있습니다")

    image_url = post.image_url
    db.delete(post)
    db.commit()
    if image_url:
        _image_path(image_url).unlink(missing_ok=True)
    return {"success": True, "data": None, "message": "글을 삭제했습니다"}


@router.post("/{post_id}/like")
def toggle_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """좋아요를 누르지 않았으면 누르고, 이미 눌렀으면 취소한다."""
    _get_post_or_404(db, post_id)

    deleted = db.query(PostLike).filter(PostLike.post_id == post_id, PostLike.user_id == current_user.id).delete()
    if not deleted:
        # 같은 사용자가 동시에 두 번 눌러도 한 번만 들어가게 한다
        db.execute(
            pg_insert(PostLike).values(post_id=post_id, user_id=current_user.id)
            .on_conflict_do_nothing(index_elements=["post_id", "user_id"])
        )
    db.commit()

    like_count = db.query(func.count(PostLike.id)).filter(PostLike.post_id == post_id).scalar()
    return {"success": True, "data": {"liked": not deleted, "like_count": like_count}, "message": "요청 성공"}


@router.get("/{post_id}/comments")
def list_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_post_or_404(db, post_id)
    rows = db.execute(
        select(PostComment, User.nickname)
        .join(User, User.id == PostComment.user_id)
        .where(PostComment.post_id == post_id)
        .order_by(PostComment.id)
    ).all()

    data = [_comment_dict(comment, nickname, current_user) for comment, nickname in rows]
    return {"success": True, "data": data, "message": "요청 성공"}


@router.post("/{post_id}/comments", status_code=201)
def create_comment(
    post_id: int,
    body: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_post_or_404(db, post_id)
    comment = PostComment(post_id=post_id, user_id=current_user.id, content=body.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return {"success": True, "data": _comment_dict(comment, current_user.nickname, current_user), "message": "댓글을 달았습니다"}


@router.delete("/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(PostComment).filter(PostComment.id == comment_id, PostComment.post_id == post_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="내가 쓴 댓글만 삭제할 수 있습니다")

    db.delete(comment)
    db.commit()
    return {"success": True, "data": None, "message": "댓글을 삭제했습니다"}
