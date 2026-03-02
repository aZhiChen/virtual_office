from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.announcement_comment import AnnouncementComment
from app.models.announcement_like import AnnouncementLike
from app.models.personal_post import PersonalPost
from app.models.system_message import SystemMessage
from app.models.user import User
from app.services.announcement_service import generate_system_messages
from app.ws.manager import manager

router = APIRouter(prefix="/api/announcement", tags=["announcement"])
security = HTTPBearer()

TargetType = Literal["system", "personal"]


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _validate_target_exists(db: Session, target_type: TargetType, target_id: int) -> None:
    if target_type == "system":
        obj = db.query(SystemMessage).filter(SystemMessage.id == target_id).first()
    else:
        obj = db.query(PersonalPost).filter(PersonalPost.id == target_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Announcement target not found")


class AnnouncementBaseOut(BaseModel):
    id: int
    target_type: TargetType
    created_at: datetime | None = None
    likes_count: int
    comments_count: int
    liked_by_me: bool


class SystemMessageOut(AnnouncementBaseOut):
    user_id: int
    display_name: str
    message_type: str
    streak_days: int
    content: str


class PersonalPostOut(AnnouncementBaseOut):
    user_id: int
    display_name: str
    avatar_config: dict
    content: str | None = None
    image_url: str | None = None
    is_mine: bool


class FeedResponse(BaseModel):
    system_messages: list[SystemMessageOut]
    personal_posts: list[PersonalPostOut]


class CreatePostRequest(BaseModel):
    content: str | None = None
    image_url: str | None = None


class LikeRequest(BaseModel):
    target_type: TargetType
    target_id: int


class CommentCreateRequest(BaseModel):
    target_type: TargetType
    target_id: int
    content: str


class CommentOut(BaseModel):
    id: int
    target_type: TargetType
    target_id: int
    user_id: int
    display_name: str
    avatar_config: dict
    content: str
    created_at: datetime | None = None
    is_mine: bool


class CommentListResponse(BaseModel):
    comments: list[CommentOut]


class FeedSummaryResponse(BaseModel):
    latest_system_created_at: datetime | None = None
    latest_personal_created_at: datetime | None = None


async def _broadcast_announcement_updated(
    action: str, actor_user_id: int, target_type: TargetType | None = None, target_id: int | None = None
) -> None:
    await manager.broadcast(
        {
            "type": "announcement_updated",
            "action": action,
            "actor_user_id": actor_user_id,
            "target_type": target_type,
            "target_id": target_id,
            "at": datetime.now(timezone.utc).isoformat(),
        }
    )


def _build_counts(
    db: Session, target_type: TargetType, ids: list[int]
) -> tuple[dict[int, int], dict[int, int]]:
    if not ids:
        return {}, {}
    like_rows = (
        db.query(AnnouncementLike.target_id, func.count(AnnouncementLike.id))
        .filter(
            AnnouncementLike.target_type == target_type,
            AnnouncementLike.target_id.in_(ids),
        )
        .group_by(AnnouncementLike.target_id)
        .all()
    )
    comment_rows = (
        db.query(AnnouncementComment.target_id, func.count(AnnouncementComment.id))
        .filter(
            AnnouncementComment.target_type == target_type,
            AnnouncementComment.target_id.in_(ids),
        )
        .group_by(AnnouncementComment.target_id)
        .all()
    )
    like_map = {tid: count for tid, count in like_rows}
    comment_map = {tid: count for tid, count in comment_rows}
    return like_map, comment_map


def _build_liked_set(
    db: Session, target_type: TargetType, ids: list[int], user_id: int
) -> set[int]:
    if not ids:
        return set()
    rows = (
        db.query(AnnouncementLike.target_id)
        .filter(
            AnnouncementLike.target_type == target_type,
            AnnouncementLike.target_id.in_(ids),
            AnnouncementLike.user_id == user_id,
        )
        .all()
    )
    return {target_id for (target_id,) in rows}


@router.get("/feed", response_model=FeedResponse)
def get_feed(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(limit, 100))
    system_rows = (
        db.query(SystemMessage, User)
        .join(User, User.id == SystemMessage.user_id)
        .order_by(SystemMessage.created_at.desc(), SystemMessage.id.desc())
        .limit(safe_limit)
        .all()
    )
    personal_rows = (
        db.query(PersonalPost, User)
        .join(User, User.id == PersonalPost.user_id)
        .order_by(PersonalPost.created_at.desc(), PersonalPost.id.desc())
        .limit(safe_limit)
        .all()
    )

    system_ids = [item.id for item, _ in system_rows]
    personal_ids = [item.id for item, _ in personal_rows]
    system_like_map, system_comment_map = _build_counts(db, "system", system_ids)
    post_like_map, post_comment_map = _build_counts(db, "personal", personal_ids)
    liked_system = _build_liked_set(db, "system", system_ids, user.id)
    liked_personal = _build_liked_set(db, "personal", personal_ids, user.id)

    return FeedResponse(
        system_messages=[
            SystemMessageOut(
                id=msg.id,
                target_type="system",
                user_id=owner.id,
                display_name=owner.display_name or owner.username,
                message_type=msg.message_type,
                streak_days=msg.streak_days,
                content=msg.content,
                created_at=msg.created_at,
                likes_count=system_like_map.get(msg.id, 0),
                comments_count=system_comment_map.get(msg.id, 0),
                liked_by_me=msg.id in liked_system,
            )
            for msg, owner in system_rows
        ],
        personal_posts=[
            PersonalPostOut(
                id=post.id,
                target_type="personal",
                user_id=owner.id,
                display_name=owner.display_name or owner.username,
                avatar_config=owner.avatar_config or {},
                content=post.content,
                image_url=post.image_url,
                created_at=post.created_at,
                likes_count=post_like_map.get(post.id, 0),
                comments_count=post_comment_map.get(post.id, 0),
                liked_by_me=post.id in liked_personal,
                is_mine=post.user_id == user.id,
            )
            for post, owner in personal_rows
        ],
    )


@router.get("/feed/summary", response_model=FeedSummaryResponse)
def get_feed_summary(db: Session = Depends(get_db)):
    latest_system = db.query(func.max(SystemMessage.created_at)).scalar()
    latest_personal = db.query(func.max(PersonalPost.created_at)).scalar()
    return FeedSummaryResponse(
        latest_system_created_at=latest_system,
        latest_personal_created_at=latest_personal,
    )


@router.post("/post", response_model=PersonalPostOut)
async def create_personal_post(
    req: CreatePostRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = (req.content or "").strip()
    image_url = (req.image_url or "").strip() or None
    if not content and not image_url:
        raise HTTPException(status_code=400, detail="Text or image is required")
    if len(content) > 500:
        raise HTTPException(status_code=400, detail="Content too long (max 500 chars)")
    if image_url and not (
        image_url.startswith("data:image/jpeg;base64,")
        or image_url.startswith("data:image/png;base64,")
        or image_url.startswith("data:image/gif;base64,")
    ):
        raise HTTPException(status_code=400, detail="Only jpg/png/gif image data is supported")
    if image_url and len(image_url) > 3_000_000:
        raise HTTPException(status_code=400, detail="Image payload is too large")

    post = PersonalPost(
        user_id=user.id,
        content=content or None,
        image_url=image_url,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    await _broadcast_announcement_updated("post_created", user.id, "personal", post.id)
    return PersonalPostOut(
        id=post.id,
        target_type="personal",
        user_id=user.id,
        display_name=user.display_name or user.username,
        avatar_config=user.avatar_config or {},
        content=post.content,
        image_url=post.image_url,
        created_at=post.created_at,
        likes_count=0,
        comments_count=0,
        liked_by_me=False,
        is_mine=True,
    )


@router.delete("/post/{post_id}")
async def delete_personal_post(
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(PersonalPost).filter(PersonalPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    db.query(AnnouncementLike).filter(
        AnnouncementLike.target_type == "personal", AnnouncementLike.target_id == post.id
    ).delete()
    db.query(AnnouncementComment).filter(
        AnnouncementComment.target_type == "personal",
        AnnouncementComment.target_id == post.id,
    ).delete()
    deleted_target_id = post.id
    db.delete(post)
    db.commit()
    await _broadcast_announcement_updated("post_deleted", user.id, "personal", deleted_target_id)
    return {"status": "ok"}


@router.post("/like")
async def like_announcement(
    req: LikeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_target_exists(db, req.target_type, req.target_id)
    existing = (
        db.query(AnnouncementLike)
        .filter(
            AnnouncementLike.user_id == user.id,
            AnnouncementLike.target_type == req.target_type,
            AnnouncementLike.target_id == req.target_id,
        )
        .first()
    )
    if existing:
        return {"status": "ok", "liked": True}

    db.add(
        AnnouncementLike(
            user_id=user.id,
            target_type=req.target_type,
            target_id=req.target_id,
        )
    )
    db.commit()
    await _broadcast_announcement_updated("liked", user.id, req.target_type, req.target_id)
    return {"status": "ok", "liked": True}


@router.post("/unlike")
async def unlike_announcement(
    req: LikeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(AnnouncementLike).filter(
        AnnouncementLike.user_id == user.id,
        AnnouncementLike.target_type == req.target_type,
        AnnouncementLike.target_id == req.target_id,
    ).delete()
    db.commit()
    await _broadcast_announcement_updated("unliked", user.id, req.target_type, req.target_id)
    return {"status": "ok", "liked": False}


@router.get("/comments", response_model=CommentListResponse)
def list_comments(
    target_type: TargetType,
    target_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_target_exists(db, target_type, target_id)
    rows = (
        db.query(AnnouncementComment, User)
        .join(User, User.id == AnnouncementComment.user_id)
        .filter(
            AnnouncementComment.target_type == target_type,
            AnnouncementComment.target_id == target_id,
        )
        .order_by(AnnouncementComment.created_at.asc(), AnnouncementComment.id.asc())
        .all()
    )
    return CommentListResponse(
        comments=[
            CommentOut(
                id=comment.id,
                target_type=comment.target_type,
                target_id=comment.target_id,
                user_id=owner.id,
                display_name=owner.display_name or owner.username,
                avatar_config=owner.avatar_config or {},
                content=comment.content,
                created_at=comment.created_at,
                is_mine=comment.user_id == user.id,
            )
            for comment, owner in rows
        ]
    )


@router.post("/comment", response_model=CommentOut)
async def create_comment(
    req: CommentCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    if len(content) > 300:
        raise HTTPException(status_code=400, detail="Comment too long (max 300 chars)")
    _validate_target_exists(db, req.target_type, req.target_id)

    comment = AnnouncementComment(
        user_id=user.id,
        target_type=req.target_type,
        target_id=req.target_id,
        content=content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    await _broadcast_announcement_updated("comment_created", user.id, req.target_type, req.target_id)
    return CommentOut(
        id=comment.id,
        target_type=comment.target_type,
        target_id=comment.target_id,
        user_id=user.id,
        display_name=user.display_name or user.username,
        avatar_config=user.avatar_config or {},
        content=comment.content,
        created_at=comment.created_at,
        is_mine=True,
    )


@router.post("/system/generate")
async def manual_generate_system_messages(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Keep this endpoint for manual ops/testing; no role system in current project.
    _ = user
    created = generate_system_messages(db)
    if created > 0:
        await _broadcast_announcement_updated("system_generated", user.id, "system", None)
    return {
        "status": "ok",
        "created": created,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
