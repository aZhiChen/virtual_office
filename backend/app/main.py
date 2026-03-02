import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api import announcement, auth, profile, chat, note
from app.ws import world
from app.ws.manager import manager
from app.ws.office_animals import run_office_animals_loop
from app.core.logger import logger
from app.services.announcement_service import generate_system_messages

# Create all tables
Base.metadata.create_all(bind=engine)


async def _broadcast_animals(msg: dict) -> None:
    await manager.broadcast(msg)


async def _announcement_scheduler_loop() -> None:
    last_run_date = None
    while True:
        now = datetime.now()
        should_run = now.hour >= 10 and last_run_date != now.date()
        if should_run:
            db = SessionLocal()
            try:
                created = generate_system_messages(db)
                logger.info("Daily system announcement job completed: created=%s", created)
                if created > 0:
                    await manager.broadcast(
                        {
                            "type": "announcement_updated",
                            "action": "system_generated",
                            "actor_user_id": 0,
                        }
                    )
            except Exception:
                logger.exception("Daily system announcement job failed")
                db.rollback()
            finally:
                db.close()
            last_run_date = now.date()
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    animal_task = asyncio.create_task(run_office_animals_loop(_broadcast_animals))
    announcement_task = asyncio.create_task(_announcement_scheduler_loop())
    yield
    animal_task.cancel()
    announcement_task.cancel()
    for task in (animal_task, announcement_task):
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Virtual Office API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(chat.router)
app.include_router(note.router)
app.include_router(announcement.router)
app.include_router(world.router)


@app.get("/api/health")
def health_check():
    logger.info("Health check requested")
    return {"status": "ok"}
