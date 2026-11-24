from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def uid() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    instructor_id: Mapped[str] = mapped_column(String(100), index=True)
    timezone: Mapped[str] = mapped_column(String(100), default="Asia/Bangkok")


class Enrollment(Base):
    __tablename__ = "enrollments"
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), primary_key=True)
    student_id: Mapped[str] = mapped_column(String(100), primary_key=True)


class Assignment(Base):
    __tablename__ = "assignments"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    graded: Mapped[bool] = mapped_column(Boolean, default=True)
    source_verified: Mapped[bool] = mapped_column(Boolean, default=False)


class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    assignment_id: Mapped[str] = mapped_column(ForeignKey("assignments.id"), index=True)
    student_id: Mapped[str] = mapped_column(String(100), index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_verified: Mapped[bool] = mapped_column(Boolean, default=False)


class StudyTask(Base):
    __tablename__ = "study_tasks"
    __table_args__ = (
        CheckConstraint("estimated_minutes > 0"),
        CheckConstraint("status IN ('todo', 'in_progress', 'done')"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    student_id: Mapped[str] = mapped_column(String(100), index=True)
    title: Mapped[str] = mapped_column(Text)
    day: Mapped[date] = mapped_column(Date)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="todo")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InstructorEscalation(Base):
    __tablename__ = "instructor_escalations"
    __table_args__ = (UniqueConstraint("course_id", "student_id", "request_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    request_id: Mapped[str] = mapped_column(String(36))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    student_id: Mapped[str] = mapped_column(String(100))
    question: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(String(100), default="out_of_scope")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ReflectionMemory(Base):
    __tablename__ = "reflection_memories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    student_id: Mapped[str] = mapped_column(String(100), index=True)
    week_start: Mapped[date] = mapped_column(Date)
    payload: Mapped[list] = mapped_column(JSON)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
