from __future__ import annotations

import json

import boto3
import httpx
import pytest
from moto import mock_aws

from app.config import Settings
from app.ledger import Word
from app.services.llm import GroqLLM, LLMError, clean_title, head_tokens
from app.services.storage import S3Storage
from app.services.transcribe import AssemblyAITranscriber, TranscriptionError


def test_assemblyai_token_and_batch_flow():
    seen: list[httpx.Request] = []
    polls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        p = req.url.path
        if p == "/v3/token":
            return httpx.Response(200, json={"token": "tok123", "expires_in_seconds": 120})
        if p == "/v2/upload":
            return httpx.Response(200, json={"upload_url": "https://cdn.assemblyai.com/upload/abc"})
        if p == "/v2/transcript" and req.method == "POST":
            return httpx.Response(200, json={"id": "t1", "status": "queued"})
        if p == "/v2/transcript/t1":
            polls["n"] += 1
            if polls["n"] < 2:
                return httpx.Response(200, json={"status": "processing"})
            return httpx.Response(200, json={"status": "completed", "text": "hi there", "words": [{"text": "hi", "start": 10, "end": 200}, {"text": "there", "start": 250, "end": 600}]})
        return httpx.Response(404)

    s = Settings(transcriber="assemblyai", assemblyai_api_key="KEY")
    a = AssemblyAITranscriber(s, httpx.Client(transport=httpx.MockTransport(handler)))
    tok = a.mint_stream_token(9120)
    assert tok == {"token": "tok123", "expires_in": 120}
    tok_req = seen[0]
    assert tok_req.headers["authorization"] == "KEY"                               # raw key, no "Bearer"
    assert tok_req.url.params["max_session_duration_seconds"] == "9120"
    words = a.transcribe_wav(b"RIFFxxxx")
    assert words == [Word("hi", 10, 200), Word("there", 250, 600)]
    assert seen[1].content == b"RIFFxxxx"                                          # raw bytes upload
    cfg = a.stream_config()
    assert cfg["url"].startswith("wss://streaming.assemblyai.com/v3/ws") and cfg["params"]["voice_focus"] == "near-field"


def test_assemblyai_errors_surface():
    h = lambda req: httpx.Response(401, text="bad key")  # noqa: E731
    a = AssemblyAITranscriber(Settings(transcriber="assemblyai", assemblyai_api_key="K"), httpx.Client(transport=httpx.MockTransport(h)))
    with pytest.raises(TranscriptionError):
        a.mint_stream_token(100)


def test_groq_json_title_and_retry(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda *_: None)
    calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content)
        calls["n"] += 1
        assert req.headers["authorization"] == "Bearer GK"
        if calls["n"] == 1:
            return httpx.Response(429, text="slow down")
        if "response_format" in body:
            return httpx.Response(200, json={"choices": [{"message": {"content": '```json\n{"overview":"o","points":["p1","p2"]}\n```'}}]})
        return httpx.Response(200, json={"choices": [{"message": {"content": '"Quarterly Planning Call."\nextra'}}]})

    llm = GroqLLM(Settings(llm_provider="groq", groq_api_key="GK"), httpx.Client(transport=httpx.MockTransport(handler)))
    assert llm.title("some transcript") == "Quarterly Planning Call"               # retried past the 429, cleaned
    assert llm.summary("t") == {"overview": "o", "points": ["p1", "p2"]}           # tolerates fenced JSON


def test_groq_bad_json_raises():
    h = lambda req: httpx.Response(200, json={"choices": [{"message": {"content": "no json here"}}]})  # noqa: E731
    llm = GroqLLM(Settings(llm_provider="groq", groq_api_key="GK"), httpx.Client(transport=httpx.MockTransport(h)))
    with pytest.raises(LLMError):
        llm.action_items("x")


def test_title_helpers():
    assert clean_title('  "Hello world."  ') == "Hello world"
    assert clean_title("", "one two three four five six seven eight") == "one two three four five six…"
    assert len(head_tokens("w " * 1000, 300).split()) == 225


@mock_aws
def test_s3_storage_roundtrip_and_presign():
    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="meeco-test")
    st = S3Storage("meeco-test", "us-east-1")
    st.put("audio/d/s/00000.wav", b"abc", "audio/wav")
    st.put("audio/d/s/00001.wav", b"defg", "audio/wav")
    assert st.get("audio/d/s/00000.wav") == b"abc" and st.get("nope") is None
    assert [(o.key, o.size) for o in st.list("audio/d/s/")] == [("audio/d/s/00000.wav", 3), ("audio/d/s/00001.wav", 4)]
    p = st.presign_put("audio/d/s/00002.wav", "audio/wav")
    assert "X-Amz-Signature" in p.url and p.headers == {"Content-Type": "audio/wav"} and "00002.wav" in p.url
    assert st.delete_prefix("audio/d/s/") == 2 and st.list("audio/d/s/") == []


def test_groq_falls_back_when_primary_model_is_refused():
    import httpx, json
    from app.config import Settings
    from app.services.llm import GroqLLM
    seen = []

    def handler(req):
        body = json.loads(req.content)
        seen.append(body["model"])
        if body["model"].startswith("llama"):
            return httpx.Response(404, json={"error": {"message": "The model `x` does not exist or you do not have access to it."}})
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"overview": "ok", "points": ["a"]}'}}]})

    llm = GroqLLM(Settings(groq_api_key="k"), httpx.Client(transport=httpx.MockTransport(handler)))
    assert llm.summary("hello world")["overview"] == "ok"
    assert seen == ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]
