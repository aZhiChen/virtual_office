from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, nullable=False, index=True)
    to_user_id = Column(Integer, nullable=False, index=True)
    message = Column(Text, nullable=False)
    from_username = Column(String(100), nullable=False, default="")
    is_auto_reply = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
