from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.community import Post, PostComment, PostLike
from app.models.stock import Stock
from app.models.user import User
from app.schemas.community import CommentCreate, PostCreate

router = APIRouter(prefix="/posts", tags=["community"])


def _load_posts(db: Session, me: User, *where, limit: int | None = None) -> list[dict]:
    """글과 작성자·종목·좋아요 수·댓글 수·내가 좋아요 했는지를 한 번에 조회 (최신순)."""
    like_count = select(func.count()).where(PostLike.post_id == Post.id).correlate(Post).scalar_subquery()
    comment_count = select(func.count()).where(PostComment.post_id == Post.id).correlate(Post).scalar_subquery()
    liked_by_me = exists().where(PostLike.post_id == Post.id, PostLike.user_id == me.id).correlate(Post)

    query = (
        select(Post, User.nickname, Stock, like_count, comment_count, liked_by_me)
        .join(User, User.id == Post.user_id)
        .outerjoin(Stock, Stock.id == Post.stock_id)
        .where(*where)
        .order_by(Post.id.desc())
    )
    if limit is not None:
        query = query.limit(limit)

    return [
        {
            "id": post.id,
            "author": nickname,
            "is_mine": post.user_id == me.id,
            "content": post.content,
            "stock": {"id": stock.id, "code": stock.code, "name": stock.name} if stock else None,
            "like_count": likes,
            "comment_count": comments,
            "liked": liked,
            "created_at": post.created_at,
        }
        for post, nickname, stock, likes, comments, liked in db.execute(query).all()
    ]


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
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """피드 (최신순). stock_id를 주면 그 종목 글만. before_id보다 오래된 글을 이어서 받는다."""
    where = []
    if stock_id is not None:
        where.append(Post.stock_id == stock_id)
    if before_id is not None:
        where.append(Post.id < before_id)

    return {"success": True, "data": _load_posts(db, current_user, *where, limit=limit), "message": "요청 성공"}


@router.post("", status_code=201)
def create_post(
    body: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.stock_id is not None and not db.get(Stock, body.stock_id):
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")

    post = Post(user_id=current_user.id, stock_id=body.stock_id, content=body.content)
    db.add(post)
    db.commit()

    return {"success": True, "data": _load_posts(db, current_user, Post.id == post.id)[0], "message": "글을 올렸습니다"}


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(db, post_id)
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="내가 쓴 글만 삭제할 수 있습니다")

    db.delete(post)
    db.commit()
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
