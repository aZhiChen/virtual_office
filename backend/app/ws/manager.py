from fastapi import WebSocket
from typing import Dict

from app.ws.office_animals import office_animals_state


class ConnectionManager:
    """Manages WebSocket connections and world state."""

    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}  # user_id -> ws
        self.user_positions: Dict[int, dict] = {}  # user_id -> {x, y}
        self.pet_positions: Dict[int, dict] = {}  # user_id -> {x, y}
        self.desk_occupants: Dict[int, int] = {}  # desk_id -> user_id
        self.user_seats: Dict[int, dict] = {}  # user_id -> {"type": "meeting_chair"|"dining_chair"|"treadmill", "id": int} or absent
        self.meeting_chair_occupants: Dict[int, int] = {}  # chair_id -> user_id
        self.dining_chair_occupants: Dict[int, int] = {}  # index -> user_id
        self.treadmill_occupants: Dict[int, int] = {}  # index -> user_id
        self.user_profiles: Dict[int, dict] = {}  # user_id -> profile dict
        self.control_targets: Dict[int, str] = {}  # user_id -> "character"|"pet"

    async def connect(self, user_id: int, websocket: WebSocket, profile: dict):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_profiles[user_id] = profile
        self.user_positions[user_id] = {"x": 400, "y": 300}
        self.control_targets[user_id] = "character"

        if profile.get("has_pet"):
            # Pet starts in pet area (tile 25, 25 -> pixel 800, 800)
            self.pet_positions[user_id] = {"x": 800, "y": 800}

        # Notify others about new user
        await self.broadcast(
            {
                "type": "user_joined",
                "user_id": user_id,
                "profile": profile,
                "position": self.user_positions[user_id],
                "pet_position": self.pet_positions.get(user_id),
            },
            exclude=user_id,
        )

        # Send current world state to the new user
        users_snapshot = {}
        for uid in self.active_connections:
            if uid != user_id:
                users_snapshot[str(uid)] = {
                    "profile": self.user_profiles.get(uid, {}),
                    "position": self.user_positions.get(uid, {"x": 400, "y": 300}),
                    "pet_position": self.pet_positions.get(uid),
                    "seat": self.user_seats.get(uid),
                }

        await self.send_personal(
            {
                "type": "presence_snapshot",
                "users": users_snapshot,
                "animals": office_animals_state.snapshot(),
            },
            user_id,
        )

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)
        self.user_positions.pop(user_id, None)
        self.pet_positions.pop(user_id, None)
        self.user_profiles.pop(user_id, None)
        self.control_targets.pop(user_id, None)
        # Free any occupied desk
        for desk_id, uid in list(self.desk_occupants.items()):
            if uid == user_id:
                del self.desk_occupants[desk_id]
        self.user_seats.pop(user_id, None)
        for chair_id, uid in list(self.meeting_chair_occupants.items()):
            if uid == user_id:
                del self.meeting_chair_occupants[chair_id]
        for idx, uid in list(self.dining_chair_occupants.items()):
            if uid == user_id:
                del self.dining_chair_occupants[idx]
        for idx, uid in list(self.treadmill_occupants.items()):
            if uid == user_id:
                del self.treadmill_occupants[idx]

    async def broadcast(self, message: dict, exclude: int = None):
        for user_id, ws in list(self.active_connections.items()):
            if user_id != exclude:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

    async def send_personal(self, message: dict, user_id: int):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    def is_online(self, user_id: int) -> bool:
        return user_id in self.active_connections


manager = ConnectionManager()
