from datetime import date
from unittest.mock import Mock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.config import Settings
from backend.app.contracts import Chunk, TutorDraft, Verdict, WorkflowRequest
from backend.app.models import Base, Course, Enrollment

TEST_SECRET = "test-signing-secret-32-characters-long"


def pytest_addoption(parser):
    parser.addoption("--english-eval-report", help="Write the English offline eval results to this JSON path.")


@pytest.fixture(autouse=True)
def isolate_app_settings(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    settings = Settings(
        _env_file=None, app_env="development", jwt_secret=TEST_SECRET,
        database_url="postgresql+pg8000://test:test@localhost/test",
        gemini_api_key="",
        qdrant_url="http://127.0.0.1:6333", max_regenerations=2,
    )
    monkeypatch.setattr("backend.app.main.Settings", lambda: settings)
    monkeypatch.setattr("backend.app.main.Gemini", Mock(return_value=ScriptedLLM()))
    monkeypatch.setattr("backend.app.main.Retriever", Mock(return_value=FakeRetriever([])))


@pytest.fixture
def engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([Course(id="c1", title="Python", instructor_id="teacher", timezone="Asia/Bangkok"),
                    Course(id="c2", title="Private", instructor_id="other", timezone="Asia/Bangkok")])
        db.flush()
        db.add(Enrollment(course_id="c1", student_id="student"))
        db.commit()
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine):
    with Session(engine) as db:
        yield db


@pytest.fixture
def chunk():
    return Chunk(id="c1-loop", course_id="c1", resource_id="r1", document_version="v1",
                 title="Vòng lặp", source_uri="local:loops", page=2, kind="syllabus",
                 text="Vòng lặp while tiếp tục khi điều kiện đúng.")


@pytest.fixture
def draft(chunk):
    return TutorDraft(statements=[{"text": "Vòng lặp while tiếp tục khi điều kiện đúng.",
                                  "evidence": [{"chunk_id": chunk.id, "quote": chunk.text}]}])


@pytest.fixture
def verdict():
    return Verdict(is_grounded=True, is_academic_compliant=True, is_in_scope=True)


@pytest.fixture
def request_body():
    return WorkflowRequest(mode="do", message="Giải thích vòng lặp while", week_start=date(2026, 11, 16))


class ScriptedLLM:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def generate(self, prompt, payload, schema):
        self.calls.append((prompt, payload, schema))
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        assert isinstance(result, schema)
        return result

    def close(self):
        pass


class FakeRetriever:
    def __init__(self, chunks):
        self.chunks = chunks

    def retrieve(self, course_id, question):
        return self.chunks

    def close(self):
        pass
