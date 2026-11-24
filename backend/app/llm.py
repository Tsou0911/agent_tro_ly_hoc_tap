import json
import logging
from typing import TypeVar

import httpx
from pydantic import BaseModel

from .config import DEFAULT_GEMINI_MODEL, Settings

T = TypeVar("T", bound=BaseModel)
logger = logging.getLogger(__name__)
GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"


class ModelUnavailable(RuntimeError):
    """Sanitized failure: never expose provider bodies, keys or draft responses."""


def _structured_schema(schema: dict) -> dict:
    # The Gemini decoder supports a subset of JSON Schema. Pydantic still enforces
    # all constraints (including string lengths and exclusive bounds) locally.
    schema = {key: value for key, value in schema.items()
              if key not in {"default", "minLength", "maxLength", "exclusiveMinimum"}}
    for key in ("properties", "$defs"):
        if key in schema:
            schema[key] = {name: _structured_schema(value) for name, value in schema[key].items()}
    if "items" in schema:
        schema["items"] = _structured_schema(schema["items"])
    if "anyOf" in schema:
        schema["anyOf"] = [_structured_schema(value) for value in schema["anyOf"]]
    return schema


def _answer_text(body: object) -> str:
    if not isinstance(body, dict) or "error" in body:
        raise ValueError("Invalid response envelope")
    feedback = body.get("promptFeedback", {})
    if not isinstance(feedback, dict) or feedback.get("blockReason") not in (None, "BLOCK_REASON_UNSPECIFIED"):
        raise ValueError("Prompt blocked or feedback invalid")
    candidates = body.get("candidates")
    if not isinstance(candidates, list) or len(candidates) != 1:
        raise ValueError("Expected one candidate")
    candidate = candidates[0]
    if candidate["finishReason"] != "STOP":
        raise ValueError("Incomplete or blocked candidate")
    parts = candidate["content"]["parts"]
    if not isinstance(parts, list):
        raise ValueError("Invalid content parts")
    text = []
    for part in parts:
        if not isinstance(part, dict):
            raise ValueError("Invalid content part")
        if part.get("thought") is True:
            continue
        if not isinstance(part.get("text"), str):
            raise ValueError("Expected a text part")
        text.append(part["text"])
    return "".join(text)


class Gemini:
    def __init__(self, settings: Settings, client: httpx.Client | None = None):
        self.settings = settings
        self.client = client or httpx.Client(timeout=settings.llm_timeout_seconds)

    def close(self):
        self.client.close()

    def generate(self, prompt: str, payload: dict, schema: type[T]) -> T:
        key = self.settings.gemini_api_key.get_secret_value().strip()
        model = self.settings.gemini_model.strip()
        if not key:
            problem = "GEMINI_API_KEY is not configured"
        elif not model:
            problem = "GEMINI_MODEL is not configured"
        elif model != DEFAULT_GEMINI_MODEL:
            problem = f"GEMINI_MODEL must be {DEFAULT_GEMINI_MODEL}"
        else:
            problem = None
        if problem:
            logger.warning("%s", problem)
            raise ModelUnavailable(problem)

        try:
            response = self.client.post(
                f"{GEMINI_MODELS_URL}/{model}:generateContent",
                headers={"x-goog-api-key": key},
                follow_redirects=False,
                json={
                    "systemInstruction": {"parts": [{"text": prompt}]},
                    "contents": [{"role": "user", "parts": [
                        {"text": json.dumps(payload, ensure_ascii=False, default=str)},
                    ]}],
                    "generationConfig": {
                        "candidateCount": 1,
                        "maxOutputTokens": 3000,
                        "responseMimeType": "application/json",
                        "responseJsonSchema": _structured_schema(schema.model_json_schema()),
                    },
                },
            )
            response.raise_for_status()
            return schema.model_validate_json(_answer_text(response.json()))
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise ModelUnavailable("Gemini unavailable or invalid structured output") from None
