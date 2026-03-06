from datetime import datetime, timezone, date as date_type, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.note import Note
from app.models.task import Task
from app.models.note_item import NoteItem
from app.services.announcement_service import refresh_user_daily_stat
from app.services.llm_client import generate_task_summary
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.logger import logger

router = APIRouter(prefix="/api/note", tags=["note"])
security = HTTPBearer()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    try:
        payload = decode_access_token(credentials.credentials)
        return int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _ensure_note(user_id: int, db: Session) -> Note:
    """Get or create the user's single Note."""
    note = db.query(Note).filter(Note.user_id == user_id).first()
    if not note:
        note = Note(user_id=user_id)
        db.add(note)
        db.commit()
        db.refresh(note)
    return note


# ── Schemas ──────────────────────────────────────────────

class TaskOut(BaseModel):
    id: int
    content: str
    status: str
    created_at: datetime | None = None
    completed_at: datetime | None = None
    model_config = {"from_attributes": True}


class NoteItemOut(BaseModel):
    note_item_id: int
    task: TaskOut
    sort_order: int


class NoteOut(BaseModel):
    note_id: int
    items: list[NoteItemOut]


class CreateTaskRequest(BaseModel):
    content: str


class AddTaskToNoteRequest(BaseModel):
    task_id: int


class ReorderRequest(BaseModel):
    note_item_ids: list[int]


class CompletedGroup(BaseModel):
    date: str
    tasks: list[TaskOut]

class SummaryRequest(BaseModel):
    dates: list[str]
    tz_offset_minutes: int = 0


class SummaryResponse(BaseModel):
    dates: list[str]
    summary: str
    task_count: int


# ── Note endpoints ───────────────────────────────────────

@router.get("", response_model=NoteOut)
def get_note(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    note = _ensure_note(user_id, db)
    items = (
        db.query(NoteItem, Task)
        .join(Task, NoteItem.task_id == Task.id)
        .filter(NoteItem.note_id == note.id)
        .order_by(NoteItem.sort_order.asc(), NoteItem.id.asc())
        .all()
    )
    return NoteOut(
        note_id=note.id,
        items=[
            NoteItemOut(
                note_item_id=ni.id,
                task=TaskOut.model_validate(t),
                sort_order=ni.sort_order,
            )
            for ni, t in items
        ],
    )


@router.post("/task", response_model=NoteItemOut)
def create_task_and_add(
    req: CreateTaskRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a new task and add it to the current Note."""
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    note = _ensure_note(user_id, db)
    task = Task(user_id=user_id, content=req.content.strip())
    db.add(task)
    db.flush()
    max_order = (
        db.query(NoteItem.sort_order)
        .filter(NoteItem.note_id == note.id)
        .order_by(NoteItem.sort_order.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0
    ni = NoteItem(note_id=note.id, task_id=task.id, sort_order=next_order)
    db.add(ni)
    refresh_user_daily_stat(db, user_id, mark_used=True)
    db.commit()
    db.refresh(task)
    db.refresh(ni)
    logger.info("Task created & added to note: user=%s task=%s", user_id, task.id)
    return NoteItemOut(
        note_item_id=ni.id,
        task=TaskOut.model_validate(task),
        sort_order=ni.sort_order,
    )


@router.post("/add", response_model=NoteItemOut)
def add_existing_task_to_note(
    req: AddTaskToNoteRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Add an existing pending task to the current Note."""
    task = db.query(Task).filter(Task.id == req.task_id, Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    note = _ensure_note(user_id, db)
    existing = (
        db.query(NoteItem)
        .filter(NoteItem.note_id == note.id, NoteItem.task_id == task.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Task already in Note")
    max_order = (
        db.query(NoteItem.sort_order)
        .filter(NoteItem.note_id == note.id)
        .order_by(NoteItem.sort_order.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0
    ni = NoteItem(note_id=note.id, task_id=task.id, sort_order=next_order)
    db.add(ni)
    refresh_user_daily_stat(db, user_id, mark_used=True)
    db.commit()
    db.refresh(ni)
    logger.info("Task added to note: user=%s task=%s", user_id, task.id)
    return NoteItemOut(
        note_item_id=ni.id,
        task=TaskOut.model_validate(task),
        sort_order=ni.sort_order,
    )


@router.put("/complete/{task_id}", response_model=TaskOut)
def complete_task(
    task_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Mark a task as completed."""
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status == "completed":
        raise HTTPException(status_code=400, detail="Task already completed")
    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    refresh_user_daily_stat(db, user_id, mark_used=True)
    db.commit()
    db.refresh(task)
    logger.info("Task completed: user=%s task=%s", user_id, task_id)
    return TaskOut.model_validate(task)


@router.delete("/clear")
def clear_note(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Remove all items from the current Note (tasks themselves are preserved)."""
    note = _ensure_note(user_id, db)
    db.query(NoteItem).filter(NoteItem.note_id == note.id).delete()
    refresh_user_daily_stat(db, user_id, mark_used=False)
    db.commit()
    logger.info("Note cleared: user=%s", user_id)
    return {"status": "ok"}


@router.put("/reorder")
def reorder_note(
    req: ReorderRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Reorder note items. Send the full list of note_item_ids in desired order."""
    note = _ensure_note(user_id, db)
    items = (
        db.query(NoteItem)
        .filter(NoteItem.note_id == note.id, NoteItem.id.in_(req.note_item_ids))
        .all()
    )
    id_to_item = {item.id: item for item in items}
    for idx, nid in enumerate(req.note_item_ids):
        if nid in id_to_item:
            id_to_item[nid].sort_order = idx
    db.commit()
    return {"status": "ok"}


@router.delete("/item/{note_item_id}")
def remove_note_item(
    note_item_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Remove a single item from the Note (task is preserved)."""
    note = _ensure_note(user_id, db)
    ni = (
        db.query(NoteItem)
        .filter(NoteItem.id == note_item_id, NoteItem.note_id == note.id)
        .first()
    )
    if not ni:
        raise HTTPException(status_code=404, detail="Note item not found")
    db.delete(ni)
    refresh_user_daily_stat(db, user_id, mark_used=False)
    db.commit()
    logger.info("Note item removed: user=%s item=%s", user_id, note_item_id)
    return {"status": "ok"}


# ── Box endpoints (pending / completed task pools) ───────

@router.get("/box/pending", response_model=list[TaskOut])
def get_pending_tasks(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get all pending tasks for the user (the pending box)."""
    tasks = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.status == "pending")
        .order_by(Task.created_at.desc())
        .all()
    )
    return [TaskOut.model_validate(t) for t in tasks]


@router.get("/box/completed", response_model=list[TaskOut])
def get_completed_tasks(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get all completed tasks for the user (the completed box)."""
    tasks = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.status == "completed")
        .order_by(Task.completed_at.desc())
        .all()
    )
    return [TaskOut.model_validate(t) for t in tasks]



@router.post("/summary", response_model=SummaryResponse)
async def generate_summary(
    req: SummaryRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Generate an LLM summary of completed tasks for the selected local dates."""
    if not req.dates:
        raise HTTPException(status_code=400, detail="At least one date is required")

    target_dates: list[date_type] = []
    for d in req.dates:
        try:
            target_dates.append(date_type.fromisoformat(d))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {d}, expected YYYY-MM-DD")

    from sqlalchemy import or_
    tz_delta = timedelta(minutes=req.tz_offset_minutes)
    date_filters = []
    for td in target_dates:
        local_start = datetime(td.year, td.month, td.day, tzinfo=timezone.utc)
        utc_start = local_start + tz_delta
        utc_end = utc_start + timedelta(days=1)
        date_filters.append(
            and_(Task.completed_at >= utc_start, Task.completed_at < utc_end)
        )

    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.status == "completed",
            or_(*date_filters),
        )
        .order_by(Task.completed_at.asc())
        .all()
    )
    if not tasks:
        raise HTTPException(status_code=404, detail="No completed tasks found for the selected dates")

    tasks_by_date: dict[str, list[str]] = {}
    for t in tasks:
        if t.completed_at:
            local_dt = t.completed_at - tz_delta
            d = local_dt.strftime("%Y-%m-%d")
        else:
            d = "unknown"
        tasks_by_date.setdefault(d, []).append(t.content)

    sorted_dates = sorted(tasks_by_date.keys())
    try:
        summary = await generate_task_summary(sorted_dates, tasks_by_date)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return SummaryResponse(dates=sorted_dates, summary=summary, task_count=len(tasks))
