from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import Assignment, InstructorEscalation, ReflectionMemory


class Repository:
    def __init__(self, session: Session):
        self.session = session

    def assignments(self, course_id: str) -> list[dict]:
        return [{"id": a.id, "title": a.title, "due_at": a.due_at.isoformat(), "graded": a.graded}
                for a in self.session.scalars(select(Assignment).where(Assignment.course_id == course_id))]

    def memories(self, course_id: str, student_id: str, before: date) -> list:
        records = self.session.scalars(
            select(ReflectionMemory).where(
                ReflectionMemory.course_id == course_id,
                ReflectionMemory.student_id == student_id,
                ReflectionMemory.week_start < before,
                ReflectionMemory.approved_at.is_not(None),
            ).order_by(ReflectionMemory.week_start.desc(), ReflectionMemory.created_at.desc()).limit(4)
        )
        return [record.payload for record in records]

    def save_memory(self, course_id: str, student_id: str, week_start: date, payload: list) -> str:
        memory = ReflectionMemory(course_id=course_id, student_id=student_id,
                                  week_start=week_start, payload=payload)
        self.session.add(memory)
        self.session.commit()
        return memory.id

    def escalate(self, course_id: str, student_id: str, request_id: str, question: str) -> str:
        conditions = (InstructorEscalation.course_id == course_id,
                      InstructorEscalation.student_id == student_id,
                      InstructorEscalation.request_id == request_id)
        existing = self.session.scalar(select(InstructorEscalation).where(*conditions))
        if existing:
            return existing.id
        row = InstructorEscalation(course_id=course_id, student_id=student_id,
                                   request_id=request_id, question=question)
        self.session.add(row)
        try:
            self.session.commit()
        except IntegrityError:
            self.session.rollback()
            existing = self.session.scalar(select(InstructorEscalation).where(*conditions))
            if existing is None:
                raise
            return existing.id
        return row.id
