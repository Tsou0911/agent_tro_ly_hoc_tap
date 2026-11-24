from datetime import date

import pytest
from pydantic import ValidationError

from backend.app.contracts import PlanDraft, ReflectionDraft, Verdict, WorkflowRequest
from backend.app.guardrails import check_memory, check_plan, requests_completed_work


def test_plan_deadline_converts_to_course_timezone(draft):
    plan = PlanDraft(tasks=[{**draft.statements[0].model_dump(), "day": "2026-11-18", "minutes": 30, "assignment_id": "a"}])
    deadline = [{"id": "a", "due_at": "2026-11-17T18:00:00+00:00"}]
    assert not check_plan(plan, date(2026, 11, 16), {date(2026, 11, 18): 30}, deadline, "Asia/Bangkok")
    plan.tasks[0].day = date(2026, 11, 19)
    assert "Task after assignment deadline" in check_plan(plan, date(2026, 11, 16), {date(2026, 11, 19): 30}, deadline, "Asia/Bangkok")


def test_reflection_cannot_invent_student_quote(draft):
    reflection = ReflectionDraft(questions=draft.statements, memory=[{"observation": "Done", "student_quote": "I finished all tasks"}])
    assert check_memory(reflection, "Tôi chưa xong")


def test_validator_rejects_string_booleans():
    with pytest.raises(ValidationError):
        Verdict(is_grounded="false", is_academic_compliant=True, is_in_scope=True)


def test_normal_planning_not_flagged_as_cheating():
    assert not requests_completed_work("Viết giúp tôi kế hoạch ôn tập tuần này")


def test_availability_cannot_reference_another_week():
    with pytest.raises(ValidationError):
        WorkflowRequest(mode="plan", message="Ôn tập", week_start="2026-11-16", available_minutes={"2026-11-30": 30})
