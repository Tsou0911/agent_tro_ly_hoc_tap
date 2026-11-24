from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Chunk(Contract):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,100}$")
    course_id: str
    resource_id: str
    document_version: str
    title: str
    source_uri: str
    page: int = Field(ge=1)
    kind: Literal["syllabus", "material"] = "material"
    text: str = Field(min_length=1, max_length=8000)


class Evidence(Contract):
    chunk_id: str
    quote: str = Field(min_length=1, max_length=2000)


class Statement(Contract):
    text: str = Field(min_length=1, max_length=2000)
    evidence: list[Evidence] = Field(min_length=1, max_length=6)


class TutorDraft(Contract):
    statements: list[Statement] = Field(max_length=12)


class Verdict(Contract):
    is_grounded: StrictBool
    is_academic_compliant: StrictBool
    is_in_scope: StrictBool


class PlanItem(Statement):
    day: date
    minutes: int = Field(strict=True, gt=0, le=480)
    assignment_id: str | None = None


class PlanDraft(Contract):
    tasks: list[PlanItem] = Field(min_length=1, max_length=35)


class MemoryItem(Contract):
    observation: str = Field(min_length=1, max_length=1000)
    student_quote: str = Field(min_length=1, max_length=1000)


class ReflectionDraft(Contract):
    questions: list[Statement] = Field(min_length=1, max_length=5)
    memory: list[MemoryItem] = Field(max_length=10)


class WorkflowRequest(Contract):
    mode: Literal["plan", "do", "reflect"]
    message: str = Field(min_length=1, max_length=6000)
    week_start: date
    available_minutes: dict[date, Annotated[int, Field(strict=True, ge=0, le=1440)]] = Field(
        default_factory=dict, max_length=7
    )

    @model_validator(mode="after")
    def valid_week(self):
        if not self.message.strip():
            raise ValueError("Message must not be blank")
        if self.mode == "plan" and not any(self.available_minutes.values()):
            raise ValueError("Planner requires positive daily availability")
        if any(not 0 <= (day - self.week_start).days < 7 for day in self.available_minutes):
            raise ValueError("Availability must be within the requested week")
        return self


class Citation(Contract):
    chunk_id: str
    title: str
    resource_id: str
    document_version: str
    page: int
    source_uri: str


class WorkflowResponse(Contract):
    status: Literal["ok", "out_of_scope", "academic_refusal", "insufficient_evidence", "unavailable"]
    response: str
    citations: list[Citation] = Field(default_factory=list)
    plan: PlanDraft | None = None
    reflection: ReflectionDraft | None = None
    memory_id: str | None = None
    escalation_id: str | None = None
