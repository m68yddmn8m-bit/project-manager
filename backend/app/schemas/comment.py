from datetime import datetime
from pydantic import BaseModel
from app.schemas.user import UserOut


class CommentCreate(BaseModel):
    body: str


class CommentUpdate(BaseModel):
    body: str


class CommentOut(BaseModel):
    id: int
    task_id: int
    body: str
    author: UserOut
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
