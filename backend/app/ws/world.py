import asyncio
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.user import User
from app.ws.manager import manager
from app.services.llm_client import generate_afk_reply
from app.core.logger import logger

router = APIRouter()

# Rate limiting for LLM auto-replies
_last_llm_call: dict = {}  # user_id -> timestamp
LLM_COOLDOWN_SECONDS = 5


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Authenticate via query param
    token = websocket.query_params.get("token", "")
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=4004, reason="User not found")
            return

        profile = {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "avatar_config": user.avatar_config or {},
            "has_pet": user.has_pet,
            "pet_type": user.pet_type or "",
            "personality": user.personality or "",
            "is_afk": user.is_afk,
        }
    finally:
        db.close()

    await manager.connect(user_id, websocket, profile)
    logger.info("WS connected: user_id=%s", user_id)

    try:
        while True:
            data = await websocket.receive_json()
            await _handle_message(user_id, data)
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        logger.info("WS disconnected: user_id=%s", user_id)
        await manager.broadcast({"type": "user_left", "user_id": user_id})


async def _handle_message(user_id: int, data: dict):
    msg_type = data.get("type")

    if msg_type == "move":
        target = data.get("target", "character")
        pos = {"x": data.get("x", 0), "y": data.get("y", 0)}

        if target == "pet":
            manager.pet_positions[user_id] = pos
        else:
            manager.user_positions[user_id] = pos

        await manager.broadcast(
            {
                "type": "entity_moved",
                "user_id": user_id,
                "target": target,
                "position": pos,
            },
            exclude=user_id,
        )

    elif msg_type == "chat_send":
        to_user_id = data.get("to_user_id")
        message_text = data.get("message", "")
        from_profile = manager.user_profiles.get(user_id, {})

        chat_msg = {
            "type": "chat_message",
            "from_user_id": user_id,
            "to_user_id": to_user_id,
            "message": message_text,
            "from_username": from_profile.get("display_name", "Unknown"),
        }
        # Send to both parties
        await manager.send_personal(chat_msg, to_user_id)
        await manager.send_personal(chat_msg, user_id)
        logger.info("Chat message: from=%s to=%s", user_id, to_user_id)

        # If target is AFK with personality set, trigger auto-reply
        target_profile = manager.user_profiles.get(to_user_id, {})
        if target_profile.get("is_afk") and target_profile.get("personality"):
            now = time.time()
            last = _last_llm_call.get(to_user_id, 0)
            if now - last >= LLM_COOLDOWN_SECONDS:
                _last_llm_call[to_user_id] = now
                asyncio.create_task(
                    _send_afk_reply(to_user_id, user_id, message_text, target_profile)
                )

    elif msg_type == "sit_at_desk":
        desk_id = data.get("desk_id")
        if desk_id is not None:
            # Check if desk is occupied by someone else
            occupant = manager.desk_occupants.get(desk_id)
            if occupant is not None and occupant != user_id:
                await manager.send_personal(
                    {"type": "desk_occupied", "desk_id": desk_id}, user_id
                )
                return
            # Free any previous desk
            for did, uid in list(manager.desk_occupants.items()):
                if uid == user_id:
                    del manager.desk_occupants[did]
            manager.desk_occupants[desk_id] = user_id
            logger.info("Desk sit: user_id=%s desk_id=%s", user_id, desk_id)
            await manager.broadcast(
                {"type": "desk_state", "desk_id": desk_id, "user_id": user_id, "action": "sit"}
            )

    elif msg_type == "stand_up":
        for did, uid in list(manager.desk_occupants.items()):
            if uid == user_id:
                del manager.desk_occupants[did]
                logger.info("Desk stand: user_id=%s desk_id=%s", user_id, did)
                await manager.broadcast(
                    {"type": "desk_state", "desk_id": did, "user_id": user_id, "action": "stand"}
                )

    elif msg_type == "set_afk":
        is_afk = data.get("is_afk", False)
        if user_id in manager.user_profiles:
            manager.user_profiles[user_id]["is_afk"] = is_afk
        # Persist to DB
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.is_afk = is_afk
                db.commit()
        finally:
            db.close()
        await manager.broadcast(
            {"type": "afk_changed", "user_id": user_id, "is_afk": is_afk}
        )
        logger.info("AFK changed (ws): user_id=%s is_afk=%s", user_id, is_afk)

    elif msg_type == "control_target":
        target = data.get("target", "character")
        manager.control_targets[user_id] = target
        logger.info("Control target changed: user_id=%s target=%s", user_id, target)


async def _send_afk_reply(
    afk_user_id: int, from_user_id: int, message: str, profile: dict
):
    """Generate and send an LLM auto-reply on behalf of the AFK user."""
    reply = await generate_afk_reply(profile["personality"], [], message)
    chat_msg = {
        "type": "chat_message",
        "from_user_id": afk_user_id,
        "to_user_id": from_user_id,
        "message": reply,
        "from_username": profile.get("display_name", "Unknown"),
        "is_auto_reply": True,
    }
    await manager.send_personal(chat_msg, from_user_id)
    await manager.send_personal(chat_msg, afk_user_id)
