from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.activity import Activity
from app.models.user import User
from app.routes.projects import _assert_member
from app.models.project import Project
from app.schemas.activity import ActivityOut
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/projects/{project_id}/activity", tags=["activity"])


@router.get("", response_model=list[ActivityOut])
def get_activity(
    project_id: int,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).options(joinedload(Project.members)).filter(Project.id == project_id).first()
    if project:
        _assert_member(project, current_user)
    return (
        db.query(Activity)
        .options(joinedload(Activity.user))
        .filter(Activity.project_id == project_id)
        .order_by(Activity.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
