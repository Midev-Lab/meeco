"""The timeline ledger.

A recording is a timeline from 0 to duration_ms. The live stream "owns" the stretches it
transcribed; everything else is a gap that the S3 safety path must fill. All times are
milliseconds on the global recording timeline.
"""
from __future__ import annotations

from dataclasses import dataclass

Interval = tuple[int, int]


@dataclass(frozen=True)
class Word:
    text: str
    start_ms: int
    end_ms: int


def normalize(intervals: list[Interval] | list[list[int]], total_ms: int | None = None) -> list[Interval]:
    """Sort, clamp to [0, total], drop empties, merge overlapping or touching intervals."""
    cleaned: list[Interval] = []
    for s, e in intervals:
        s, e = int(s), int(e)
        if total_ms is not None:
            s, e = max(0, min(s, total_ms)), max(0, min(e, total_ms))
        if e > s:
            cleaned.append((s, e))
    cleaned.sort()
    merged: list[Interval] = []
    for s, e in cleaned:
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return merged


def find_gaps(
    owned: list[Interval] | list[list[int]],
    total_ms: int,
    min_gap_ms: int = 400,
    merge_within_ms: int = 2000,
) -> list[Interval]:
    """Stretches of [0, total_ms] that nothing owns.

    * Gaps shorter than min_gap_ms are ignored (rounding, not speech).
    * Gaps separated by less than merge_within_ms are merged, so a flaky connection becomes one
      repair job instead of dozens. Kept small on purpose: a merged span re-transcribes (and replaces)
      the good stream speech between the gaps, and the stream has voice-focus noise handling that batch lacks.
    """
    covered = normalize(owned, total_ms)
    raw: list[Interval] = []
    cursor = 0
    for s, e in covered:
        if s - cursor >= min_gap_ms:
            raw.append((cursor, s))
        cursor = max(cursor, e)
    if total_ms - cursor >= min_gap_ms:
        raw.append((cursor, total_ms))

    merged: list[Interval] = []
    for s, e in raw:
        if merged and s - merged[-1][1] < merge_within_ms:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))
    return merged


def split_range(start_ms: int, end_ms: int, max_len_ms: int) -> list[Interval]:
    """Cut [start, end) into pieces of at most max_len_ms (the last one may be shorter)."""
    out: list[Interval] = []
    cursor = start_ms
    while cursor < end_ms:
        nxt = min(end_ms, cursor + max_len_ms)
        out.append((cursor, nxt))
        cursor = nxt
    return out


def words_to_turns(words: list[Word], pause_ms: int = 1500) -> list[dict]:
    """Group words into turns, breaking on pauses longer than pause_ms."""
    turns: list[dict] = []
    current: list[Word] = []
    for w in words:
        if current and w.start_ms - current[-1].end_ms > pause_ms:
            turns.append(_turn(current))
            current = []
        current.append(w)
    if current:
        turns.append(_turn(current))
    return turns


def _turn(ws: list[Word]) -> dict:
    return {
        "start_ms": ws[0].start_ms,
        "end_ms": ws[-1].end_ms,
        "text": " ".join(w.text for w in ws).strip(),
        "source": "batch",
    }


def merge_turns(stream_turns: list[dict], fill_turns: list[dict], fill_spans: list[Interval]) -> list[dict]:
    """Keep stream turns that sit outside every repaired span, add the repaired turns, sort by time."""

    def inside(turn: dict) -> bool:
        mid = (turn["start_ms"] + turn["end_ms"]) // 2
        return any(s <= mid < e for s, e in fill_spans)

    kept = [{**t, "source": "stream"} for t in stream_turns if not inside(t)]
    return sorted(kept + fill_turns, key=lambda t: (t["start_ms"], t["end_ms"]))
