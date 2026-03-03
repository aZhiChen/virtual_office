from sqlalchemy import Column, DateTime, Integer, Text
from sqlalchemy.sql import func

from app.core.database import Base


class PlantEasterEgg(Base):
    """Easter egg hidden in a potted plant. One per plant, cleared when discovered."""

    __tablename__ = "plant_easter_eggs"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, nullable=False, index=True, unique=True)  # 0-5 per office map
    content = Column(Text, nullable=False)  # Text + emoji format [emoji:1.png]
    hider_user_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
