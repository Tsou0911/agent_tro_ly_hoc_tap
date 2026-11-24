from datetime import date
from unittest.mock import Mock

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError

from backend.app.contracts import PlanDraft, ReflectionDraft
from backend.app.llm import ModelUnavailable
from backend.app.models import InstructorEscalation, ReflectionMemory
from backend.app.repository import Repository
from backend.app.workflow import build_graph
from .conftest import FakeRetriever, ScriptedLLM


def invoke(llm, chunks, db, request_body, retries=2):
    return build_graph(llm, FakeRetriever(chunks), Repository(db), retries).invoke({
        "request": request_body, "course_id": "c1", "student_id": "student",
        "request_id": "request-1", "course_timezone": "Asia/Bangkok",
    })


def test_grounded_response_has_real_metadata(db, chunk, draft, verdict, request_body):
    state = invoke(ScriptedLLM(draft, verdict), [chunk], db, request_body)
    assert state["result"].status == "ok"
    assert "[c1-loop]" in state["result"].response
    assert state["result"].citations[0].page == 2
    assert "draft_response" not in state["result"].model_dump()


def test_out_of_scope_precedes_other_flags_and_persists_once(db, chunk, draft, verdict, request_body):
    verdict = verdict.model_copy(update={"is_in_scope": False, "is_grounded": False, "is_academic_compliant": False})
    for _ in range(2):
        result = invoke(ScriptedLLM(draft, verdict), [chunk], db, request_body)["result"]
        assert result.status == "out_of_scope"
        assert result.escalation_id
        assert not result.citations
    assert db.scalar(select(func.count()).select_from(InstructorEscalation)) == 1
    row = db.scalar(select(InstructorEscalation))
    assert row.question == request_body.message
    assert row.course_id == "c1"


@pytest.mark.parametrize("message", ["Làm hộ bài tập cho mình", "Viết code hoàn chỉnh để nộp", "Solve my homework", "Give the full solution"])
def test_explicit_cheating_blocked_even_if_validator_passes(db, chunk, draft, verdict, request_body, message):
    request_body.message = message
    result = invoke(ScriptedLLM(draft, verdict), [chunk], db, request_body)["result"]
    assert result.status == "academic_refusal"
    assert not result.citations


def test_validator_academic_failure_blocks_draft(db, chunk, draft, verdict, request_body):
    verdict.is_academic_compliant = False
    assert invoke(ScriptedLLM(draft, verdict), [chunk], db, request_body)["result"].status == "academic_refusal"


def test_ungrounded_draft_regenerates_then_passes(db, chunk, draft, verdict, request_body):
    bad = verdict.model_copy(update={"is_grounded": False})
    llm = ScriptedLLM(draft, bad, draft, verdict)
    state = invoke(llm, [chunk], db, request_body)
    assert state["attempts"] == 2
    assert state["result"].status == "ok"
    assert llm.calls[2][1]["feedback"]


@pytest.mark.parametrize("mutation", ["source", "quote", "empty", "inline"])
def test_fake_citations_cannot_be_approved_by_model(db, chunk, draft, verdict, request_body, mutation):
    if mutation == "source":
        draft.statements[0].evidence[0].chunk_id = "invented"
    elif mutation == "quote":
        draft.statements[0].evidence[0].quote = "Không có trong nguồn"
    elif mutation == "inline":
        draft.statements[0].text += " [invented]"
    else:
        draft.statements = []
    llm = ScriptedLLM(draft, verdict, draft, verdict, draft, verdict)
    state = invoke(llm, [chunk], db, request_body)
    assert state["attempts"] == 3
    assert state["result"].status == "insufficient_evidence"
    assert not state["result"].citations


def test_validator_failure_never_releases_draft(db, chunk, draft, request_body):
    llm = ScriptedLLM(draft, ModelUnavailable("bad JSON"))
    state = invoke(llm, [chunk], db, request_body)
    assert state["result"].status == "unavailable"
    assert draft.statements[0].text not in state["result"].response


def test_empty_retrieval_is_not_automatically_out_of_scope(db, request_body):
    state = invoke(ScriptedLLM(), [], db, request_body)
    assert state["result"].status == "insufficient_evidence"
    assert db.scalar(select(func.count()).select_from(InstructorEscalation)) == 0


def test_wrong_course_cannot_enter_prompt(db, chunk, request_body):
    chunk.course_id = "c2"
    assert invoke(ScriptedLLM(), [chunk], db, request_body)["result"].status == "unavailable"


def test_planner_rejects_overbooked_day(db, chunk, draft, verdict, request_body):
    request_body.mode = "plan"
    request_body.available_minutes = {date(2026, 11, 16): 30}
    plan = PlanDraft(tasks=[{**draft.statements[0].model_dump(), "day": "2026-11-16", "minutes": 40}])
    result = invoke(ScriptedLLM(plan, verdict), [chunk], db, request_body, retries=0)["result"]
    assert result.status == "insufficient_evidence"


def test_reflection_requires_confirmation_before_planner_memory(db, chunk, draft, verdict, request_body):
    request_body.mode = "reflect"
    request_body.message = "Tôi còn khó hiểu điều kiện dừng."
    reflection = ReflectionDraft(questions=draft.statements, memory=[{
        "observation": "Còn khó hiểu điều kiện dừng", "student_quote": request_body.message}])
    result = invoke(ScriptedLLM(reflection, verdict), [chunk], db, request_body)["result"]
    assert result.status == "ok"
    assert result.memory_id
    assert db.get(ReflectionMemory, result.memory_id).approved_at is None
    assert Repository(db).memories("c1", "student", date(2026, 11, 23)) == []


def test_failed_escalation_is_not_reported_as_success(chunk, draft, verdict, request_body):
    repo = Mock()
    repo.assignments.return_value = []
    repo.escalate.side_effect = OperationalError("insert", {}, Exception("DB down"))
    verdict.is_in_scope = False
    graph = build_graph(ScriptedLLM(draft, verdict), FakeRetriever([chunk]), repo)
    with pytest.raises(OperationalError):
        graph.invoke({"request": request_body, "course_id": "c1", "student_id": "student",
                      "request_id": "req", "course_timezone": "Asia/Bangkok"})
