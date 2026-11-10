from __future__ import annotations

from pydantic import BaseModel, Field


class TurnIn(BaseModel):
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)
    text: str = Field(max_length=50_000)


class Checkpoint(BaseModel):
    """What the browser knows: how long the recording is, which stretches the stream owns, its turns."""

    duration_ms: int = Field(ge=0, le=12_000_000)
    owned: list[list[int]] = Field(default_factory=list, max_length=2000)
    turns: list[TurnIn] = Field(default_factory=list, max_length=20_000)


class CreateSession(BaseModel):
    chunk_seconds: int | None = Field(default=None, ge=1, le=600)  # clamped to 2-120 by the service
    chunk_format: str = Field(default="wav", pattern="^(wav|ogg)$")  # backup chunks: raw WAV, or ~16x smaller Ogg/Opus


class ChunkRequest(BaseModel):
    index: int = Field(ge=0)
    format: str | None = Field(default=None, pattern="^(wav|ogg)$")  # per chunk; defaults to the session's format


class ActionItem(BaseModel):
    id: str
    text: str = Field(max_length=2000)
    done: bool = False


class ActionItemsIn(BaseModel):
    items: list[ActionItem] = Field(max_length=100)
