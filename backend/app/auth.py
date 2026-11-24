from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .models import Course, Enrollment

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    id: str
    role: str


def principal(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Principal:
    secret = request.app.state.settings.jwt_secret.get_secret_value()
    if len(secret) < 32:
        raise HTTPException(503, "Authentication is not configured")
    if credentials is None:
        raise HTTPException(401, "Bearer token required", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = jwt.decode(credentials.credentials, secret, algorithms=["HS256"],
                            audience="learning-companion", issuer="learning-companion",
                            options={"require": ["exp", "iat", "sub", "role", "aud", "iss"]})
        if claims["role"] not in ("student", "instructor") or not isinstance(claims["sub"], str) or not claims["sub"]:
            raise ValueError("Invalid identity")
        return Principal(claims["sub"], claims["role"])
    except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
        raise HTTPException(401, "Invalid token") from exc


def session(request: Request):
    with Session(request.app.state.engine) as db:
        yield db


def authorize(db: Session, user: Principal, course_id: str, role: str) -> Course:
    course = db.get(Course, course_id)
    allowed = course is not None and user.role == role
    if role == "instructor":
        allowed = allowed and course.instructor_id == user.id
    else:
        allowed = allowed and db.get(Enrollment, (course_id, user.id)) is not None
    if not allowed:
        raise HTTPException(403, "Course access denied")
    return course
