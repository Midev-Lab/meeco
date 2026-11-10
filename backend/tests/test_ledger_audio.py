from app.audio import assemble_window, bytes_to_ms, ms_to_bytes, pcm_to_wav, wav_to_pcm
from app.ledger import Word, find_gaps, merge_turns, normalize, split_range, words_to_turns


def test_normalize_merges_and_clamps():
    assert normalize([[5, 10], [0, 6], [20, 30], [-5, 3]], total_ms=25) == [(0, 10), (20, 25)]


def test_gaps_ignore_tiny_and_report_edges():
    assert find_gaps([[0, 1000], [1100, 5000]], 5000) == []          # 100 ms hole = silence, not a gap
    assert find_gaps([[1000, 4000]], 6000) == [(0, 1000), (4000, 6000)]   # 3 s of owned speech between: two jobs
    assert find_gaps([[1000, 2500]], 5000) == [(0, 5000)]                  # only 1.5 s between: one job
    assert find_gaps([], 4000) == [(0, 4000)]                         # stream never worked: repair everything


def test_close_gaps_become_one_repair_job():
    owned = [[0, 1000], [2000, 3000], [4000, 9000]]
    assert find_gaps(owned, 9000) == [(1000, 4000)]


def test_split_range():
    assert split_range(0, 25, 10) == [(0, 10), (10, 20), (20, 25)]


def test_words_to_turns_breaks_on_pause():
    ws = [Word("a", 0, 100), Word("b", 150, 300), Word("c", 5000, 5200)]
    t = words_to_turns(ws, pause_ms=1500)
    assert [x["text"] for x in t] == ["a b", "c"] and t[1]["start_ms"] == 5000


def test_merge_replaces_stream_turns_inside_repaired_span():
    stream = [{"start_ms": 0, "end_ms": 900, "text": "keep"}, {"start_ms": 2000, "end_ms": 2500, "text": "drop"}]
    fill = [{"start_ms": 1500, "end_ms": 3000, "text": "fixed", "source": "batch"}]
    out = merge_turns(stream, fill, [(1000, 4000)])
    assert [t["text"] for t in out] == ["keep", "fixed"]


def test_wav_roundtrip_and_window_with_missing_chunk():
    pcm = b"\x01\x00" * 16000  # 1 s
    assert wav_to_pcm(pcm_to_wav(pcm)) == pcm
    assert bytes_to_ms(ms_to_bytes(1234)) == 1234
    chunks = {0: b"\x01\x00" * 32000, 2: b"\x02\x00" * 32000}       # 2 s chunks; chunk 1 never uploaded
    out, missing = assemble_window(chunks.get, 2000, 1000, 5000)
    assert len(out) == ms_to_bytes(4000)                              # always exactly the window length
    assert missing == [(2000, 4000)]
