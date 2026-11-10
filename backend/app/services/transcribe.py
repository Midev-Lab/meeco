"""Transcription providers.

Live path: the browser streams audio straight to AssemblyAI over a WebSocket. We only mint a
short-lived token here, so the API key never reaches the client.
Safety path: batch-transcribe audio rebuilt from S3 chunks to fill whatever the stream missed.
"""
from __future__ import annotations

import io
import time
import wave
from typing import Protocol

import httpx

from ..ledger import Word


class TranscriptionError(RuntimeError):
    pass


class Transcriber(Protocol):
    def stream_config(self) -> dict: ...
    def mint_stream_token(self, max_session_seconds: int) -> dict: ...
    def transcribe_wav(self, wav_bytes: bytes) -> list[Word]: ...
    def transcribe_audio(self, data: bytes) -> list[Word]: ...  # WAV or Ogg/Opus bytes


def _stream_params(s) -> dict:
    params: dict = {"speech_model": s.stream_speech_model, "sample_rate": 16000, "encoding": "pcm_s16le"}
    if s.voice_focus in ("near-field", "far-field"):
        params["voice_focus"] = s.voice_focus
        params["voice_focus_threshold"] = s.voice_focus_threshold
    if s.stream_speech_model.startswith("universal-streaming"):
        params["format_turns"] = "true"  # only the older Universal Streaming models use it
    return params


class AssemblyAITranscriber:
    def __init__(self, settings, client: httpx.Client | None = None):
        if not settings.assemblyai_api_key:
            raise RuntimeError("TRANSCRIBER=assemblyai requires ASSEMBLYAI_API_KEY")
        self.s = settings
        self.http = client or httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0))
        self.headers = {"authorization": settings.assemblyai_api_key}  # no "Bearer" prefix

    def stream_config(self) -> dict:
        return {"url": self.s.assemblyai_stream_url, "params": _stream_params(self.s)}

    def mint_stream_token(self, max_session_seconds: int) -> dict:
        # expires_in_seconds = window to OPEN the socket (1-600). max_session_duration_seconds = how long it may run.
        r = self.http.get(
            self.s.assemblyai_token_url,
            headers=self.headers,
            params={"expires_in_seconds": 120, "max_session_duration_seconds": min(max(60, max_session_seconds), 10800)},
        )
        if r.status_code != 200:
            raise TranscriptionError(f"token request failed: {r.status_code} {r.text[:200]}")
        data = r.json()
        return {"token": data["token"], "expires_in": data.get("expires_in_seconds", 120)}

    def transcribe_audio(self, data: bytes) -> list[Word]:
        return self.transcribe_wav(data)  # the upload endpoint accepts any audio container

    def transcribe_wav(self, wav_bytes: bytes, timeout_s: int = 900) -> list[Word]:
        base = self.s.assemblyai_base_url
        up = self.http.post(f"{base}/v2/upload", headers=self.headers, content=wav_bytes)
        if up.status_code != 200:
            raise TranscriptionError(f"upload failed: {up.status_code} {up.text[:200]}")
        sub = self.http.post(f"{base}/v2/transcript", headers=self.headers, json={"audio_url": up.json()["upload_url"]})
        if sub.status_code != 200:
            raise TranscriptionError(f"submit failed: {sub.status_code} {sub.text[:200]}")
        tid = sub.json()["id"]

        deadline = time.monotonic() + timeout_s
        delay = 1.0
        while time.monotonic() < deadline:
            r = self.http.get(f"{base}/v2/transcript/{tid}", headers=self.headers)
            if r.status_code != 200:
                raise TranscriptionError(f"poll failed: {r.status_code} {r.text[:200]}")
            j = r.json()
            if j["status"] == "completed":
                words = [Word(w["text"], int(w["start"]), int(w["end"])) for w in (j.get("words") or [])]
                if not words and j.get("text"):
                    words = [Word(j["text"], 0, int((j.get("audio_duration") or 0) * 1000))]
                return words
            if j["status"] == "error":
                raise TranscriptionError(f"transcription error: {j.get('error')}")
            time.sleep(delay)
            delay = min(delay + 0.5, 3.0)
        raise TranscriptionError("transcription timed out")


class FakeTranscriber:
    """Development / test double. Streaming points at a local fake socket; batch returns marker words."""

    def __init__(self, settings):
        self.s = settings

    def stream_config(self) -> dict:
        return {"url": self.s.assemblyai_stream_url, "params": _stream_params(self.s)}

    def mint_stream_token(self, max_session_seconds: int) -> dict:
        return {"token": "fake-token", "expires_in": 120}

    def transcribe_audio(self, data: bytes) -> list[Word]:
        return self.transcribe_wav(data)

    def transcribe_wav(self, wav_bytes: bytes) -> list[Word]:
        if wav_bytes[:4] == b"OggS":
            from ..audio import ogg_duration_ms
            ms = ogg_duration_ms(wav_bytes)
        else:
            with wave.open(io.BytesIO(wav_bytes), "rb") as w:
                ms = int(w.getnframes() * 1000 / w.getframerate())
        # one marker word per ~800 ms so tests can check where repaired speech lands
        return [Word(f"recovered{i}", i * 800, min(ms, i * 800 + 600)) for i in range(max(1, ms // 800))]


def make_transcriber(settings) -> Transcriber:
    return AssemblyAITranscriber(settings) if settings.transcriber == "assemblyai" else FakeTranscriber(settings)
