from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .deps import Services
from .routes import misc, sessions
from .services.llm import make_llm
from .services.sessions import SessionService
from .services.storage import make_storage
from .services.transcribe import make_transcriber

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(settings: Settings | None = None, services: Services | None = None) -> FastAPI:
    s = settings or get_settings()
    app = FastAPI(title="meeco api", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.origins,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Device-Id"],
        max_age=600,
    )

    if services is None:
        storage = make_storage(s)
        services = Services(storage=storage, sessions=SessionService(storage, make_transcriber(s), make_llm(s), s))
    app.state.services = services

    app.include_router(sessions.router)
    if s.storage_backend == "local":
        app.include_router(misc.router)
    else:
        app.add_api_route("/health", misc.health, methods=["GET"])
    return app


app = create_app() if __name__ != "__main__" else None  # `uvicorn app.main:app`
