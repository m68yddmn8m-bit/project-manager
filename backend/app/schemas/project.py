from datetime import datetime
from pydantic import BaseModel
from app.models.project import ProjectStatus, MemberRole
from app.schemas.user import UserOut


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    due_date: datetime | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: ProjectStatus | None = None
    due_date: datetime | None = None


class MemberOut(BaseModel):
    id: int
    user: UserOut
    role: MemberRole
    joined_at: datetime

    model_config = {"from_attributes": True}


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    status: ProjectStatus
    owner_id: int
    owner: UserOut
    due_date: datetime | None
    created_at: datetime
    updated_at: datetime
    members: list[MemberOut]
    task_count: int = 0

    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    user_id: int
    role: MemberRole = MemberRole.editor
