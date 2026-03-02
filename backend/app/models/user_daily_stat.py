from sqlalchemy import Boolean, Column, Date, DateTime, Integer, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class UserDailyStat(Base):
    __tablename__ = "user_daily_stats"
    __table_args__ = (
        UniqueConstraint("user_id", "stat_date", name="uq_user_daily_stats_user_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    stat_date = Column(Date, nullable=False, index=True)
    used_note = Column(Boolean, nullable=False, default=False)
    all_completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
