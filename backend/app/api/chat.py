from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.chat_message import ChatMessage
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.core.logger import logger

router = APIRouter(prefix="/api/chat", tags=["chat"])
security = HTTPBearer()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    try:
        payload = decode_access_token(credentials.credentials)
        return int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


class ChatMessageResponse(BaseModel):
    from_user_id: int
    to_user_id: int
    message: str
    from_username: str
    is_auto_reply: bool = False

    model_config = {"from_attributes": True}


@router.get("/history", response_model=list[ChatMessageResponse])
def get_chat_history(
    with_user_id: int = Query(..., description="The other user's ID"),
    limit: int = Query(100, ge=1, le=500),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get chat history between current user and the specified user."""
    # Only allow fetching conversations where current user is a participant
    messages = (
        db.query(ChatMessage)
        .filter(
            or_(
                and_(
                    ChatMessage.from_user_id == user_id,
                    ChatMessage.to_user_id == with_user_id,
                ),
                and_(
                    ChatMessage.from_user_id == with_user_id,
                    ChatMessage.to_user_id == user_id,
                ),
            )
        )
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )
    return [
        ChatMessageResponse(
            from_user_id=m.from_user_id,
            to_user_id=m.to_user_id,
            message=m.message,
            from_username=m.from_username,
            is_auto_reply=m.is_auto_reply or False,
        )
        for m in messages
    ]
