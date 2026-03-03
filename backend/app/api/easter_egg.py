"""Plant easter egg API: hide and discover easter eggs in potted plants."""

import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token, get_password_hash
from app.models.plant_easter_egg import PlantEasterEgg
from app.models.user import User
from app.models.system_message import SystemMessage
from app.api.announcement import _broadcast_announcement_updated
from app.ws.manager import manager

router = APIRouter(prefix="/api/easter-egg", tags=["easter_egg"])
security = HTTPBearer()

PLANT_COUNT = 6  # Must match frontend PLANT_DEFS length

SYSTEM_USERNAME = "__system__"


def _get_or_create_system_user(db: Session) -> User:
    """Get or create the system user for system announcements."""
    user = db.query(User).filter(User.username == SYSTEM_USERNAME).first()
    if user:
        return user
    user = User(
        username=SYSTEM_USERNAME,
        hashed_password=get_password_hash("__system__"),
        display_name="系统",
    )
    db.add(user)
    db.flush()
    return user


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


class HideRequest(BaseModel):
    plant_id: int
    content: str


class EasterEggOut(BaseModel):
    plant_id: int
    content: str
    hider_user_id: int
    hider_display_name: str


class AllEasterEggsOut(BaseModel):
    eggs: dict[int, EasterEggOut]  # plant_id -> egg (only plants with eggs)


@router.get("/plants", response_model=AllEasterEggsOut)
async def get_all_plant_eggs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all plants' easter egg state. Returns only plants that have eggs."""
    rows = db.query(PlantEasterEgg, User).join(
        User, User.id == PlantEasterEgg.hider_user_id
    ).all()
    eggs: dict[int, EasterEggOut] = {}
    for egg, u in rows:
        eggs[egg.plant_id] = EasterEggOut(
            plant_id=egg.plant_id,
            content=egg.content,
            hider_user_id=egg.hider_user_id,
            hider_display_name=u.display_name or u.username or f"User{egg.hider_user_id}",
        )
    return AllEasterEggsOut(eggs=eggs)


@router.post("/hide")
async def hide_egg(
    req: HideRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Hide an easter egg in a plant. Fails if plant already has one."""
    if req.plant_id < 0 or req.plant_id >= PLANT_COUNT:
        raise HTTPException(status_code=400, detail="Invalid plant_id")
    content = (req.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content is required")
    if len(content) > 200:
        raise HTTPException(status_code=400, detail="Content too long (max 200 chars)")

    existing = db.query(PlantEasterEgg).filter(
        PlantEasterEgg.plant_id == req.plant_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This plant already has an easter egg")

    egg = PlantEasterEgg(
        plant_id=req.plant_id,
        content=content,
        hider_user_id=user.id,
    )
    db.add(egg)
    db.commit()
    db.refresh(egg)

    hider_name = user.display_name or user.username or f"User{user.id}"

    # Broadcast so other clients can update their local state
    await manager.broadcast({
        "type": "easter_egg_hidden",
        "plant_id": req.plant_id,
        "hider_user_id": user.id,
        "hider_display_name": hider_name,
        "content": egg.content,
    })

    return {"status": "ok", "plant_id": req.plant_id}


@router.post("/discover/{plant_id}")
async def discover_egg(
    plant_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Discover an easter egg in a plant. Creates announcement and clears the egg."""
    if plant_id < 0 or plant_id >= PLANT_COUNT:
        raise HTTPException(status_code=400, detail="Invalid plant_id")

    egg = db.query(PlantEasterEgg).filter(
        PlantEasterEgg.plant_id == plant_id
    ).first()
    if not egg:
        raise HTTPException(status_code=404, detail="No easter egg in this plant")
    if egg.hider_user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot discover your own easter egg")

    discoverer_name = user.display_name or user.username or f"User{user.id}"
    egg_content = egg.content

    # Create system announcement: "<人名1>发现了彩蛋"xxxx(彩蛋内容)"" (owner = 系统)
    announcement_content = f'{discoverer_name}发现了彩蛋"{egg_content}"'
    system_user = _get_or_create_system_user(db)
    msg = SystemMessage(
        user_id=system_user.id,
        message_type="easter_egg",
        streak_days=int(time.time() * 1000),  # unique per message
        content=announcement_content,
    )
    db.add(msg)
    db.delete(egg)
    db.commit()
    db.refresh(msg)

    await _broadcast_announcement_updated("post_created", system_user.id, "system", msg.id)

    # Broadcast discovery so all clients show popup and clear local egg (hider name not sent)
    await manager.broadcast({
        "type": "easter_egg_discovered",
        "plant_id": plant_id,
        "discoverer_user_id": user.id,
        "discoverer_name": discoverer_name,
        "content": egg_content,
        "announcement_text": announcement_content,
    })

    return {
        "status": "ok",
        "content": egg_content,
        "announcement_text": announcement_content,
    }
