import json
from collections import defaultdict
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from pydantic import TypeAdapter
from sqlalchemy import func, select

from backend.app import cli
from backend.app.contracts import Chunk, PlanDraft, ReflectionDraft, TutorDraft, WorkflowRequest
from backend.app.models import Course, Enrollment, ReflectionMemory, StudyTask
from backend.app.repository import Repository
from backend.app.workflow import build_graph
from .conftest import FakeRetriever, ScriptedLLM

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = "eval/fixtures/english_workflow.json"
SOURCES = "data/samples/english_chunks.json"
SUITE = json.loads((ROOT / FIXTURE).read_text(encoding="utf-8"))
CHUNKS = {chunk.id: chunk for chunk in TypeAdapter(list[Chunk]).validate_json((ROOT / SOURCES).read_bytes())}
SCHEMAS = {"plan": PlanDraft, "do": TutorDraft, "reflect": ReflectionDraft}


def test_english_demo_seed_is_idempotent(engine, db, monkeypatch):
    monkeypatch.setattr("sys.argv", ["learning-companion", "seed-demo"])
    with (
        patch.object(cli, "Settings", return_value=SimpleNamespace(database_url="sqlite://")),
        patch.object(cli, "create_engine", return_value=engine),
        patch.object(engine, "dispose"),
    ):
        cli.main()
        cli.main()
    assert db.get(Course, "english101").instructor_id == "instructor-demo"
    assert db.get(Enrollment, ("english101", "student-demo")) is not None
    assert db.get(Course, "c1") is not None
    assert {chunk.course_id for chunk in CHUNKS.values()} == {"english101"}


@pytest.fixture(scope="session")
def eval_results(pytestconfig):
    records = []
    yield records
    destination = pytestconfig.getoption("--english-eval-report")
    if destination:
        report = {
            "schema_version": 1,
            "mode": "offline_mock",
            "fixture": FIXTURE,
            "fixture_schema_version": SUITE["schema_version"],
            "sources": SOURCES,
            "passed": sum(row["passed"] for row in records),
            "total": len(records),
            "cases": records,
        }
        Path(destination).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


@pytest.mark.parametrize("case", SUITE["cases"], ids=lambda case: case["id"])
def test_english_workflow(case, db, verdict, eval_results):
    expected = case["expected"]
    record = {
        "id": case["id"], "input": case["request"], "source_ids": case["source_ids"],
        "expected": expected, "actual": None, "passed": False,
    }
    eval_results.append(record)
    db.add(Course(id="english101", title="Tự học tiếng Anh", instructor_id="teacher"))
    db.flush()
    db.add(Enrollment(course_id="english101", student_id="student"))
    db.commit()
    request = WorkflowRequest.model_validate(case["request"])
    draft = case.get("mock_draft")
    llm = ScriptedLLM(SCHEMAS[request.mode].model_validate(draft), verdict) if draft else ScriptedLLM()
    chunks = [CHUNKS[id_] for id_ in case["source_ids"]]
    state = build_graph(llm, FakeRetriever(chunks), Repository(db), max_regenerations=0).invoke({
        "request": request, "course_id": "english101", "student_id": "student",
        "request_id": case["id"], "course_timezone": "Asia/Bangkok",
    })
    result = state["result"]
    schedule = defaultdict(int)
    if result.plan:
        for task in result.plan.tasks:
            schedule[task.day.isoformat()] += task.minutes
    memory = db.get(ReflectionMemory, result.memory_id) if result.memory_id else None
    actual = {
        "status": result.status,
        "response": result.response,
        "citation_ids": [citation.chunk_id for citation in result.citations],
        "schedule_minutes": dict(schedule),
        "saved_task_count": db.scalar(select(func.count()).select_from(StudyTask)),
        "model_calls": len(llm.calls),
        "feedback": state.get("feedback", []),
        "memory_approved": memory.approved_at is not None if memory else None,
        "memory_observations": [item["observation"] for item in memory.payload] if memory else [],
    }
    record["actual"] = actual
    for field, expected_value in expected.items():
        if field == "text_contains":
            assert all(fragment in result.response for fragment in expected_value)
        elif field == "text_excludes":
            assert all(fragment not in result.response for fragment in expected_value)
        elif field == "feedback_contains":
            assert all(item in actual["feedback"] for item in expected_value)
        else:
            assert actual[field] == expected_value
    for citation in result.citations:
        assert citation.chunk_id in case["source_ids"]
        assert citation.model_dump(exclude={"chunk_id"}) == CHUNKS[citation.chunk_id].model_dump(
            include={"title", "resource_id", "document_version", "page", "source_uri"}
        )
    record["passed"] = True
