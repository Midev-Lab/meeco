from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from ..deps import Services, services

router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True}


@router.put("/v1/_local/blob/{key:path}")
async def local_blob(key: str, request: Request, svc: Services = Depends(services)):
    """Stands in for an S3 presigned PUT during local development. Mounted only with STORAGE_BACKEND=local."""
    if not key.startswith("audio/") or ".." in key:
        raise HTTPException(400, "invalid key")
    data = await request.body()
    if len(data) > 8_000_000:
        raise HTTPException(413, "chunk too large")
    svc.storage.put(key, data, request.headers.get("content-type", "audio/wav"))
    return {"ok": True}
