from sqlalchemy import Column, Integer
from app.core.database import Base


class NoteItem(Base):
    __tablename__ = "note_items"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, nullable=False, index=True)
    task_id = Column(Integer, nullable=False, index=True)
    sort_order = Column(Integer, default=0)
