from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import httpx
import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.orm import Session

from backend.app.llm import Gemini
from backend.app.main import app
from backend.app.models import Enrollment, ReflectionMemory, StudyTask
from backend.app.repository import Repository
from backend.app.workflow import UNAVAILABLE
from .conftest import FakeRetriever, ScriptedLLM, TEST_SECRET


def headers(subject="student", role="student", secret=TEST_SECRET, **overrides):
    now = datetime.now(timezone.utc)
    token = jwt.encode({"sub": subject, "role": role, "iat": now, "exp": now + timedelta(minutes=5),
                        "iss": "learning-companion", "aud": "learning-companion", **overrides}, secret, algorithm="HS256")
    return {"Authorization": "Bearer " + token}


@pytest.fixture
def client(engine):
    with patch("backend.app.main.create_engine", return_value=engine):
        with TestClient(app) as client:
            yield client


def test_student_workflow_and_instructor_escalation_dashboard(client, chunk, draft, verdict, request_body):
    verdict.is_in_scope = False
    app.state.llm = ScriptedLLM(draft, verdict)
    app.state.retriever = FakeRetriever([chunk])
    response = client.post("/api/courses/c1/workflow", json=request_body.model_dump(mode="json"), headers=headers())
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "out_of_scope"
    assert "draft_response" not in result
    rows = client.get("/api/instructor/courses/c1/escalations", headers=headers("teacher", "instructor"))
    assert rows.status_code == 200
    assert rows.json()[0]["question"] == request_body.message
    assert "student_id" not in rows.json()[0]


def test_gemini_validator_failure_returns_existing_unavailable_response(client, chunk, draft, request_body):
    requests = []

    def handler(request):
        requests.append(request)
        if len(requests) == 1:
            return httpx.Response(200, json={"candidates": [{
                "finishReason": "STOP", "content": {"parts": [{"text": draft.model_dump_json()}]},
            }]})
        return httpx.Response(429, text="private diagnostic mock-gemini-key")

    settings = app.state.settings.model_copy(update={"gemini_api_key": SecretStr("mock-gemini-key")})
    app.state.retriever = FakeRetriever([chunk])
    with httpx.Client(transport=httpx.MockTransport(handler)) as transport_client:
        app.state.llm = Gemini(settings, transport_client)
        response = client.post("/api/courses/c1/workflow", headers=headers(), json=request_body.model_dump(mode="json"))
    assert len(requests) == 2
    assert response.status_code == 503
    assert response.json()["status"] == "unavailable"
    assert response.json()["response"] == UNAVAILABLE
    assert response.json()["citations"] == []
    assert "private diagnostic" not in response.text
    assert "mock-gemini-key" not in response.text


def test_demo_login_issues_usable_role_token(client):
    response = client.post("/api/auth/login", json={"subject": "student-demo", "role": "student"})
    assert response.status_code == 200
    token = response.json()["access_token"]
    assert token
    claims = jwt.decode(
        token,
        TEST_SECRET,
        algorithms=["HS256"],
        audience="learning-companion",
        issuer="learning-companion",
    )
    assert claims["sub"] == "student-demo"
    assert claims["role"] == "student"


def test_authentication_and_course_isolation(client, request_body):
    body = request_body.model_dump(mode="json")
    assert client.post("/api/courses/c1/workflow", json=body).status_code == 401
    assert client.post("/api/courses/c1/workflow", json=body, headers=headers(secret="wrong" * 8)).status_code == 401
    assert client.post("/api/courses/c2/workflow", json=body, headers=headers()).status_code == 403
    assert client.get("/api/instructor/courses/c1/escalations", headers=headers()).status_code == 403
    assert client.get("/api/instructor/courses/c1/escalations", headers=headers("other", "instructor")).status_code == 403


def test_confirmed_reflection_only_visible_to_own_future_planner(client, engine):
    with Session(engine) as db:
        memory_id = Repository(db).save_memory("c1", "student", datetime(2026, 11, 16).date(), [{"observation": "hard"}])
    url = f"/api/courses/c1/memories/{memory_id}/approval"
    assert client.put(url, json={"approved": True}, headers=headers("stranger")).status_code == 403
    assert client.put(url, json={"approved": True}, headers=headers()).status_code == 200
    with Session(engine) as db:
        repo = Repository(db)
        assert len(repo.memories("c1", "student", datetime(2026, 11, 23).date())) == 1
        assert repo.memories("c1", "other", datetime(2026, 11, 23).date()) == []
        assert repo.memories("c1", "student", datetime(2026, 11, 16).date()) == []
    assert client.put(url, json={"approved": False}, headers=headers()).status_code == 200
    with Session(engine) as db:
        assert db.get(ReflectionMemory, memory_id).approved_at is None


def test_task_confirmation_status_and_kpi_endpoint(client):
    response = client.post("/api/courses/c1/tasks", headers=headers(),
                           json={"title": "Tự đọc", "day": "2026-11-17", "estimated_minutes": 30})
    assert response.status_code == 201
    task_id = response.json()["id"]
    assert client.patch(f"/api/courses/c1/tasks/{task_id}", headers=headers(), json={"status": "done"}).status_code == 200
    response = client.get("/api/instructor/courses/c1/kpis", headers=headers("teacher", "instructor"),
                          params={"start": "2026-11-16T00:00:00+07:00", "end": "2026-11-23T00:00:00+07:00"})
    assert response.status_code == 200
    assert response.json()["completion_rate"] == 100.0
    assert response.json()["on_time_submission_rate"] is None


def test_api_rejects_plan_without_availability(client, request_body):
    body = request_body.model_dump(mode="json")
    body["mode"] = "plan"
    assert client.post("/api/courses/c1/workflow", json=body, headers=headers()).status_code == 422


@pytest.mark.parametrize("minutes", [0, True, 12.5, "30", -1, 1441])
def test_plan_requires_positive_integer_availability(client, minutes):
    response = client.post("/api/courses/c1/workflow", headers=headers(), json={
        "mode": "plan", "message": "Luyện nghe tiếng Anh", "week_start": "2026-11-16",
        "available_minutes": {"2026-11-16": minutes},
    })
    assert response.status_code == 422


@pytest.mark.parametrize("auth", [
    {"Authorization": "Bearer broken"},
    headers(exp=datetime(2000, 1, 1, tzinfo=timezone.utc)),
    headers(exp=[]),
])
def test_api_rejects_expired_or_malformed_session(client, auth):
    assert client.get("/api/instructor/courses/c1/escalations", headers=auth).status_code == 401


@pytest.mark.parametrize("title,minutes", [("   ", 30), ("Luyện nói", "30"), ("Luyện nói", 0)])
def test_task_api_rejects_invalid_input(client, title, minutes):
    response = client.post("/api/courses/c1/tasks", headers=headers(),
                           json={"title": title, "day": "2026-11-17", "estimated_minutes": minutes})
    assert response.status_code == 422


def test_list_tasks_empty(client):
    response = client.get(
        "/api/courses/c1/tasks",
        params={"week_start": "2026-11-23"},
        headers=headers(),
    )
    assert response.status_code == 200
    assert response.json() == []


def test_list_tasks_boundaries_same_day_order_and_patch(client, engine):
    with Session(engine) as db:
        db.add_all([
            StudyTask(id="task-20", course_id="c1", student_id="student",
                      title="Ngoài tuần", day=date(2026, 11, 22),
                      estimated_minutes=5, status="todo"),
            StudyTask(id="task-10", course_id="c1", student_id="student",
                      title="Ngày đầu", day=date(2026, 11, 23),
                      estimated_minutes=20, status="todo"),
            StudyTask(id="task-11", course_id="c1", student_id="student",
                      title="Cùng ngày", day=date(2026, 11, 23),
                      estimated_minutes=15, status="todo"),
            StudyTask(id="task-12", course_id="c1", student_id="student",
                      title="Ngày cuối", day=date(2026, 11, 29),
                      estimated_minutes=25, status="todo"),
            StudyTask(id="task-30", course_id="c1", student_id="student",
                      title="Ngoài tuần sau", day=date(2026, 11, 30),
                      estimated_minutes=5, status="todo"),
        ])
        db.commit()

    patch_response = client.patch(
        "/api/courses/c1/tasks/task-11",
        headers=headers(),
        json={"status": "done"},
    )
    assert patch_response.status_code == 200

    response = client.get(
        "/api/courses/c1/tasks",
        params={"week_start": "2026-11-23"},
        headers=headers(),
    )
    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == ["task-10", "task-11", "task-12"]
    assert response.json()[1] == {
        "id": "task-11",
        "title": "Cùng ngày",
        "day": "2026-11-23",
        "estimated_minutes": 15,
        "status": "done",
    }


def test_list_tasks_isolated_by_student_and_course(client, engine):
    with Session(engine) as db:
        db.add(Enrollment(course_id="c2", student_id="student"))
        db.add_all([
            StudyTask(id="owner-task", course_id="c1", student_id="student",
                      title="Task của chủ", day=date(2026, 11, 24),
                      estimated_minutes=30, status="todo"),
            StudyTask(id="other-task", course_id="c1", student_id="other",
                      title="Task sinh viên khác", day=date(2026, 11, 24),
                      estimated_minutes=20, status="todo"),
            StudyTask(id="course-task", course_id="c2", student_id="student",
                      title="Task học phần khác", day=date(2026, 11, 24),
                      estimated_minutes=10, status="todo"),
        ])
        db.commit()

    c1_response = client.get(
        "/api/courses/c1/tasks",
        params={"week_start": "2026-11-23"},
        headers=headers(),
    )
    c2_response = client.get(
        "/api/courses/c2/tasks",
        params={"week_start": "2026-11-23"},
        headers=headers(),
    )
    assert c1_response.status_code == 200
    assert [row["id"] for row in c1_response.json()] == ["owner-task"]
    assert c2_response.status_code == 200
    assert [row["id"] for row in c2_response.json()] == ["course-task"]


@pytest.mark.parametrize("auth", [
    {},
    {"Authorization": "Bearer broken"},
    headers(exp=datetime(2000, 1, 1, tzinfo=timezone.utc)),
])
def test_list_tasks_rejects_missing_malformed_or_expired_token(client, auth):
    response = client.get(
        "/api/courses/c1/tasks",
        params={"week_start": "2026-11-23"},
        headers=auth,
    )
    assert response.status_code == 401


@pytest.mark.parametrize("auth,course_id", [
    (headers("student", "instructor"), "c1"),
    (headers("stranger", "student"), "c1"),
    (headers("student", "student"), "missing"),
])
def test_list_tasks_rejects_role_enrollment_or_missing_course(client, auth, course_id):
    response = client.get(
        f"/api/courses/{course_id}/tasks",
        params={"week_start": "2026-11-23"},
        headers=auth,
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "Course access denied"}


@pytest.mark.parametrize("week_start", [
    None,
    "2026-11",
    "2026-11-31",
    "2026-02-29",
    "2026-11-23T00:00:00",
])
def test_list_tasks_rejects_missing_or_invalid_week_start(client, week_start):
    params = {} if week_start is None else {"week_start": week_start}
    response = client.get(
        "/api/courses/c1/tasks",
        params=params,
        headers=headers(),
    )
    assert response.status_code == 422


def test_demo_login_rejects_whitespace_subject(client):
    assert client.post("/api/auth/login", json={"subject": "   ", "role": "student"}).status_code == 422
