"""Tiny WAV helpers. Safety-path chunks are 16 kHz, mono, 16-bit PCM WAV files."""
from __future__ import annotations

import io
import wave
from typing import Callable

RATE = 16000
BYTES_PER_SAMPLE = 2


class AudioError(ValueError):
    pass


def pcm_to_wav(pcm: bytes, rate: int = RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(BYTES_PER_SAMPLE)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def wav_to_pcm(data: bytes) -> bytes:
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            if w.getnchannels() != 1 or w.getsampwidth() != BYTES_PER_SAMPLE or w.getframerate() != RATE:
                raise AudioError("chunk must be 16 kHz mono 16-bit PCM")
            return w.readframes(w.getnframes())
    except (wave.Error, EOFError) as exc:
        raise AudioError(f"invalid WAV: {exc}") from exc


def ms_to_bytes(ms: int) -> int:
    return (ms * RATE // 1000) * BYTES_PER_SAMPLE


def bytes_to_ms(n: int) -> int:
    return n * 1000 // (RATE * BYTES_PER_SAMPLE)


def assemble_window(
    get_chunk_pcm: Callable[[int], bytes | None],
    chunk_ms: int,
    start_ms: int,
    end_ms: int,
    min_missing_ms: int = 500,
) -> tuple[bytes, list[tuple[int, int]]]:
    """PCM for [start_ms, end_ms) built from fixed-length chunks.

    Chunk i covers [i*chunk_ms, (i+1)*chunk_ms). A missing or short chunk is padded with
    silence so timestamps stay aligned. Returns (pcm, missing_ranges), where missing ranges
    shorter than min_missing_ms are not reported (end-of-recording rounding).
    """
    out = bytearray()
    missing: list[tuple[int, int]] = []
    first, last = start_ms // chunk_ms, (end_ms - 1) // chunk_ms
    for i in range(first, last + 1):
        a = max(start_ms, i * chunk_ms)
        b = min(end_ms, (i + 1) * chunk_ms)
        want = ms_to_bytes(b - a)
        pcm = get_chunk_pcm(i)
        if pcm is None:
            piece, have_ms = b"", 0
        else:
            off = ms_to_bytes(a - i * chunk_ms)
            piece = pcm[off : off + want]
            have_ms = bytes_to_ms(len(piece))
        out += piece
        if len(piece) < want:
            out += b"\x00" * (want - len(piece))
            if (b - a) - have_ms >= min_missing_ms:
                missing.append((a + have_ms, b))
    return bytes(out), missing


def ogg_duration_ms(data: bytes) -> int:
    """Duration of an Ogg Opus file from the granule position of its last page (48 kHz units, minus pre-skip)."""
    i = data.rfind(b"OggS")
    if i < 0 or len(data) < i + 14:
        raise AudioError("not an Ogg file")
    granule = int.from_bytes(data[i + 6 : i + 14], "little", signed=True)
    pre_skip = 312
    h = data.find(b"OpusHead")
    if h >= 0 and len(data) >= h + 12:
        pre_skip = int.from_bytes(data[h + 10 : h + 12], "little")
    if granule <= 0:
        raise AudioError("ogg has no audio")
    return max(0, (granule - pre_skip) * 1000 // 48000)
