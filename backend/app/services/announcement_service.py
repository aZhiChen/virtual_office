from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.logger import logger
from app.models.note import Note
from app.models.note_item import NoteItem
from app.models.system_message import SystemMessage
from app.models.task import Task
from app.models.user import User
from app.models.user_daily_stat import UserDailyStat


def _today_utc_date() -> date:
    return datetime.now(timezone.utc).date()


def _get_or_create_daily_stat(db: Session, user_id: int, target_date: date) -> UserDailyStat:
    row = (
        db.query(UserDailyStat)
        .filter(UserDailyStat.user_id == user_id, UserDailyStat.stat_date == target_date)
        .first()
    )
    if row:
        return row
    row = UserDailyStat(
        user_id=user_id,
        stat_date=target_date,
        used_note=False,
        all_completed=False,
    )
    db.add(row)
    db.flush()
    return row


def refresh_user_daily_stat(db: Session, user_id: int, mark_used: bool = False) -> None:
    target_date = _today_utc_date()
    row = _get_or_create_daily_stat(db, user_id, target_date)
    if mark_used:
        row.used_note = True

    note = db.query(Note).filter(Note.user_id == user_id).first()
    if not note:
        row.all_completed = False
        return

    rows = (
        db.query(Task.status)
        .join(NoteItem, NoteItem.task_id == Task.id)
        .filter(NoteItem.note_id == note.id)
        .all()
    )
    statuses = [status for (status,) in rows]
    has_any_task = len(statuses) > 0
    row.all_completed = has_any_task and all(s == "completed" for s in statuses)


def _calc_consecutive_days(
    db: Session, user_id: int, end_date: date, field_name: str
) -> int:
    streak = 0
    cursor = end_date
    while True:
        row = (
            db.query(UserDailyStat)
            .filter(UserDailyStat.user_id == user_id, UserDailyStat.stat_date == cursor)
            .first()
        )
        if not row:
            break
        value = getattr(row, field_name, False)
        if not value:
            break
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


def _build_system_content(display_name: str, message_type: str, streak_days: int) -> str:
    if message_type == "note_usage_streak":
        return (
            f"📣 系统表扬：{display_name} 已连续 {streak_days} 天使用 Note 记录任务，"
            "保持这个好习惯，效率正在稳步提升！"
        )
    return (
        f"📣 系统表扬：{display_name} 已连续 {streak_days} 天达成 Note 当日全部完成，"
        "执行力超棒，继续冲！"
    )


def generate_system_messages(db: Session, as_of_date: date | None = None) -> int:
    # Count streaks up to yesterday by default.
    end_date = as_of_date or (_today_utc_date() - timedelta(days=1))
    created_count = 0
    users = db.query(User).all()
    for user in users:
        usage_streak = _calc_consecutive_days(db, user.id, end_date, "used_note")
        completion_streak = _calc_consecutive_days(db, user.id, end_date, "all_completed")
        candidates = [
            ("note_usage_streak", usage_streak),
            ("note_completion_streak", completion_streak),
        ]
        for message_type, streak_days in candidates:
            if streak_days < 3:
                continue
            exists = (
                db.query(SystemMessage)
                .filter(
                    SystemMessage.user_id == user.id,
                    SystemMessage.message_type == message_type,
                    SystemMessage.streak_days == streak_days,
                )
                .first()
            )
            if exists:
                continue
            content = _build_system_content(
                user.display_name or user.username,
                message_type,
                streak_days,
            )
            db.add(
                SystemMessage(
                    user_id=user.id,
                    message_type=message_type,
                    streak_days=streak_days,
                    content=content,
                )
            )
            created_count += 1

    if created_count:
        db.commit()
    else:
        db.rollback()
    logger.info("System announcement generation done: created=%s", created_count)
    return created_count
