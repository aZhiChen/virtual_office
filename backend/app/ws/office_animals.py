"""
Server-authoritative state for office animals (cows and horses).
Matches frontend: 4 cows (index 0-3) + 4 horses (index 4-7), same spawn positions and wander logic.
"""
import asyncio
import math
import random
import time
from typing import List, Dict, Any

# Match frontend constants (OfficeScene + tileRegistry + officeMap)
TILE_SIZE = 32
MAP_COLS = 40
MAP_ROWS = 30
WANDER_SPEED = 48
WANDER_MIN_MS = 1500
WANDER_MAX_MS = 4000
WORLD_WIDTH = MAP_COLS * TILE_SIZE
WORLD_HEIGHT = MAP_ROWS * TILE_SIZE


def _initial_positions() -> List[Dict[str, float]]:
    office_center_x = 20 * TILE_SIZE
    office_y = 6 * TILE_SIZE
    animals: List[Dict[str, float]] = []
    # 4 cows
    for i in range(4):
        sx = office_center_x + (i - 2) * TILE_SIZE * 1.5
        sy = office_y + (i % 2) * TILE_SIZE
        animals.append({"x": sx, "y": sy, "vx": 0.0, "vy": 0.0, "wander_until": 0.0})
    # 4 horses
    for i in range(4):
        sx = office_center_x + (i - 1.5) * TILE_SIZE * 1.8
        sy = office_y + TILE_SIZE * 2 + (i % 2) * TILE_SIZE
        animals.append({"x": sx, "y": sy, "vx": 0.0, "vy": 0.0, "wander_until": 0.0})
    return animals


class OfficeAnimalsState:
    def __init__(self) -> None:
        self.animals: List[Dict[str, float]] = _initial_positions()

    def snapshot(self) -> List[Dict[str, Any]]:
        """Return list of {index, x, y, vx, vy} for broadcast."""
        return [
            {
                "index": i,
                "x": round(a["x"], 1),
                "y": round(a["y"], 1),
                "vx": round(a["vx"], 1),
                "vy": round(a["vy"], 1),
            }
            for i, a in enumerate(self.animals)
        ]

    def tick(self, dt_ms: float) -> None:
        now_ms = time.time() * 1000
        for a in self.animals:
            if now_ms >= a["wander_until"]:
                a["wander_until"] = now_ms + WANDER_MIN_MS + random.random() * (
                    WANDER_MAX_MS - WANDER_MIN_MS
                )
                if random.random() < 0.25:
                    a["vx"] = 0.0
                    a["vy"] = 0.0
                else:
                    angle = random.random() * 2 * math.pi
                    a["vx"] = math.cos(angle) * WANDER_SPEED
                    a["vy"] = math.sin(angle) * WANDER_SPEED
            # move (dt_ms is in ms, velocity in px/s)
            dt_sec = dt_ms / 1000.0
            a["x"] = a["x"] + a["vx"] * dt_sec
            a["y"] = a["y"] + a["vy"] * dt_sec
            # clamp to world bounds
            a["x"] = max(0, min(WORLD_WIDTH, a["x"]))
            a["y"] = max(0, min(WORLD_HEIGHT, a["y"]))


office_animals_state = OfficeAnimalsState()


async def run_office_animals_loop(broadcast_fn) -> None:
    """Run simulation and broadcast to all clients every interval_ms."""
    interval_ms = 100  # 10 updates per second
    last = time.perf_counter()
    while True:
        await asyncio.sleep(interval_ms / 1000.0)
        now = time.perf_counter()
        dt_ms = (now - last) * 1000
        last = now
        office_animals_state.tick(dt_ms)
        msg = {"type": "office_animals", "animals": office_animals_state.snapshot()}
        await broadcast_fn(msg)
