from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from .config import Settings
from .api import router
from .llm import Gemini
from .retrieval import Retriever


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    engine = create_engine(
        str(settings.database_url),
        pool_pre_ping=True,
        pool_timeout=3,
        connect_args={"timeout": 3},
    )
    app.state.engine = engine
    app.state.settings = settings
    llm = Gemini(settings)
    retriever = Retriever(settings)
    app.state.llm = llm
    app.state.retriever = retriever
    try:
        yield
    finally:
        llm.close()
        retriever.close()
        engine.dispose()


app = FastAPI(
    title="AI Learning Companion",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    return JSONResponse(status_code=503, content={"detail": "Database operation unavailable"})


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["connected", "unavailable"]


@app.get(
    "/health",
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse, "description": "Database unavailable"}},
)
def health(request: Request, response: Response) -> HealthResponse:
    try:
        with request.app.state.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = 503
        return HealthResponse(status="degraded", database="unavailable")

    return HealthResponse(status="ok", database="connected") 
