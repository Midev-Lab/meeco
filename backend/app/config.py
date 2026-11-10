from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # app
    allowed_origins: str = "*"
    chunk_seconds: int = 30
    max_session_seconds: int = 9000  # 2h30m: below AssemblyAI's 3h streaming cap

    # storage
    storage_backend: str = "local"  # local | s3
    local_storage_dir: str = ".data"
    s3_bucket: str = ""
    aws_region: str = "us-east-1"
    s3_endpoint_url: str | None = None  # MinIO / localstack

    # transcription
    transcriber: str = "fake"  # fake | assemblyai
    assemblyai_api_key: str = ""
    assemblyai_base_url: str = "https://api.assemblyai.com"
    assemblyai_stream_url: str = "wss://streaming.assemblyai.com/v3/ws"
    assemblyai_token_url: str = "https://streaming.assemblyai.com/v3/token"
    stream_speech_model: str = "universal-3-6-pro"
    voice_focus: str = "near-field"  # near-field | far-field | off
    voice_focus_threshold: float = 0.7

    # ai
    llm_provider: str = "fake"  # fake | groq
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model_title: str = "llama-3.1-8b-instant"
    groq_model_text: str = "llama-3.3-70b-versatile"
    groq_model_fallback: str = "openai/gpt-oss-120b"  # used if the models above are refused for this key

    @property
    def chunk_ms(self) -> int:
        return self.chunk_seconds * 1000

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
