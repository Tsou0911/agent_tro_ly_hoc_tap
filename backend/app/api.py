from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import AwareDatetime, Field, StrictBool, StringConstraints, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
import jwt

from .auth import Principal, authorize, principal, session
from .contracts import Contract, WorkflowRequest, WorkflowResponse
from .kpi import calculate_kpis
from .models import InstructorEscalation, ReflectionMemory, StudyTask, now
from .repository import Repository
from .workflow import build_graph

router = APIRouter(prefix="/api")


class LoginInput(Contract):
    subject: str = Field(min_length=1, max_length=100)
    role: Literal["student", "instructor"]

    @field_validator("subject")
    @classmethod
    def nonblank_subject(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Subject must not be blank")
        return value


@router.post("/auth/login")
def login(body: LoginInput, request: Request):
    settings = request.app.state.settings
    secret = settings.jwt_secret.get_secret_value()
    if settings.app_env != "development" or len(secret) < 32:
        raise HTTPException(503, "Demo authentication is not configured")
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": body.subject,
            "role": body.role,
            "iat": now,
            "exp": now + timedelta(hours=2),
            "aud": "learning-companion",
            "iss": "learning-companion",
        },
        secret,
        algorithm="HS256",
    )
    return {"access_token": token, "token_type": "bearer", "subject": body.subject, "role": body.role}


@router.post("/courses/{course_id}/workflow", response_model=WorkflowResponse)
def workflow(course_id: str, body: WorkflowRequest, request: Request, response: Response,
             user: Principal = Depends(principal), db: Session = Depends(session)):
    course = authorize(db, user, course_id, "student")
    graph = build_graph(request.app.state.llm, request.app.state.retriever, Repository(db),
                        request.app.state.settings.max_regenerations)
    state = graph.invoke({"request": body, "course_id": course_id, "student_id": user.id,
                          "request_id": str(uuid4()), "course_timezone": course.timezone},
                         config={"recursion_limit": 32})
    result = state["result"]
    if result.status == "unavailable":
        response.status_code = 503
    return result


class MemoryApproval(Contract):
    approved: StrictBool


@router.put("/courses/{course_id}/memories/{memory_id}/approval")
def approve_memory(course_id: str, memory_id: str, body: MemoryApproval,
                   user: Principal = Depends(principal), db: Session = Depends(session)):
    authorize(db, user, course_id, "student")
    memory = db.get(ReflectionMemory, memory_id)
    if memory is None or memory.course_id != course_id or memory.student_id != user.id:
        raise HTTPException(404, "Memory not found")
    memory.approved_at = (memory.approved_at or now()) if body.approved else None
    db.commit()
    return {"id": memory.id, "approved": memory.approved_at is not None}


class TaskInput(Contract):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    day: date
    estimated_minutes: int = Field(strict=True, gt=0, le=1440)


class TaskStatus(Contract):
    status: Literal["todo", "in_progress", "done"]


class TaskResult(Contract):
    id: str
    title: str
    day: date
    estimated_minutes: int
    status: Literal["todo", "in_progress", "done"]


@router.post("/courses/{course_id}/tasks", status_code=201)
def create_task(course_id: str, body: TaskInput, user: Principal = Depends(principal),
                db: Session = Depends(session)):
    authorize(db, user, course_id, "student")
    task = StudyTask(course_id=course_id, student_id=user.id, **body.model_dump())
    db.add(task)
    db.commit()
    return {"id": task.id, "status": task.status}


@router.get(
    "/courses/{course_id}/tasks",
    response_model=list[TaskResult],
    responses={
        401: {"description": "Missing or invalid bearer token"},
        403: {"description": "Course access denied"},
        422: {"description": "Invalid or missing week_start"},
        503: {"description": "Database or authentication unavailable"},
    },
)
def list_tasks(
    course_id: str,
    week_start: Annotated[
        str,
        Query(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$", description="Week start in YYYY-MM-DD format"),
    ],
    user: Principal = Depends(principal),
    db: Session = Depends(session),
) -> list[TaskResult]:
    try:
        start = date.fromisoformat(week_start)
        end = start + timedelta(days=6)
    except (ValueError, OverflowError):
        raise HTTPException(422, "week_start must be a valid date in YYYY-MM-DD format")

    authorize(db, user, course_id, "student")
    rows = db.scalars(
        select(StudyTask)
        .where(
            StudyTask.course_id == course_id,
            StudyTask.student_id == user.id,
            StudyTask.day >= start,
            StudyTask.day <= end,
        )
        .order_by(StudyTask.day.asc(), StudyTask.id.asc())
    )
    return [
        TaskResult(
            id=row.id,
            title=row.title,
            day=row.day,
            estimated_minutes=row.estimated_minutes,
            status=row.status,
        )
        for row in rows
    ]


@router.patch("/courses/{course_id}/tasks/{task_id}")
def update_task(course_id: str, task_id: str, body: TaskStatus,
                user: Principal = Depends(principal), db: Session = Depends(session)):
    authorize(db, user, course_id, "student")
    task = db.get(StudyTask, task_id)
    if task is None or task.course_id != course_id or task.student_id != user.id:
        raise HTTPException(404, "Task not found")
    task.status = body.status
    task.completed_at = (task.completed_at or now()) if body.status == "done" else None
    db.commit()
    return {"id": task.id, "status": task.status}


@router.get("/instructor/courses/{course_id}/escalations")
def escalations(course_id: str, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                user: Principal = Depends(principal), db: Session = Depends(session)):
    authorize(db, user, course_id, "instructor")
    rows = db.scalars(select(InstructorEscalation).where(InstructorEscalation.course_id == course_id)
                      .order_by(InstructorEscalation.created_at.desc(), InstructorEscalation.id)
                      .offset(offset).limit(limit))
    return [{"id": row.id, "question": row.question, "reason": row.reason,
             "status": row.status, "created_at": row.created_at} for row in rows]


@router.get("/instructor/courses/{course_id}/kpis")
def kpis(course_id: str, start: AwareDatetime, end: AwareDatetime,
         user: Principal = Depends(principal), db: Session = Depends(session)):
    authorize(db, user, course_id, "instructor")
    if end <= start:
        raise HTTPException(422, "end must be after start")
    return calculate_kpis(db, course_id, start, end, datetime.now(timezone.utc))
