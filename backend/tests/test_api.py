from __future__ import annotations

import pytest

from .conftest import DEVICE, upload_chunk, wav_ms


def new_session(env):
    r = env.client.post("/v1/sessions")
    assert r.status_code == 200, r.text
    return r.json()


def long_text(n=260):
    return " ".join(f"word{i}" for i in range(n)) + "."


def test_device_header_required(env):
    r = env.client.post("/v1/sessions", headers={"X-Device-Id": ""})
    assert r.status_code == 400


def test_create_returns_stream_config_without_exposing_api_key(env):
    s = new_session(env)
    assert len(s["session_id"]) == 32
    st = s["stream"]
    assert st["token"] == "fake-token" and st["params"]["sample_rate"] == 16000 and st["params"]["encoding"] == "pcm_s16le"
    assert st["params"]["voice_focus"] == "near-field"
    assert "api_key" not in str(s).lower()
    assert env.client.post(f"/v1/sessions/{s['session_id']}/stream-token").json()["token"] == "fake-token"


def test_unknown_session_and_other_device_get_404(env):
    sid = new_session(env)["session_id"]
    assert env.client.post(f"/v1/sessions/{'0' * 32}/stream-token").status_code == 404
    assert env.client.post(f"/v1/sessions/{sid}/stream-token", headers={"X-Device-Id": "other_device_000000"}).status_code == 404


def test_chunk_upload_roundtrip_and_index_limit(env):
    sid = new_session(env)["session_id"]
    info = upload_chunk(env, sid, 3)
    assert info["start_ms"] == 6000
    assert env.storage.get(f"audio/{DEVICE}/{sid}/00003.wav") is not None
    assert env.client.post(f"/v1/sessions/{sid}/chunks", json={"index": 99999}).status_code == 400
    assert env.client.put("/v1/_local/blob/transcripts/x.json", content=b"x").status_code == 400  # only audio/ is writable


def test_happy_path_needs_no_batch_and_reuses_early_title(env):
    sid = new_session(env)["session_id"]
    turns = [{"start_ms": 0, "end_ms": 3000, "text": long_text()}, {"start_ms": 4000, "end_ms": 6000, "text": "That is all."}]
    cp = {"duration_ms": 6000, "owned": [[0, 6000]], "turns": turns}
    assert env.client.put(f"/v1/sessions/{sid}/checkpoint", json=cp).status_code == 200   # background task generates the title
    assert env.llm.title_calls == 1
    for i in range(3):
        upload_chunk(env, sid, i)
    r = env.client.post(f"/v1/sessions/{sid}/finalize", json=cp)
    assert r.status_code == 200, r.text
    out = r.json()
    assert env.asr.calls == []                 # fast path covered everything: no batch job
    assert env.llm.title_calls == 1            # title was ready before the user stopped: finalize added no model call
    assert out["title"].startswith("word0 word1") and out["transcript"].endswith("That is all.")
    assert out["warnings"] == [] and out["recovered_ms"] == 0
    assert env.client.post(f"/v1/sessions/{sid}/finalize").json()["id"] == sid            # idempotent retry


def test_stream_drop_is_repaired_from_s3_chunks(env):
    """Stream owned 0-3 s, dropped, never came back. Chunks cover 0-6 s. 3-6 s must be recovered."""
    sid = new_session(env)["session_id"]
    for i in range(3):
        upload_chunk(env, sid, i)
    cp = {"duration_ms": 6000, "owned": [[0, 3000]], "turns": [{"start_ms": 200, "end_ms": 2800, "text": "hello from the stream"}]}
    out = env.client.post(f"/v1/sessions/{sid}/finalize", json=cp).json()
    assert len(env.asr.calls) == 1
    texts = [t["text"] for t in out["turns"]]
    assert texts[0] == "hello from the stream" and "recovered" in texts[1]
    batch = [t for t in out["turns"] if t["source"] == "batch"][0]
    assert batch["start_ms"] >= 3000                              # repaired speech sits after the drop, not before
    assert out["recovered_ms"] == 3000 and out["warnings"] == []
    assert out["transcript"].startswith("hello from the stream recovered")


def test_crash_recovery_with_no_checkpoint_transcribes_everything(env):
    sid = new_session(env)["session_id"]
    for i in range(2):
        upload_chunk(env, sid, i)
    out = env.client.post(f"/v1/sessions/{sid}/finalize").json()          # browser died: no body, no checkpoint
    assert out["duration_ms"] == 4000 and out["recovered_ms"] == 4000 and "recovered" in out["transcript"]


def test_checkpoint_survives_for_crash_recovery(env):
    sid = new_session(env)["session_id"]
    for i in range(2):
        upload_chunk(env, sid, i)
    env.client.put(f"/v1/sessions/{sid}/checkpoint", json={"duration_ms": 4000, "owned": [[0, 2000]], "turns": [{"start_ms": 100, "end_ms": 1900, "text": "saved earlier"}]})
    out = env.client.post(f"/v1/sessions/{sid}/finalize").json()           # no body: uses the stored checkpoint
    assert out["transcript"].startswith("saved earlier recovered")


def test_missing_chunk_is_reported_not_hidden(env):
    sid = new_session(env)["session_id"]
    upload_chunk(env, sid, 0)
    upload_chunk(env, sid, 2)                                              # chunk 1 (2-4 s) never arrived
    out = env.client.post(f"/v1/sessions/{sid}/finalize", json={"duration_ms": 6000, "owned": [], "turns": []}).json()
    assert any("2s to 4s" in w for w in out["warnings"])


def test_nothing_recoverable_is_an_error_so_the_client_can_retry(env):
    sid = new_session(env)["session_id"]
    from app.services.transcribe import TranscriptionError

    def boom(_):
        raise TranscriptionError("asr down")

    env.asr.transcribe_wav = boom
    upload_chunk(env, sid, 0)
    r = env.client.post(f"/v1/sessions/{sid}/finalize", json={"duration_ms": 2000, "owned": [], "turns": []})
    assert r.status_code == 502
    assert env.client.get(f"/v1/sessions/{sid}").status_code == 404        # nothing half-saved


def test_history_summary_actions_delete(env):
    sid = new_session(env)["session_id"]
    text = "We need to send the report on Friday. The launch is on track. Sarah will update the pricing page tomorrow."
    cp = {"duration_ms": 5000, "owned": [[0, 5000]], "turns": [{"start_ms": 0, "end_ms": 5000, "text": text}]}
    env.client.post(f"/v1/sessions/{sid}/finalize", json=cp)

    rows = env.client.get("/v1/sessions").json()["items"]
    assert [r["id"] for r in rows] == [sid] and rows[0]["has_summary"] is False
    assert env.client.get("/v1/sessions", headers={"X-Device-Id": "other_device_000000"}).json()["items"] == []

    s = env.client.post(f"/v1/sessions/{sid}/summary").json()
    assert s["overview"] and env.client.get(f"/v1/sessions/{sid}").json()["summary"] == s       # cached on the result
    items = env.client.post(f"/v1/sessions/{sid}/action-items").json()["items"]
    assert len(items) == 2 and items[0]["done"] is False
    items[0]["done"] = True
    assert env.client.put(f"/v1/sessions/{sid}/action-items", json={"items": items}).json()["items"][0]["done"] is True
    assert env.client.get("/v1/sessions").json()["items"][0]["has_actions"] is True

    assert env.client.delete(f"/v1/sessions/{sid}").status_code == 200
    assert env.client.get(f"/v1/sessions/{sid}").status_code == 404
    assert env.client.get("/v1/sessions").json()["items"] == []


def test_client_chooses_chunk_length_and_server_remembers_it(env):
    s = env.client.post("/v1/sessions", json={"chunk_seconds": 30}).json()
    assert s["chunk_seconds"] == 30
    assert env.client.post(f"/v1/sessions/{s['session_id']}/chunks", json={"index": 4}).json()["start_ms"] == 120_000
    assert env.client.post("/v1/sessions", json={"chunk_seconds": 1}).json()["chunk_seconds"] == 2        # clamped


def ogg_session(env):
    r = env.client.post("/v1/sessions", json={"chunk_format": "ogg"}).json()
    assert r["chunk_format"] == "ogg"
    return r["session_id"]


def test_ogg_chunks_get_ogg_keys_and_content_type(env):
    from .conftest import upload_ogg_chunk
    sid = ogg_session(env)
    info = upload_ogg_chunk(env, sid, 0)
    assert info["url"].endswith("00000.ogg")
    assert env.client.post("/v1/sessions", json={"chunk_format": "mp3"}).status_code == 422


def test_ogg_gap_is_repaired_whole_chunk_and_kept_by_midpoint(env):
    from .conftest import upload_ogg_chunk
    sid = ogg_session(env)
    for i in range(3):
        upload_ogg_chunk(env, sid, i)
    cp = {"duration_ms": 6000, "owned": [[0, 3000]], "turns": [{"start_ms": 200, "end_ms": 2800, "text": "live words"}]}
    out = env.client.post(f"/v1/sessions/{sid}/finalize", json=cp).json()
    assert len(env.asr.calls) == 2                                  # chunks 1 and 2 only; each transcribed once
    batch = [t for t in out["turns"] if t["source"] == "batch"]
    assert batch and all(t["start_ms"] >= 3000 - 400 for t in batch)  # nothing from the stream's own stretch
    assert out["transcript"].startswith("live words") and out["warnings"] == []


def test_ogg_crash_recovery_measures_duration_from_the_last_chunk(env):
    from .conftest import upload_ogg_chunk
    sid = ogg_session(env)
    upload_ogg_chunk(env, sid, 0)
    upload_ogg_chunk(env, sid, 1, ms=1300)
    out = env.client.post(f"/v1/sessions/{sid}/finalize").json()
    assert out["duration_ms"] == 3300 and "recovered" in out["transcript"]


def test_ogg_missing_chunk_is_reported(env):
    from .conftest import upload_ogg_chunk
    sid = ogg_session(env)
    upload_ogg_chunk(env, sid, 0)
    upload_ogg_chunk(env, sid, 2)
    out = env.client.post(f"/v1/sessions/{sid}/finalize", json={"duration_ms": 6000, "owned": [], "turns": []}).json()
    assert any("2s to 4s" in w for w in out["warnings"])
