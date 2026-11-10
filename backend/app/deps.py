from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import Header, HTTPException, Request

from .services.sessions import SessionService
from .services.storage import Storage

DEVICE_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")


@dataclass
class Services:
    storage: Storage
    sessions: SessionService


def services(request: Request) -> Services:
    return request.app.state.services


def device_id(x_device_id: str = Header(default="")) -> str:
    """Anonymous device id until sign-in exists. Scopes every storage key; it is NOT authentication."""
    if not DEVICE_RE.match(x_device_id):
        raise HTTPException(400, "missing or invalid X-Device-Id header")
    return x_device_id
