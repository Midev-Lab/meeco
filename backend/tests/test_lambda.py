"""The Lambda entry point serves the same app through Function URL (payload v2) events."""
import importlib
import json
import sys


def _event(method, path, body=None, headers=None):
    h = {"x-device-id": "dev_aaaaaaaaaaaaaaaa", "origin": "https://web.example", "content-type": "application/json", **(headers or {})}
    return {"version": "2.0", "rawPath": path, "rawQueryString": "", "headers": h, "isBase64Encoded": False,
            "body": json.dumps(body) if body is not None else None,
            "requestContext": {"http": {"method": method, "path": path, "sourceIp": "1.2.3.4", "protocol": "HTTP/1.1", "userAgent": "t"}, "stage": "$default"}}


def test_function_url_events_round_trip(monkeypatch, tmp_path):
    for k, v in dict(TRANSCRIBER="fake", LLM_PROVIDER="fake", STORAGE_BACKEND="local", LOCAL_STORAGE_DIR=str(tmp_path), ALLOWED_ORIGINS="https://web.example").items():
        monkeypatch.setenv(k, v)
    from app.config import get_settings
    get_settings.cache_clear()  # settings are read once per process; this test needs its own env
    sys.modules.pop("lambda_handler", None)
    handler = importlib.import_module("lambda_handler").handler

    assert handler(_event("GET", "/health"), None)["statusCode"] == 200
    pre = handler(_event("OPTIONS", "/v1/sessions", headers={"access-control-request-method": "POST", "access-control-request-headers": "x-device-id,content-type"}), None)
    assert pre["headers"]["access-control-allow-origin"] == "https://web.example"
    sid = json.loads(handler(_event("POST", "/v1/sessions", {"chunk_format": "ogg"}), None)["body"])["session_id"]
    cp = {"duration_ms": 4000, "owned": [[0, 4000]], "turns": [{"start_ms": 100, "end_ms": 3900, "text": "hello from lambda"}]}
    out = handler(_event("POST", f"/v1/sessions/{sid}/finalize", cp), None)
    assert out["statusCode"] == 200 and json.loads(out["body"])["transcript"] == "hello from lambda"

    get_settings.cache_clear()
