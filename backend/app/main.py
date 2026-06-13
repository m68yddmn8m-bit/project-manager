from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database import Base, engine
import app.models  # noqa: F401 — ensure all models are registered before create_all
from app.routes import auth, projects, tasks, comments, activity, notifications, websocket

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Project Manager API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(tasks.subtask_router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(websocket.router)


@app.get("/health")
def health():
    return {"status": "ok"}
