from datetime import datetime
from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    title: str
    body: str
    link: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
