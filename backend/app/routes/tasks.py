import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.core.email import notify_task_assigned, notify_task_status_changed
from app.core.websocket import ws_manager
from app.core.config import settings
from app.database import get_db
from app.models.activity import Activity
from app.models.notification import Notification
from app.models.project import Project, ProjectMember, MemberRole
from app.models.task import Task, Subtask
from app.models.user import User
from app.schemas.task import SubtaskCreate, SubtaskOut, SubtaskUpdate, TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])


def _get_accessible_project(project_id: int, user: User, db: Session) -> Project:
    project = db.query(Project).options(joinedload(Project.members)).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id and not any(m.user_id == user.id for m in project.members):
        raise HTTPException(status_code=403, detail="Not a project member")
    return project


def _assert_editor(project: Project, user: User):
    if project.owner_id == user.id:
        return
    member = next((m for m in project.members if m.user_id == user.id), None)
    if not member or member.role == MemberRole.viewer:
        raise HTTPException(status_code=403, detail="Editor access required")


def _task_out(task: Task) -> TaskOut:
    data = TaskOut.model_validate(task)
    data.comment_count = len(task.comments)
    return data


def _task_link(project_id: int, task_id: int) -> str:
    return f"{settings.FRONTEND_URL}/projects/{project_id}/tasks/{task_id}"


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: int,
    body: TaskCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_accessible_project(project_id, current_user, db)
    _assert_editor(project, current_user)

    task = Task(**body.model_dump(), project_id=project_id, created_by_id=current_user.id)
    db.add(task)
    db.flush()

    db.add(Activity(project_id=project_id, user_id=current_user.id, action="created_task",
                    entity_type="task", entity_id=task.id, entity_name=task.title))

    if body.assignee_id and body.assignee_id != current_user.id:
        assignee = db.get(User, body.assignee_id)
        if assignee:
            notif = Notification(
                user_id=assignee.id,
                title="New task assigned",
                body=f"{current_user.name} assigned you: {task.title}",
                link=_task_link(project_id, task.id),
            )
            db.add(notif)
            background.add_task(
                notify_task_assigned,
                assignee.email, assignee.name, task.title, project.name, _task_link(project_id, task.id)
            )

    db.commit()
    db.refresh(task)

    task_data = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.created_by), joinedload(Task.subtasks), joinedload(Task.comments)
    ).filter(Task.id == task.id).first()

    await ws_manager.broadcast(project_id, "task_created", TaskOut.model_validate(task_data).model_dump(mode="json"), exclude_user=current_user.id)
    return _task_out(task_data)


@router.get("", response_model=list[TaskOut])
def list_tasks(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_accessible_project(project_id, current_user, db)
    tasks = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.created_by), joinedload(Task.subtasks), joinedload(Task.comments)
    ).filter(Task.project_id == project_id).order_by(Task.position, Task.created_at).all()
    return [_task_out(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskOut)
def get_task(project_id: int, task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_accessible_project(project_id, current_user, db)
    task = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.created_by), joinedload(Task.subtasks), joinedload(Task.comments)
    ).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_out(task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    project_id: int,
    task_id: int,
    body: TaskUpdate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_accessible_project(project_id, current_user, db)
    _assert_editor(project, current_user)

    task = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.created_by), joinedload(Task.subtasks), joinedload(Task.comments)
    ).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    old_assignee_id = task.assignee_id

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(task, field, value)

    meta = {}
    if body.status and body.status != old_status:
        meta = {"old_status": old_status, "new_status": body.status}
        db.add(Activity(project_id=project_id, user_id=current_user.id, action="updated_status",
                        entity_type="task", entity_id=task.id, entity_name=task.title, meta=meta))
        if task.assignee and task.assignee_id != current_user.id:
            notif = Notification(
                user_id=task.assignee_id,
                title="Task status updated",
                body=f"{task.title} moved to {body.status}",
                link=_task_link(project_id, task_id),
            )
            db.add(notif)
            background.add_task(
                notify_task_status_changed,
                task.assignee.email, task.assignee.name, task.title, str(body.status), project.name, _task_link(project_id, task_id)
            )
    else:
        db.add(Activity(project_id=project_id, user_id=current_user.id, action="updated_task",
                        entity_type="task", entity_id=task.id, entity_name=task.title))

    if body.assignee_id and body.assignee_id != old_assignee_id and body.assignee_id != current_user.id:
        assignee = db.get(User, body.assignee_id)
        if assignee:
            db.add(Notification(
                user_id=assignee.id,
                title="Task assigned to you",
                body=f"{current_user.name} assigned you: {task.title}",
                link=_task_link(project_id, task_id),
            ))
            background.add_task(
                notify_task_assigned,
                assignee.email, assignee.name, task.title, project.name, _task_link(project_id, task_id)
            )

    db.commit()
    db.refresh(task)

    await ws_manager.broadcast(project_id, "task_updated", TaskOut.model_validate(task).model_dump(mode="json"), exclude_user=current_user.id)
    return _task_out(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(project_id: int, task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = _get_accessible_project(project_id, current_user, db)
    _assert_editor(project, current_user)
    task = db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    db.add(Activity(project_id=project_id, user_id=current_user.id, action="deleted_task",
                    entity_type="task", entity_id=task_id, entity_name=task.title))
    db.delete(task)
    db.commit()
    await ws_manager.broadcast(project_id, "task_deleted", {"id": task_id}, exclude_user=current_user.id)


# ── Subtasks ──────────────────────────────────────────────────────────────────

subtask_router = APIRouter(prefix="/projects/{project_id}/tasks/{task_id}/subtasks", tags=["subtasks"])


@subtask_router.post("", response_model=SubtaskOut, status_code=status.HTTP_201_CREATED)
async def create_subtask(project_id: int, task_id: int, body: SubtaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = _get_accessible_project(project_id, current_user, db)
    _assert_editor(project, current_user)
    task = db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    subtask = Subtask(**body.model_dump(), task_id=task_id)
    db.add(subtask)
    db.add(Activity(project_id=project_id, user_id=current_user.id, action="created_subtask",
                    entity_type="subtask", entity_id=None, entity_name=body.title))
    db.commit()
    db.refresh(subtask)
    await ws_manager.broadcast(project_id, "subtask_created", {"task_id": task_id, "subtask": SubtaskOut.model_validate(subtask).model_dump(mode="json")}, exclude_user=current_user.id)
    return subtask


@subtask_router.patch("/{subtask_id}", response_model=SubtaskOut)
async def update_subtask(project_id: int, task_id: int, subtask_id: int, body: SubtaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = _get_accessible_project(project_id, current_user, db)
    _assert_editor(project, current_user)
    subtask = db.get(Subtask, subtask_id)
    if not subtask or subtask.task_id != task_id:
        raise HTTPException(status_code=404, detail="Subtask not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(subtask, field, value)
    db.commit()
    db.refresh(subtask)
    await ws_manager.broadcast(project_id, "subtask_updated", {"task_id": task_id, "subtask": SubtaskOut.model_validate(subtask).model_dump(mode="json")}, exclude_user=current_user.id)
    return subtask


@subtask_router.delete("/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subtask(project_id: int, task_id: int, subtask_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = _get_accessible_project(project_id, current_user, db)
    _assert_editor(project, current_user)
    subtask = db.get(Subtask, subtask_id)
    if not subtask or subtask.task_id != task_id:
        raise HTTPException(status_code=404, detail="Subtask not found")
    db.delete(subtask)
    db.commit()
    await ws_manager.broadcast(project_id, "subtask_deleted", {"task_id": task_id, "subtask_id": subtask_id}, exclude_user=current_user.id)
