import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import auth, profile, chat
from app.ws import world
from app.ws.manager import manager
from app.ws.office_animals import run_office_animals_loop
from app.core.logger import logger

# Create all tables
Base.metadata.create_all(bind=engine)


async def _broadcast_animals(msg: dict) -> None:
    await manager.broadcast(msg)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(run_office_animals_loop(_broadcast_animals))
    yield
    task.cancel()
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
app.include_router(world.router)


@app.get("/api/health")
def health_check():
    logger.info("Health check requested")
    return {"status": "ok"}
