from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.audio import ms_to_bytes, pcm_to_wav
from app.config import Settings
from app.deps import Services
from app.main import create_app
from app.services.llm import FakeLLM
from app.services.sessions import SessionService
from app.services.storage import LocalStorage
from app.services.transcribe import FakeTranscriber

DEVICE = "dev_aaaaaaaaaaaaaaaa"


class SpyASR(FakeTranscriber):
    def __init__(self, s):
        super().__init__(s)
        self.calls: list[int] = []

    def transcribe_wav(self, wav_bytes):
        self.calls.append(len(wav_bytes))
        return super().transcribe_wav(wav_bytes)


class SpyLLM(FakeLLM):
    def __init__(self):
        self.title_calls = 0

    def title(self, head):
        self.title_calls += 1
        return super().title(head)


def wav_ms(ms: int) -> bytes:
    return pcm_to_wav(b"\x00" * ms_to_bytes(ms))


@pytest.fixture
def settings(tmp_path):
    # 2-second chunks keep the tests fast; the logic is identical to 30 s.
    return Settings(storage_backend="local", local_storage_dir=str(tmp_path / "store"), chunk_seconds=2, max_session_seconds=600)


@pytest.fixture
def env(settings):
    storage = LocalStorage(settings.local_storage_dir)
    asr, llm = SpyASR(settings), SpyLLM()
    svc = Services(storage=storage, sessions=SessionService(storage, asr, llm, settings))
    client = TestClient(create_app(settings, svc), headers={"X-Device-Id": DEVICE})
    return type("Env", (), {"client": client, "storage": storage, "asr": asr, "llm": llm, "settings": settings, "svc": svc})


def upload_chunk(env, sid, index, ms=2000):
    info = env.client.post(f"/v1/sessions/{sid}/chunks", json={"index": index}).json()
    r = env.client.put(info["url"], content=wav_ms(ms), headers=info["headers"])
    assert r.status_code == 200, r.text
    return info


def fake_ogg_ms(ms: int, pre_skip: int = 312) -> bytes:
    """Smallest thing ogg_duration_ms understands: an OpusHead and a final page whose granule says `ms`."""
    head = b"OggS" + bytes(22) + b"OpusHead" + bytes([1, 1]) + pre_skip.to_bytes(2, "little") + bytes(10)
    last = bytearray(b"OggS" + bytes(22))
    last[6:14] = (pre_skip + ms * 48).to_bytes(8, "little")
    return head + bytes(last)


def upload_ogg_chunk(env, sid, index, ms=2000):
    info = env.client.post(f"/v1/sessions/{sid}/chunks", json={"index": index}).json()
    r = env.client.put(info["url"], content=fake_ogg_ms(ms), headers=info["headers"])
    assert r.status_code == 200, r.text
    return info
