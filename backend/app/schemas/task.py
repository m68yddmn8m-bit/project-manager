from datetime import datetime
from pydantic import BaseModel
from app.models.task import TaskStatus, TaskPriority
from app.schemas.user import UserOut


class SubtaskCreate(BaseModel):
    title: str
    position: int = 0


class SubtaskUpdate(BaseModel):
    title: str | None = None
    is_completed: bool | None = None
    position: int | None = None


class SubtaskOut(BaseModel):
    id: int
    task_id: int
    title: str
    is_completed: bool
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    assignee_id: int | None = None
    due_date: datetime | None = None
    position: int = 0


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: int | None = None
    due_date: datetime | None = None
    position: int | None = None


class TaskOut(BaseModel):
    id: int
    project_id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    assignee: UserOut | None
    created_by: UserOut
    due_date: datetime | None
    position: int
    created_at: datetime
    updated_at: datetime
    subtasks: list[SubtaskOut]
    comment_count: int = 0

    model_config = {"from_attributes": True}
