"""Storage: S3 in production, a local folder for development and tests.

The API server is stateless (Render instances restart and spin down), so every piece of state
lives in object storage under keys scoped by device id.
"""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class ObjectInfo:
    key: str
    size: int


@dataclass(frozen=True)
class PresignedPut:
    url: str
    headers: dict[str, str]


class Storage(Protocol):
    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None: ...
    def get(self, key: str) -> bytes | None: ...
    def delete(self, key: str) -> None: ...
    def list(self, prefix: str) -> list[ObjectInfo]: ...
    def delete_prefix(self, prefix: str) -> int: ...
    def presign_put(self, key: str, content_type: str, expires: int = 900, base_url: str = "") -> PresignedPut: ...


class LocalStorage:
    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root not in p.parents:
            raise ValueError("invalid key")
        return p

    def put(self, key, data, content_type="application/octet-stream"):
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(p.suffix + ".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, p)  # atomic: readers never see half a file

    def get(self, key):
        p = self._path(key)
        return p.read_bytes() if p.is_file() else None

    def delete(self, key):
        p = self._path(key)
        if p.is_file():
            p.unlink()

    def list(self, prefix):
        base = self._path(prefix.rstrip("/")) if prefix.rstrip("/") else self.root
        if not base.exists():
            return []
        files = [base] if base.is_file() else [f for f in base.rglob("*") if f.is_file()]
        out = [ObjectInfo(str(f.relative_to(self.root)).replace(os.sep, "/"), f.stat().st_size) for f in files]
        return sorted((o for o in out if o.key.startswith(prefix) and not o.key.endswith(".tmp")), key=lambda o: o.key)

    def delete_prefix(self, prefix):
        items = self.list(prefix)
        for o in items:
            self.delete(o.key)
        d = self._path(prefix.rstrip("/"))
        if d.is_dir():
            shutil.rmtree(d, ignore_errors=True)
        return len(items)

    def presign_put(self, key, content_type, expires=900, base_url=""):
        return PresignedPut(url=f"{base_url.rstrip('/')}/v1/_local/blob/{key}", headers={"Content-Type": content_type})


class S3Storage:
    def __init__(self, bucket: str, region: str, endpoint_url: str | None = None):
        import boto3
        from botocore.config import Config

        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url,
            config=Config(signature_version="s3v4", retries={"max_attempts": 4, "mode": "standard"}),
        )

    def put(self, key, data, content_type="application/octet-stream"):
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get(self, key):
        from botocore.exceptions import ClientError

        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except ClientError as exc:
            if exc.response["Error"]["Code"] in ("NoSuchKey", "404"):
                return None
            raise

    def delete(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def list(self, prefix):
        out: list[ObjectInfo] = []
        for page in self.client.get_paginator("list_objects_v2").paginate(Bucket=self.bucket, Prefix=prefix):
            out += [ObjectInfo(o["Key"], o["Size"]) for o in page.get("Contents", [])]
        return out

    def delete_prefix(self, prefix):
        items = self.list(prefix)
        for i in range(0, len(items), 1000):
            batch = [{"Key": o.key} for o in items[i : i + 1000]]
            self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": batch, "Quiet": True})
        return len(items)

    def presign_put(self, key, content_type, expires=900, base_url=""):
        # The browser must send exactly this Content-Type, or S3 rejects the signature.
        url = self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires,
        )
        return PresignedPut(url=url, headers={"Content-Type": content_type})


def make_storage(settings) -> Storage:
    if settings.storage_backend == "s3":
        if not settings.s3_bucket:
            raise RuntimeError("STORAGE_BACKEND=s3 requires S3_BUCKET")
        return S3Storage(settings.s3_bucket, settings.aws_region, settings.s3_endpoint_url)
    return LocalStorage(settings.local_storage_dir)
