from datetime import datetime
from pydantic import BaseModel
from app.schemas.user import UserOut


class ActivityOut(BaseModel):
    id: int
    project_id: int
    user: UserOut
    action: str
    entity_type: str
    entity_id: int | None
    entity_name: str | None
    meta: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}
