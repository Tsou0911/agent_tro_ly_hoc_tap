from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from . import prompts
from .contracts import Chunk, PlanDraft, ReflectionDraft, TutorDraft, Verdict, WorkflowRequest, WorkflowResponse
from .guardrails import check_evidence, check_memory, check_plan, render, requests_completed_work
from .llm import ModelUnavailable
from .retrieval import RetrievalUnavailable

OUT_OF_SCOPE = "Nội dung này nằm ngoài phạm vi tài liệu môn học. Câu hỏi đã được chuyển đến giảng viên."
ACADEMIC_REFUSAL = ("Mình không thể làm hộ hoặc cung cấp bài nộp/lời giải hoàn chỉnh. "
                   "Bạn hãy nêu cách đã thử và bước đang vướng; mình có thể hỗ trợ bạn tự phân tích yêu cầu, "
                   "chia nhỏ vấn đề và kiểm tra cách suy nghĩ dựa trên tài liệu môn học.")
INSUFFICIENT = "Mình chưa có đủ căn cứ từ tài liệu môn học để trả lời đáng tin cậy. Bạn có thể nêu rõ phần tài liệu cần trao đổi."
UNAVAILABLE = "Hệ thống chưa thể truy xuất hoặc kiểm định câu trả lời. Vui lòng thử lại sau."


class LearningState(TypedDict, total=False):
    request: WorkflowRequest
    course_id: str
    student_id: str
    request_id: str
    course_timezone: str
    chunks: list[Chunk]
    assignments: list[dict]
    memory: list
    draft_response: TutorDraft | PlanDraft | ReflectionDraft
    validation: Verdict
    attempts: int
    feedback: list[str]
    error: bool
    result: WorkflowResponse


def build_graph(llm, retriever, repository, max_regenerations: int = 2):
    if not 0 <= max_regenerations <= 3:
        raise ValueError("max_regenerations must be between 0 and 3")

    def retrieve(state):
        req = state["request"]
        try:
            chunks = retriever.retrieve(state["course_id"], req.message)
            if any(c.course_id != state["course_id"] for c in chunks):
                raise RetrievalUnavailable("Course boundary mismatch")
            return {"chunks": chunks, "attempts": 0, "feedback": [], "error": False,
                    "assignments": repository.assignments(state["course_id"]),
                    "memory": repository.memories(state["course_id"], state["student_id"], req.week_start)
                    if req.mode == "plan" else []}
        except RetrievalUnavailable:
            return {"error": True}

    def route_retrieval(state):
        if state.get("error"):
            return "unavailable"
        if not state["chunks"]:
            if requests_completed_work(state["request"].message):
                return "academic_refusal"
            return "insufficient"
        return state["request"].mode

    def context(state):
        return {
            "request": state["request"].model_dump(mode="json"),
            "chunks": [c.model_dump() for c in state["chunks"]],
            "assignments": state["assignments"], "approved_memory": state["memory"],
            "course_timezone": state["course_timezone"], "feedback": state["feedback"],
        }

    def generator(prompt, schema):
        def generate(state):
            try:
                draft = llm.generate(prompt, context(state), schema)
                return {"draft_response": draft, "attempts": state["attempts"] + 1}
            except ModelUnavailable:
                return {"error": True}
        return generate

    def validate(state):
        if state.get("error"):
            return {}
        draft = state["draft_response"]
        req = state["request"]
        errors = check_evidence(draft, state["chunks"])
        if isinstance(draft, PlanDraft):
            errors += check_plan(draft, req.week_start, req.available_minutes,
                                 state["assignments"], state["course_timezone"])
        if isinstance(draft, ReflectionDraft):
            errors += check_memory(draft, req.message)
        try:
            verdict = llm.generate(prompts.VALIDATOR,
                {**context(state), "draft_response": draft.model_dump(mode="json")}, Verdict)
        except ModelUnavailable:
            return {"error": True}
        verdict = verdict.model_copy(update={
            "is_grounded": verdict.is_grounded and not errors,
            "is_academic_compliant": verdict.is_academic_compliant and not requests_completed_work(req.message),
        })
        if not verdict.is_grounded:
            errors.append("Rewrite all unsupported claims using only the supplied evidence")
        return {"validation": verdict, "feedback": errors}

    def route_validation(state):
        if state.get("error"):
            return "unavailable"
        verdict = state["validation"]
        if not verdict.is_in_scope:
            return "escalate"
        if not verdict.is_academic_compliant:
            return "academic_refusal"
        if not verdict.is_grounded:
            return state["request"].mode if state["attempts"] <= max_regenerations else "insufficient"
        return "publish"

    def escalate(state):
        # Commit before returning; DB failure propagates as 503, never a false success.
        id_ = repository.escalate(state["course_id"], state["student_id"],
                                  state["request_id"], state["request"].message)
        return {"result": WorkflowResponse(status="out_of_scope", response=OUT_OF_SCOPE, escalation_id=id_)}

    def publish(state):
        draft = state["draft_response"]
        text, citations = render(draft, state["chunks"])
        result = WorkflowResponse(status="ok", response=text, citations=citations)
        if isinstance(draft, PlanDraft):
            result.plan = draft  # Proposal only: does not silently create student tasks.
        if isinstance(draft, ReflectionDraft):
            result.reflection = draft
            if draft.memory:
                result.memory_id = repository.save_memory(state["course_id"], state["student_id"],
                    state["request"].week_start, [m.model_dump() for m in draft.memory])
        return {"result": result}

    def fixed(status, text):
        return lambda state: {"result": WorkflowResponse(status=status, response=text)}

    graph = StateGraph(LearningState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("plan", generator(prompts.PLANNER, PlanDraft))
    graph.add_node("do", generator(prompts.TUTOR, TutorDraft))
    graph.add_node("reflect", generator(prompts.REFLECTOR, ReflectionDraft))
    graph.add_node("validate", validate)
    graph.add_node("escalate", escalate)
    graph.add_node("publish", publish)
    graph.add_node("academic_refusal", fixed("academic_refusal", ACADEMIC_REFUSAL))
    graph.add_node("insufficient", fixed("insufficient_evidence", INSUFFICIENT))
    graph.add_node("unavailable", fixed("unavailable", UNAVAILABLE))
    graph.add_edge(START, "retrieve")
    graph.add_conditional_edges("retrieve", route_retrieval,
        {key: key for key in ("plan", "do", "reflect", "unavailable", "insufficient", "academic_refusal")})
    for name in ("plan", "do", "reflect"):
        graph.add_edge(name, "validate")
    graph.add_conditional_edges("validate", route_validation,
        {key: key for key in ("plan", "do", "reflect", "escalate", "academic_refusal", "insufficient", "publish", "unavailable")})
    for name in ("escalate", "academic_refusal", "insufficient", "publish", "unavailable"):
        graph.add_edge(name, END)
    return graph.compile()
