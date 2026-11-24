import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from .contracts import Chunk, Citation, PlanDraft, ReflectionDraft, Statement, TutorDraft


def normalize(text: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", text).split())


def requests_completed_work(text: str) -> bool:
    folded = unicodedata.normalize("NFKD", text.lower().replace("đ", "d"))
    folded = "".join(c for c in folded if not unicodedata.combining(c))
    patterns = (
        r"\b(lam|giai|viet|code)\s+ho\b",
        r"\b(lam|giai|viet|code)\s+giup\b.{0,40}\b(bai tap|bai nop|assignment|homework)\b",
        r"\b(giai|viet|code)\b.{0,60}\b(toan bo|hoan chinh|tron ven|a\s*[-–]\s*z)\b",
        r"\b(do|solve|write|complete)\b.{0,60}\b(my homework|my assignment|entire assignment|full solution)\b",
        r"\b(write|complete)\s+(?:my|the)\s+(?:(?:graded|english|entire)\s+)+(?:essay|assignment|report)\s+(?:for me|to submit)\b",
        r"\b(full|complete|final)\s+(code|solution|answer)\b",
        r"\b(chi|dua|cho)\b.{0,25}\b(dap an cuoi|bai nop hoan chinh)\b",
    )
    return any(re.search(p, folded, re.DOTALL) for p in patterns)


def statements(draft) -> list[Statement]:
    if isinstance(draft, TutorDraft):
        return draft.statements
    if isinstance(draft, PlanDraft):
        return draft.tasks
    return draft.questions


def check_evidence(draft, chunks: list[Chunk]) -> list[str]:
    """Validate provenance; semantic entailment remains the Validator's job."""
    errors = []
    sources = {c.id: c for c in chunks}
    if not statements(draft):
        errors.append("No supported statements")
    for statement in statements(draft):
        # The server owns citation syntax and source metadata.
        if re.search(r"\[[^\]]+\]|https?://", statement.text):
            errors.append("Use evidence fields, not inline citations or URLs")
        for evidence in statement.evidence:
            source = sources.get(evidence.chunk_id)
            quote = normalize(evidence.quote)
            if source is None or not quote or quote not in normalize(source.text):
                errors.append("Unknown source or quote not found in source")
    return errors


def check_plan(draft: PlanDraft, week_start: date, availability: dict[date, int],
               assignments: list[dict], course_timezone: str) -> list[str]:
    used = defaultdict(int)
    deadlines = {a["id"]: datetime.fromisoformat(a["due_at"]) for a in assignments}
    errors = []
    for task in draft.tasks:
        used[task.day] += task.minutes
        if task.day not in availability or not 0 <= (task.day - week_start).days < 7:
            errors.append("Task outside available week")
        if task.assignment_id is not None:
            due = deadlines.get(task.assignment_id)
            if due is None:
                errors.append("Unknown assignment")
            else:
                due = due.replace(tzinfo=timezone.utc) if due.tzinfo is None else due
                if task.day > due.astimezone(ZoneInfo(course_timezone)).date():
                    errors.append("Task after assignment deadline")
    if any(minutes > availability.get(day, 0) for day, minutes in used.items()):
        errors.append("Daily time budget exceeded")
    return errors


def check_memory(draft: ReflectionDraft, message: str) -> list[str]:
    return ["Memory quote not found in student message" for item in draft.memory
            if not normalize(item.student_quote) or normalize(item.student_quote) not in normalize(message)]


def render(draft, chunks: list[Chunk]) -> tuple[str, list[Citation]]:
    sources = {c.id: c for c in chunks}
    cited = {}
    lines = []
    for statement in statements(draft):
        ids = list(dict.fromkeys(e.chunk_id for e in statement.evidence))
        lines.append(statement.text + " " + " ".join(f"[{id_}]" for id_ in ids))
        for id_ in ids:
            chunk = sources[id_]
            cited[id_] = Citation(chunk_id=id_, **chunk.model_dump(include={
                "title", "resource_id", "document_version", "page", "source_uri"}))
    return "\n\n".join(lines), list(cited.values())
