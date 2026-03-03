from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.logger import logger

router = APIRouter(prefix="/api/profile", tags=["profile"])
security = HTTPBearer()


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


# ---------- Response / Request schemas ----------


class ProfileResponse(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_config: dict
    has_pet: bool
    pet_type: str
    personality: str
    is_afk: bool
    status: str = ""

    model_config = {"from_attributes": True}


class AvatarUpdateRequest(BaseModel):
    avatar_config: dict


class PetUpdateRequest(BaseModel):
    has_pet: bool
    pet_type: str = ""


class PersonalityUpdateRequest(BaseModel):
    personality: str


class AfkUpdateRequest(BaseModel):
    is_afk: bool


class StatusUpdateRequest(BaseModel):
    status: str = ""


class TestPersonalityRequest(BaseModel):
    personality: str
    test_message: str


# ---------- Endpoints ----------


@router.get("/me", response_model=ProfileResponse)
def get_profile(user: User = Depends(get_current_user)):
    logger.info("Profile read: id=%s username=%s", user.id, user.username)
    return user


@router.put("/avatar")
def update_avatar(
    req: AvatarUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.avatar_config = req.avatar_config
    db.commit()
    logger.info("Avatar updated: id=%s", user.id)
    return {"status": "ok"}


@router.put("/pet")
def update_pet(
    req: PetUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    valid_pets = {
        "snake", "crab", "rabbit", "lizard", "turtle", "bird",
        "cat1", "cat2", "cat3", "cat4", "dog1", "dog2",  # image-based from /img/animals
    }
    if req.has_pet and req.pet_type not in valid_pets:
        raise HTTPException(status_code=400, detail=f"Invalid pet type. Choose from: {valid_pets}")
    user.has_pet = req.has_pet
    user.pet_type = req.pet_type if req.has_pet else ""
    db.commit()
    logger.info("Pet updated: id=%s has_pet=%s pet_type=%s", user.id, user.has_pet, user.pet_type)
    return {"status": "ok"}


@router.put("/personality")
def update_personality(
    req: PersonalityUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(req.personality) > 500:
        raise HTTPException(status_code=400, detail="Personality text too long (max 500 chars)")
    user.personality = req.personality
    db.commit()
    logger.info("Personality updated: id=%s length=%s", user.id, len(req.personality))
    return {"status": "ok"}


@router.put("/afk")
def update_afk(
    req: AfkUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.is_afk = req.is_afk
    db.commit()
    logger.info("AFK updated: id=%s is_afk=%s", user.id, user.is_afk)
    return {"status": "ok"}


def _status_display_length(status: str) -> int:
    """Count display length: each char = 1, each [emoji:xxx] = 1."""
    import re
    s = status
    total = 0
    for m in re.finditer(r"\[emoji:([^\]]+)\]", s):
        total += 1
    s = re.sub(r"\[emoji:[^\]]+\]", "", s)
    return total + len(s)


@router.put("/status")
def update_status(
    req: StatusUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _status_display_length(req.status) > 15:
        raise HTTPException(status_code=400, detail="Status length must not exceed 15 characters")
    user.status = (req.status or "")[:200]  # raw string max 200
    db.commit()
    logger.info("Status updated: id=%s", user.id)
    return {"status": "ok"}


@router.post("/test-personality")
async def test_personality(
    req: TestPersonalityRequest,
    user: User = Depends(get_current_user),
):
    from app.services.llm_client import generate_afk_reply

    reply = await generate_afk_reply(req.personality, [], req.test_message)
    logger.info("Personality tested: id=%s", user.id)
    return {"reply": reply}
