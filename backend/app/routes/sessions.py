from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from ..deps import Services, device_id, services
from ..models import ActionItemsIn, Checkpoint, ChunkRequest, CreateSession
from ..services.llm import LLMError
from ..services.sessions import FinalizeError, NotFound
from ..services.transcribe import TranscriptionError

router = APIRouter(prefix="/v1")


def _guard(fn, *a, **k):
    try:
        return fn(*a, **k)
    except NotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except (TranscriptionError, LLMError, FinalizeError) as exc:
        raise HTTPException(502, str(exc)) from exc


@router.post("/sessions")
def create_session(body: CreateSession | None = None, d: str = Depends(device_id), svc: Services = Depends(services)):
    return _guard(svc.sessions.create, d, body.chunk_seconds if body else None, body.chunk_format if body else "wav")


@router.post("/sessions/{sid}/stream-token")
def refresh_stream_token(sid: str, d: str = Depends(device_id), svc: Services = Depends(services)):
    """A fresh token for reconnecting the live stream after a drop."""
    return _guard(svc.sessions.stream_token, d, sid)


@router.post("/sessions/{sid}/chunks")
def chunk_url(sid: str, body: ChunkRequest, request: Request, d: str = Depends(device_id), svc: Services = Depends(services)):
    return _guard(svc.sessions.chunk_url, d, sid, body.index, str(request.base_url), body.format)


@router.put("/sessions/{sid}/checkpoint")
def checkpoint(sid: str, body: Checkpoint, bg: BackgroundTasks, d: str = Depends(device_id), svc: Services = Depends(services)):
    want_title = _guard(svc.sessions.save_checkpoint, d, sid, body)
    if want_title:
        bg.add_task(svc.sessions.maybe_title, d, sid)
    return {"ok": True}


@router.post("/sessions/{sid}/finalize")
def finalize(sid: str, body: Checkpoint | None = None, d: str = Depends(device_id), svc: Services = Depends(services)):
    return _guard(svc.sessions.finalize, d, sid, body)


@router.get("/sessions")
def list_sessions(d: str = Depends(device_id), svc: Services = Depends(services)):
    return {"items": svc.sessions.list(d)}


@router.get("/sessions/{sid}")
def get_session(sid: str, d: str = Depends(device_id), svc: Services = Depends(services)):
    return _guard(svc.sessions.get, d, sid)


@router.delete("/sessions/{sid}")
def delete_session(sid: str, d: str = Depends(device_id), svc: Services = Depends(services)):
    _guard(svc.sessions.delete, d, sid)
    return {"ok": True}


@router.post("/sessions/{sid}/summary")
def summary(sid: str, refresh: bool = False, d: str = Depends(device_id), svc: Services = Depends(services)):
    return _guard(svc.sessions.summary, d, sid, refresh)


@router.post("/sessions/{sid}/action-items")
def action_items(sid: str, refresh: bool = False, d: str = Depends(device_id), svc: Services = Depends(services)):
    return {"items": _guard(svc.sessions.action_items, d, sid, refresh)}


@router.put("/sessions/{sid}/action-items")
def put_action_items(sid: str, body: ActionItemsIn, d: str = Depends(device_id), svc: Services = Depends(services)):
    return {"items": _guard(svc.sessions.set_action_items, d, sid, [i.model_dump() for i in body.items])}
