from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.core.email import notify_comment_added
from app.core.websocket import ws_manager
from app.core.config import settings
from app.database import get_db
from app.models.activity import Activity
from app.models.comment import Comment
from app.models.notification import Notification
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate

router = APIRouter(prefix="/projects/{project_id}/tasks/{task_id}/comments", tags=["comments"])


def _get_task(project_id: int, task_id: int, user: User, db: Session) -> Task:
    project = db.query(Project).options(joinedload(Project.members)).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id and not any(m.user_id == user.id for m in project.members):
        raise HTTPException(status_code=403, detail="Not a project member")
    task = db.query(Task).options(joinedload(Task.assignee), joinedload(Task.created_by)).filter(
        Task.id == task_id, Task.project_id == project_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _task_link(project_id: int, task_id: int) -> str:
    return f"{settings.FRONTEND_URL}/projects/{project_id}/tasks/{task_id}"


@router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    project_id: int,
    task_id: int,
    body: CommentCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task(project_id, task_id, current_user, db)
    comment = Comment(task_id=task_id, author_id=current_user.id, body=body.body)
    db.add(comment)
    db.flush()

    db.add(Activity(project_id=project_id, user_id=current_user.id, action="added_comment",
                    entity_type="comment", entity_id=comment.id, entity_name=task.title))

    notify_users = set()
    if task.assignee_id and task.assignee_id != current_user.id:
        notify_users.add(task.assignee_id)
    if task.created_by_id != current_user.id:
        notify_users.add(task.created_by_id)

    for uid in notify_users:
        target = db.get(User, uid)
        if target:
            db.add(Notification(
                user_id=uid,
                title="New comment",
                body=f"{current_user.name} commented on {task.title}",
                link=_task_link(project_id, task_id),
            ))
            background.add_task(
                notify_comment_added,
                target.email, target.name, current_user.name, task.title, body.body, _task_link(project_id, task_id)
            )

    db.commit()
    db.refresh(comment)

    comment_data = db.query(Comment).options(joinedload(Comment.author)).filter(Comment.id == comment.id).first()
    out = CommentOut.model_validate(comment_data)
    await ws_manager.broadcast(project_id, "comment_added", {"task_id": task_id, "comment": out.model_dump(mode="json")}, exclude_user=current_user.id)
    return out


@router.get("", response_model=list[CommentOut])
def list_comments(project_id: int, task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_task(project_id, task_id, current_user, db)
    comments = db.query(Comment).options(joinedload(Comment.author)).filter(
        Comment.task_id == task_id
    ).order_by(Comment.created_at).all()
    return comments


@router.patch("/{comment_id}", response_model=CommentOut)
async def update_comment(project_id: int, task_id: int, comment_id: int, body: CommentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_task(project_id, task_id, current_user, db)
    comment = db.query(Comment).options(joinedload(Comment.author)).filter(Comment.id == comment_id).first()
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only edit your own comments")
    comment.body = body.body
    db.commit()
    db.refresh(comment)
    out = CommentOut.model_validate(comment)
    await ws_manager.broadcast(project_id, "comment_updated", {"task_id": task_id, "comment": out.model_dump(mode="json")}, exclude_user=current_user.id)
    return out


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(project_id: int, task_id: int, comment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_task(project_id, task_id, current_user, db)
    comment = db.get(Comment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own comments")
    db.delete(comment)
    db.commit()
    await ws_manager.broadcast(project_id, "comment_deleted", {"task_id": task_id, "comment_id": comment_id}, exclude_user=current_user.id)
