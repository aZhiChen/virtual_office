from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class SystemMessage(Base):
    __tablename__ = "system_messages"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "message_type",
            "streak_days",
            name="uq_system_messages_user_type_days",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    message_type = Column(String(32), nullable=False, index=True)
    streak_days = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
