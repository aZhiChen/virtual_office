from sqlalchemy import Column, Integer, String, Text, Boolean, JSON
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    display_name = Column(String(100), default="")

    # Avatar customization - JSON dict of part selections
    # e.g. {"skin_color":0,"hair_style":0,"hair_color":0,"top_color":0,"bottom_color":2,"shoes_color":9}
    avatar_config = Column(JSON, default=dict)

    # Pet
    has_pet = Column(Boolean, default=False)
    pet_type = Column(
        String(20), default=""
    )  # snake|cat|dog|crab|rabbit|gecko|lizard|turtle|bird

    # Personality prompt for LLM auto-reply
    personality = Column(Text, default="")

    # AFK mode
    is_afk = Column(Boolean, default=False)

    # Character status (displayed above head, max 15 chars including emoji)
    status = Column(String(100), default="")
