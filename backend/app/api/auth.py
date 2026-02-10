from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.logger import logger
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str = ""


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        logger.info("Register failed: username taken (%s)", req.username)
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(
        username=req.username,
        hashed_password=get_password_hash(req.password),
        display_name=req.display_name or req.username,
        avatar_config={
            "skin_color": 0,
            "hair_style": 0,
            "hair_color": 0,
            "top_color": 0,
            "bottom_color": 2,
            "shoes_color": 9,
        },
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("User registered: id=%s username=%s", user.id, user.username)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token, user_id=user.id, username=user.username
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        logger.info("Login failed: username=%s", req.username)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    logger.info("Login success: id=%s username=%s", user.id, user.username)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token, user_id=user.id, username=user.username
    )
