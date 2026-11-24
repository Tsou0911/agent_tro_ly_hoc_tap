"""Local administration only; run from the repository root."""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from .config import Settings
from .contracts import Chunk
from .models import Base, Course, Enrollment
from .retrieval import Retriever


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-db", help="Create missing tables; does not migrate existing tables")
    commands.add_parser("seed-demo", help="Create synthetic demo course and enrollment")
    token = commands.add_parser("token", help="Issue a local development identity token")
    token.add_argument("subject")
    token.add_argument("role", choices=["student", "instructor"])
    ingest = commands.add_parser("ingest", help="Index trusted JSON chunks; no paid embedding API")
    ingest.add_argument("path", type=Path)
    args = parser.parse_args()
    settings = Settings()
    if args.command == "token":
        secret = settings.jwt_secret.get_secret_value()
        if settings.app_env != "development" or len(secret) < 32:
            parser.error("Token command requires APP_ENV=development and JWT_SECRET of 32+ characters")
        now = datetime.now(timezone.utc)
        print(jwt.encode({"sub": args.subject, "role": args.role, "iat": now,
                          "exp": now + timedelta(hours=2), "aud": "learning-companion",
                          "iss": "learning-companion"}, secret, algorithm="HS256"))
        return
    if args.command == "ingest":
        chunks = [Chunk.model_validate(c) for c in json.loads(args.path.read_text(encoding="utf-8"))]
        retriever = Retriever(settings)
        try:
            retriever.ingest(chunks)
        finally:
            retriever.close()
        print(f"Indexed {len(chunks)} chunks")
        return
    engine = create_engine(str(settings.database_url))
    try:
        if args.command == "init-db":
            Base.metadata.create_all(engine)
        else:
            with Session(engine) as db:
                if db.get(Course, "english101") is None:
                    db.add(Course(id="english101", title="Tự học tiếng Anh", instructor_id="instructor-demo"))
                    db.flush()
                if db.get(Enrollment, ("english101", "student-demo")) is None:
                    db.add(Enrollment(course_id="english101", student_id="student-demo"))
                db.commit()
        print("Database setup complete")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
