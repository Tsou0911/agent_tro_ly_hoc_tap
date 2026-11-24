from datetime import date, datetime, timezone

from backend.app.kpi import calculate_kpis
from backend.app.models import Assignment, Enrollment, StudyTask, Submission


def dt(day, hour=0):
    return datetime(2026, 11, day, hour, tzinfo=timezone.utc)


def test_kpis_include_missing_submissions_dedupe_and_weight_minutes(db):
    db.add(Enrollment(course_id="c1", student_id="student2"))
    db.add_all([
        Assignment(id="a1", course_id="c1", title="A", due_at=dt(18), source_verified=True),
        Assignment(id="a2", course_id="c1", title="B", due_at=dt(19), source_verified=True),
        Assignment(id="future", course_id="c1", title="C", due_at=dt(25), source_verified=True),
        Assignment(id="unverified", course_id="c1", title="D", due_at=dt(18), source_verified=False),
        Assignment(id="other", course_id="c2", title="E", due_at=dt(18), source_verified=True),
    ])
    db.flush()
    db.add_all([
        Submission(assignment_id="a1", student_id="student", submitted_at=dt(17), source_verified=True),
        Submission(assignment_id="a1", student_id="student", submitted_at=dt(18), source_verified=True),
        Submission(assignment_id="a1", student_id="student2", submitted_at=dt(18, 1), source_verified=True),
        Submission(assignment_id="a2", student_id="student", submitted_at=dt(19), source_verified=False),
        Submission(assignment_id="a2", student_id="outsider", submitted_at=dt(18), source_verified=True),
        StudyTask(course_id="c1", student_id="student", title="one", day=date(2026, 11, 17),
                  estimated_minutes=30, status="done", completed_at=dt(18)),
        StudyTask(course_id="c1", student_id="student", title="two", day=date(2026, 11, 18),
                  estimated_minutes=90, status="todo"),
        StudyTask(course_id="c2", student_id="student", title="private", day=date(2026, 11, 18),
                  estimated_minutes=100, status="done", completed_at=dt(18)),
    ])
    db.commit()
    result = calculate_kpis(db, "c1", dt(16), dt(23), dt(20))
    assert result["completion_rate"] == 50.0
    assert result["progress_rate"] == 25.0
    assert result["eligible_submission_count"] == 4
    assert result["on_time_submission_count"] == 1
    assert result["on_time_submission_rate"] == 25.0


def test_empty_denominators_are_null_not_invented_zero(db):
    result = calculate_kpis(db, "c1", dt(16), dt(23), dt(20))
    assert result["completion_rate"] is None
    assert result["progress_rate"] is None
    assert result["on_time_submission_rate"] is None


def test_deadline_equality_and_exclusive_end(db):
    db.add_all([Assignment(id="a", course_id="c1", title="A", due_at=dt(18), source_verified=True),
                Assignment(id="b", course_id="c1", title="B", due_at=dt(19), source_verified=True)])
    db.flush()
    db.add(Submission(assignment_id="a", student_id="student", submitted_at=dt(18), source_verified=True))
    db.commit()
    result = calculate_kpis(db, "c1", dt(16), dt(19), dt(18))
    assert result["eligible_submission_count"] == 1
    assert result["on_time_submission_rate"] == 100.0
