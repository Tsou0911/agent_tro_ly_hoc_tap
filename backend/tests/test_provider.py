import json
import traceback

import httpx
import pytest

from backend.app.config import Settings
from backend.app.contracts import PlanDraft, ReflectionDraft, TutorDraft, Verdict
from backend.app.llm import Gemini, ModelUnavailable


FAKE_KEY = "mock-gemini-key"
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"


def settings(*, gemini_api_key=FAKE_KEY, **kwargs):
    return Settings(_env_file=None, database_url="postgresql+pg8000://x:x@localhost/test",
                    gemini_api_key=gemini_api_key, **kwargs)


def completion(*parts, finish_reason="STOP"):
    return {"candidates": [{"finishReason": finish_reason, "content": {"role": "model", "parts": list(parts)}}]}


def test_reads_gemini_environment_variables(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", FAKE_KEY)
    monkeypatch.setenv("GEMINI_MODEL", "")
    config = Settings(_env_file=None, database_url="postgresql+pg8000://x:x@localhost/test")
    assert config.gemini_api_key.get_secret_value() == FAKE_KEY
    assert config.gemini_model == ""
    assert FAKE_KEY not in repr(config)


@pytest.mark.parametrize("schema", [Verdict, TutorDraft, PlanDraft, ReflectionDraft], ids=lambda schema: schema.__name__)
def test_provider_requests_and_validates_each_workflow_schema(schema, draft, verdict):
    statement = draft.statements[0].model_dump()
    expected = {
        Verdict: verdict,
        TutorDraft: draft,
        PlanDraft: PlanDraft(tasks=[{**statement, "day": "2026-11-16", "minutes": 20, "assignment_id": None}]),
        ReflectionDraft: ReflectionDraft(questions=[statement], memory=[]),
    }[schema]
    payload = {"message": "Luyện tiếng Anh", "attempt": 1}

    def handler(request):
        assert request.method == "POST"
        assert request.url == ENDPOINT
        assert request.headers["x-goog-api-key"] == FAKE_KEY
        assert request.headers["Content-Type"] == "application/json"
        assert "Authorization" not in request.headers
        assert FAKE_KEY not in request.content.decode()
        body = json.loads(request.content)
        assert set(body) == {"systemInstruction", "contents", "generationConfig"}
        assert body["systemInstruction"] == {"parts": [{"text": "Follow the learning policy"}]}
        assert body["contents"] == [{"role": "user", "parts": [{"text": json.dumps(payload, ensure_ascii=False)}]}]
        config = body["generationConfig"]
        assert config["responseMimeType"] == "application/json"
        assert config["maxOutputTokens"] == 3000
        assert config["candidateCount"] == 1
        assert "responseSchema" not in config
        response_schema = config["responseJsonSchema"]
        assert response_schema["type"] == "object"
        assert response_schema["required"] == schema.model_json_schema()["required"]
        assert response_schema["additionalProperties"] is False
        assert set(response_schema["properties"]) == set(schema.model_json_schema()["properties"])
        if schema is Verdict:
            assert all(prop["type"] == "boolean" for prop in response_schema["properties"].values())
        else:
            quote_schema = response_schema["$defs"]["Evidence"]["properties"]["quote"]
            assert quote_schema["type"] == "string"
            assert "minLength" not in quote_schema
            assert "maxLength" not in quote_schema
        if schema is PlanDraft:
            properties = response_schema["$defs"]["PlanItem"]["properties"]
            assert response_schema["properties"]["tasks"]["items"] == {"$ref": "#/$defs/PlanItem"}
            assert properties["day"]["format"] == "date"
            assert properties["minutes"]["maximum"] == 480
            assert "exclusiveMinimum" not in properties["minutes"]
            assert properties["assignment_id"]["anyOf"] == [{"type": "string"}, {"type": "null"}]
            assert "default" not in properties["assignment_id"]
        text = expected.model_dump_json()
        return httpx.Response(200, json=completion(
            {"text": "private thought summary", "thought": True}, {"text": text[:10]}, {"text": text[10:]},
        ))

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert Gemini(settings(), client).generate("Follow the learning policy", payload, schema) == expected


@pytest.mark.parametrize("content", [
    '{"is_grounded":"false","is_academic_compliant":true,"is_in_scope":true}',
    '{"is_grounded":true}',
    '{"is_grounded":true,"is_academic_compliant":true,"is_in_scope":true,"extra":true}',
    "```json\n{}\n```",
    "garbage",
])
def test_invalid_validator_json_fails_closed(content):
    def handler(request):
        return httpx.Response(200, json=completion({"text": content}))

    with httpx.Client(transport=httpx.MockTransport(handler)) as client, pytest.raises(ModelUnavailable):
        Gemini(settings(), client).generate("validate", {}, Verdict)


def test_preserves_local_validation_of_constraints_omitted_from_gemini_schema(draft):
    task = {**draft.statements[0].model_dump(), "day": "2026-11-16", "minutes": 0}
    body = completion({"text": json.dumps({"tasks": [task]})})
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))) as client:
        with pytest.raises(ModelUnavailable):
            Gemini(settings(), client).generate("plan", {}, PlanDraft)


@pytest.mark.parametrize("body", [
    {"promptFeedback": {"blockReason": "SAFETY"}},
    {"candidates": []},
    {"candidates": [None]},
    {"candidates": [{"content": {"parts": [{"text": "{}"}]}}]},
    completion(),
    completion({"functionCall": {"name": "unexpected_tool"}}),
])
def test_missing_or_malformed_content_fails_closed(body):
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))) as client:
        with pytest.raises(ModelUnavailable):
            Gemini(settings(), client).generate("validate", {}, Verdict)


@pytest.mark.parametrize("finish_reason,thought", [("MAX_TOKENS", False), ("SAFETY", False), ("STOP", True)])
def test_blocks_incomplete_filtered_or_thought_only_candidates_even_with_valid_json(finish_reason, thought, verdict):
    body = completion({"thought": thought, "text": verdict.model_dump_json()}, finish_reason=finish_reason)
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))) as client:
        with pytest.raises(ModelUnavailable):
            Gemini(settings(), client).generate("validate", {}, Verdict)


def test_invalid_http_body_fails_closed():
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, text="<html>"))) as client:
        with pytest.raises(ModelUnavailable, match="Gemini unavailable"):
            Gemini(settings(), client).generate("validate", {}, Verdict)


@pytest.mark.parametrize("code", [302, 400, 403, 404, 429, 500, 503])
def test_http_failure_is_sanitized_and_never_retried_or_redirected(code):
    requests = []

    def handler(request):
        requests.append(request.url)
        return httpx.Response(code, headers={"Location": "https://example.invalid/"}, text=f"private error {FAKE_KEY}")

    with httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True) as client:
        with pytest.raises(ModelUnavailable, match="Gemini unavailable") as exc:
            Gemini(settings(), client).generate("validate", {}, Verdict)
    rendered = "".join(traceback.format_exception(exc.value))
    assert "private error" not in rendered
    assert FAKE_KEY not in rendered
    assert requests == [ENDPOINT]


def test_timeout_is_sanitized_without_retry():
    requests = []

    def handler(request):
        requests.append(request.url)
        raise httpx.ReadTimeout(f"private timeout {FAKE_KEY}", request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ModelUnavailable, match="Gemini unavailable") as exc:
            Gemini(settings(), client).generate("validate", {}, Verdict)
    assert "private timeout" not in "".join(traceback.format_exception(exc.value))
    assert requests == [ENDPOINT]


@pytest.mark.parametrize("config,error", [
    ({"gemini_api_key": " "}, "GEMINI_API_KEY is not configured"),
    ({"gemini_model": ""}, "GEMINI_MODEL is not configured"),
    ({"gemini_model": "gemini-4-argon"}, "GEMINI_MODEL must be gemini-3.5-flash-lite"),
    ({"gemini_model": "gemini-flash-latest"}, "GEMINI_MODEL must be gemini-3.5-flash-lite"),
])
def test_invalid_configuration_never_sends_request(config, error, caplog):
    def handler(request):
        pytest.fail("Invalid configuration must not make an HTTP request")

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ModelUnavailable) as exc:
            Gemini(settings(**config), client).generate("validate", {}, Verdict)
    assert str(exc.value) == error
    assert error in caplog.messages
    assert FAKE_KEY not in caplog.text
