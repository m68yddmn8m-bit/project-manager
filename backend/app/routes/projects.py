from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.activity import Activity
from app.models.project import Project, ProjectMember, MemberRole
from app.models.user import User
from app.schemas.project import AddMemberRequest, ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _assert_member(project: Project, user: User, min_role: MemberRole = MemberRole.viewer):
    if project.owner_id == user.id:
        return
    member = next((m for m in project.members if m.user_id == user.id), None)
    if not member:
        raise HTTPException(status_code=403, detail="Not a project member")
    role_order = {MemberRole.viewer: 0, MemberRole.editor: 1, MemberRole.admin: 2}
    if role_order[member.role] < role_order[min_role]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _project_out(project: Project) -> ProjectOut:
    data = ProjectOut.model_validate(project)
    data.task_count = len(project.tasks)
    return data


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = Project(**body.model_dump(), owner_id=current_user.id)
    db.add(project)
    db.flush()
    db.add(Activity(project_id=project.id, user_id=current_user.id, action="created_project",
                    entity_type="project", entity_id=project.id, entity_name=project.name))
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owned = db.query(Project).options(
        joinedload(Project.owner), joinedload(Project.members).joinedload(ProjectMember.user), joinedload(Project.tasks)
    ).filter(Project.owner_id == current_user.id).all()

    member_project_ids = [m.project_id for m in current_user.memberships]
    member_projects = []
    if member_project_ids:
        member_projects = db.query(Project).options(
            joinedload(Project.owner), joinedload(Project.members).joinedload(ProjectMember.user), joinedload(Project.tasks)
        ).filter(Project.id.in_(member_project_ids)).all()

    seen = {p.id for p in owned}
    all_projects = owned + [p for p in member_projects if p.id not in seen]
    return [_project_out(p) for p in all_projects]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).options(
        joinedload(Project.owner), joinedload(Project.members).joinedload(ProjectMember.user), joinedload(Project.tasks)
    ).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_member(project, current_user)
    return _project_out(project)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, body: ProjectUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).options(
        joinedload(Project.owner), joinedload(Project.members).joinedload(ProjectMember.user), joinedload(Project.tasks)
    ).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_member(project, current_user, MemberRole.editor)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)

    db.add(Activity(project_id=project.id, user_id=current_user.id, action="updated_project",
                    entity_type="project", entity_id=project.id, entity_name=project.name))
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete a project")
    db.delete(project)
    db.commit()


@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
def add_member(project_id: int, body: AddMemberRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).options(joinedload(Project.members)).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_member(project, current_user, MemberRole.admin)

    if not db.get(User, body.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    existing = next((m for m in project.members if m.user_id == body.user_id), None)
    if existing:
        existing.role = body.role
    else:
        db.add(ProjectMember(project_id=project_id, user_id=body.user_id, role=body.role))
    db.commit()
    return {"ok": True}


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(project_id: int, user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).options(joinedload(Project.members)).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_member(project, current_user, MemberRole.admin)

    member = next((m for m in project.members if m.user_id == user_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
