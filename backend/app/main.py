from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import auth, profile
from app.ws import world
from app.core.logger import logger

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Virtual Office API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(world.router)


@app.get("/api/health")
def health_check():
    logger.info("Health check requested")
    return {"status": "ok"}
