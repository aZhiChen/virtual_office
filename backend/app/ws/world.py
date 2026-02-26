import asyncio
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import or_, and_
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.user import User
from app.models.chat_message import ChatMessage
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


def _occupant_name(uid: int) -> str:
    p = manager.user_profiles.get(uid, {})
    return p.get("display_name") or p.get("username") or f"User {uid}"


def _clear_user_seat(user_id: int) -> None:
    """Release user's previous seat/chair/desk so one person can only occupy one seat."""
    prev_seat = manager.user_seats.pop(user_id, None)
    if prev_seat is not None:
        if prev_seat.get("type") == "desk":
            manager.desk_occupants.pop(prev_seat.get("id"), None)
        elif prev_seat.get("type") == "meeting_chair":
            manager.meeting_chair_occupants.pop(prev_seat.get("id"), None)
        elif prev_seat.get("type") == "dining_chair":
            manager.dining_chair_occupants.pop(prev_seat.get("id"), None)
        elif prev_seat.get("type") == "treadmill":
            manager.treadmill_occupants.pop(prev_seat.get("id"), None)


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
        # Persist to database
        db = SessionLocal()
        try:
            db.add(
                ChatMessage(
                    from_user_id=user_id,
                    to_user_id=to_user_id,
                    message=message_text,
                    from_username=from_profile.get("display_name", "Unknown"),
                    is_auto_reply=False,
                )
            )
            db.commit()
        except Exception as e:
            logger.exception("Failed to save chat message: %s", e)
            db.rollback()
        finally:
            db.close()
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
            _clear_user_seat(user_id)
            occupant = manager.desk_occupants.get(desk_id)
            if occupant is not None and occupant != user_id:
                logger.info("Desk occupied: user_id=%s tried desk_id=%s, occupied by=%s", user_id, desk_id, occupant)
                await manager.send_personal(
                    {
                        "type": "device_occupied",
                        "device_type": "desk",
                        "device_id": desk_id,
                        "occupant_name": _occupant_name(occupant),
                        "device_name": "办公桌",
                    },
                    user_id,
                )
                return
            manager.desk_occupants[desk_id] = user_id
            manager.user_seats[user_id] = {"type": "desk", "id": desk_id}
            logger.info("Desk sit: user_id=%s desk_id=%s", user_id, desk_id)
            await manager.broadcast(
                {"type": "seat_state", "user_id": user_id, "action": "sit", "seat_type": "desk", "seat_id": desk_id}
            )

    elif msg_type == "stand_up":
        _clear_user_seat(user_id)
        logger.info("Stand up: user_id=%s", user_id)
        await manager.broadcast(
            {"type": "seat_state", "user_id": user_id, "action": "stand"}
        )

    elif msg_type == "sit_meeting_chair":
        chair_id = data.get("chair_id")
        if chair_id is not None:
            _clear_user_seat(user_id)
            occupant = manager.meeting_chair_occupants.get(chair_id)
            if occupant is not None and occupant != user_id:
                logger.info("Meeting chair occupied: user_id=%s tried chair_id=%s, occupied by=%s", user_id, chair_id, occupant)
                await manager.send_personal(
                    {
                        "type": "device_occupied",
                        "device_type": "meeting_chair",
                        "device_id": chair_id,
                        "occupant_name": _occupant_name(occupant),
                        "device_name": "会议椅",
                    },
                    user_id,
                )
                return
            manager.meeting_chair_occupants[chair_id] = user_id
            manager.user_seats[user_id] = {"type": "meeting_chair", "id": chair_id}
            logger.info("Meeting chair sit: user_id=%s chair_id=%s", user_id, chair_id)
            await manager.broadcast(
                {"type": "seat_state", "user_id": user_id, "action": "sit", "seat_type": "meeting_chair", "seat_id": chair_id}
            )

    elif msg_type == "sit_dining_chair":
        index = data.get("index")
        if index is not None:
            _clear_user_seat(user_id)
            occupant = manager.dining_chair_occupants.get(index)
            if occupant is not None and occupant != user_id:
                logger.info("Dining chair occupied: user_id=%s tried index=%s, occupied by=%s", user_id, index, occupant)
                await manager.send_personal(
                    {
                        "type": "device_occupied",
                        "device_type": "dining_chair",
                        "device_id": index,
                        "occupant_name": _occupant_name(occupant),
                        "device_name": "餐椅",
                    },
                    user_id,
                )
                return
            manager.dining_chair_occupants[index] = user_id
            manager.user_seats[user_id] = {"type": "dining_chair", "id": index}
            logger.info("Dining chair sit: user_id=%s index=%s", user_id, index)
            await manager.broadcast(
                {"type": "seat_state", "user_id": user_id, "action": "sit", "seat_type": "dining_chair", "seat_id": index}
            )

    elif msg_type == "on_treadmill":
        index = data.get("index")
        if index is not None:
            _clear_user_seat(user_id)
            occupant = manager.treadmill_occupants.get(index)
            if occupant is not None and occupant != user_id:
                await manager.send_personal(
                    {
                        "type": "device_occupied",
                        "device_type": "treadmill",
                        "device_id": index,
                        "occupant_name": _occupant_name(occupant),
                        "device_name": "跑步机",
                    },
                    user_id,
                )
                return
            manager.treadmill_occupants[index] = user_id
            manager.user_seats[user_id] = {"type": "treadmill", "id": index}
            await manager.broadcast(
                {"type": "seat_state", "user_id": user_id, "action": "sit", "seat_type": "treadmill", "seat_id": index}
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


def _get_chat_history_for_llm(afk_user_id: int, from_user_id: int) -> list[dict]:
    """Fetch chat history between two users and format for LLM context.
    Excludes the most recent message (the incoming one) since it's passed separately."""
    from app.core.config import settings

    db = SessionLocal()
    try:
        messages = (
            db.query(ChatMessage)
            .filter(
                or_(
                    and_(
                        ChatMessage.from_user_id == afk_user_id,
                        ChatMessage.to_user_id == from_user_id,
                    ),
                    and_(
                        ChatMessage.from_user_id == from_user_id,
                        ChatMessage.to_user_id == afk_user_id,
                    ),
                )
            )
            .order_by(ChatMessage.created_at.asc())
            .limit(settings.LLM_MAX_CONTEXT_MESSAGES * 2 + 1)
            .all()
        )
        messages = messages[:-1]
        return [
            {"role": "user" if m.from_user_id == from_user_id else "assistant", "content": m.message}
            for m in messages
        ]
    finally:
        db.close()


async def _send_afk_reply(
    afk_user_id: int, from_user_id: int, message: str, profile: dict
):
    """Generate and send an LLM auto-reply on behalf of the AFK user."""
    chat_history = _get_chat_history_for_llm(afk_user_id, from_user_id)
    reply = await generate_afk_reply(profile["personality"], chat_history, message)
    chat_msg = {
        "type": "chat_message",
        "from_user_id": afk_user_id,
        "to_user_id": from_user_id,
        "message": reply,
        "from_username": profile.get("display_name", "Unknown"),
        "is_auto_reply": True,
    }
    # Persist auto-reply to database
    db = SessionLocal()
    try:
        db.add(
            ChatMessage(
                from_user_id=afk_user_id,
                to_user_id=from_user_id,
                message=reply,
                from_username=profile.get("display_name", "Unknown"),
                is_auto_reply=True,
            )
        )
        db.commit()
    except Exception as e:
        logger.exception("Failed to save AFK reply: %s", e)
        db.rollback()
    finally:
        db.close()
    logger.info(
        "Sending auto-reply: from=%s to=%s message=%s",
        afk_user_id,
        from_user_id,
        reply[:50],
    )
    await manager.send_personal(chat_msg, from_user_id)
    await manager.send_personal(chat_msg, afk_user_id)
    logger.info("Auto-reply sent to both parties")
