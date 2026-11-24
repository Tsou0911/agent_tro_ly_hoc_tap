from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Assignment, Course, Enrollment, StudyTask, Submission


def utc(value: datetime) -> datetime:
    # SQLite drops timezone information; all persisted timestamps are UTC.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def percentage(numerator: int, denominator: int) -> float | None:
    if not denominator:
        return None
    return float((Decimal(numerator) * 100 / Decimal(denominator)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calculate_kpis(session: Session, course_id: str, start: datetime, end: datetime, as_of: datetime) -> dict:
    """Period is [start, end); deadline eligibility includes exactly as_of."""
    start, end, as_of = utc(start), utc(end), utc(as_of)
    if end <= start:
        raise ValueError("Invalid reporting period")
    students = set(session.scalars(select(Enrollment.student_id).where(Enrollment.course_id == course_id)))
    course = session.get(Course, course_id)
    tz = ZoneInfo(course.timezone)
    # Tasks are day-granular; boundaries follow the course's local calendar.
    tasks = list(session.scalars(select(StudyTask).where(
        StudyTask.course_id == course_id, StudyTask.student_id.in_(students),
        StudyTask.day >= start.astimezone(tz).date(), StudyTask.day < end.astimezone(tz).date())))
    done = [t for t in tasks if t.status == "done" and t.completed_at is not None and utc(t.completed_at) <= as_of]
    assignments = list(session.scalars(select(Assignment).where(
        Assignment.course_id == course_id, Assignment.source_verified.is_(True),
        Assignment.due_at >= start, Assignment.due_at < end, Assignment.due_at <= as_of)))
    deadlines = {a.id: utc(a.due_at) for a in assignments}
    submissions = session.scalars(select(Submission).where(
        Submission.assignment_id.in_(deadlines), Submission.student_id.in_(students),
        Submission.source_verified.is_(True), Submission.submitted_at <= as_of))
    # Multiple attempts must never inflate the numerator.
    on_time = {(s.assignment_id, s.student_id) for s in submissions if utc(s.submitted_at) <= deadlines[s.assignment_id]}
    eligible = len(assignments) * len(students)
    minutes = sum(t.estimated_minutes for t in tasks)
    completed_minutes = sum(t.estimated_minutes for t in done)
    return {
        "period_start": start.isoformat(), "period_end": end.isoformat(), "as_of": as_of.isoformat(),
        "task_count": len(tasks), "completed_task_count": len(done),
        "completion_rate": percentage(len(done), len(tasks)),
        "planned_minutes": minutes, "completed_minutes": completed_minutes,
        "progress_rate": percentage(completed_minutes, minutes),
        "eligible_submission_count": eligible, "on_time_submission_count": len(on_time),
        "on_time_submission_rate": percentage(len(on_time), eligible),
    }
