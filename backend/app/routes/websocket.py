from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import ALGORITHM
from app.core.websocket import ws_manager
from app.database import SessionLocal
from app.models.project import Project
from app.models.user import User

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/projects/{project_id}")
async def project_ws(
    websocket: WebSocket,
    project_id: int,
    token: str = Query(...),
):
    db: Session = SessionLocal()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        await websocket.close(code=4001)
        db.close()
        return

    user = db.get(User, user_id)
    project = db.query(Project).filter(Project.id == project_id).first()
    db.close()

    if not user or not project:
        await websocket.close(code=4004)
        return

    await ws_manager.connect(project_id, user_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive; client sends ping
    except WebSocketDisconnect:
        ws_manager.disconnect(project_id, user_id, websocket)
