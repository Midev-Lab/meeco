# Transcript AI provider handoff

This slice implements `backend/app/services/llm.py` and isolated provider tests.
It does not implement session persistence, HTTP endpoints, authentication, frontend
features or Phase 2 transcription. Existing frontend/auth work is preserved.
`PROJECT_BRIEF.md` still takes precedence over the older PRD/INTENT where they
conflict. `API_CONTRACTS.md` belongs to the separate frontend/auth foundation
review and is not included in this AI-only branch. Its unresolved auth/API
proposals remain proposals; the provider interface is fully documented below.

## Python boundary

Both implementations satisfy `LLM` in `backend/app/services/llm.py`:

```python
title(head: str) -> str
summary(transcript: str) -> Summary  # {"overview": str, "points": list[str]}
action_items(transcript: str) -> list[str]
```

`FakeLLM()` requires no settings, key, network, database or mutable session state.
This also supports the starter `SpyLLM` subclass, whose constructor does not call
`super().__init__()`. `GroqLLM(settings, client=None, *, sleep=None)` accepts an
`httpx.Client` and sleep callback for testing. `make_llm(settings)` selects exactly
`fake` or `groq`; unknown provider names fail explicitly.

Example, runnable from `backend`:

```python
from app.config import Settings
from app.services.llm import make_llm

llm = make_llm(Settings(_env_file=None, llm_provider="fake"))
transcript = (
    "Ada will send the revised budget to Tunde by Friday. "
    "Please schedule a review for Monday. The office walls are blue."
)
title = llm.title(transcript)
summary = llm.summary(transcript)
action_texts = llm.action_items(transcript)
```

Actual FakeLLM output for that transcript:

```json
{
  "title": "Ada will send the revised budget…",
  "summary": {
    "overview": "Ada will send the revised budget to Tunde by Friday. Please schedule a review for Monday.",
    "points": [
      "Ada will send the revised budget to Tunde by Friday.",
      "Please schedule a review for Monday.",
      "The office walls are blue."
    ]
  },
  "action_items": [
    "Ada will send the revised budget to Tunde by Friday.",
    "Please schedule a review for Monday."
  ]
}
```

## Backend owner responsibilities

- Pass the already finalized transcript; no audio/transcription work occurs here.
- Save the title/result through Storage, cache summaries/actions, and implement
  `refresh=true` and idempotent finalize in `SessionService`.
- Wrap action strings as `{id, text, done: false}` **once**, using stable IDs on
  the initial save. The existing POST action route wraps the service return in
  `{items: [...]}`. The provider never assigns IDs or updates checkboxes. Decide
  separately how an explicit regeneration reconciles existing IDs/check states.
- Enforce verified ownership before calling providers or accessing cached data.
  The existing device-ID route authorization still needs the separate JWT
  integration work. This slice does not change it.
- Catch `LLMError` for summary/action failures; do not store fake success or an
  empty task list after a failed extraction. `[]` means successful extraction
  with no tasks. The existing route guard maps `LLMError` to HTTP 502. Validate
  oversized input before invocation and agree its HTTP status in endpoint work.
- These methods are synchronous. Use FastAPI sync handlers or a thread pool;
  do not block an async event loop. Close a factory-created `GroqLLM` on shutdown
  with `close()`. The owner of an injected HTTP client must close that client.
- Render generated strings as text. They remain untrusted content, even after
  JSON validation.

## Content rules and limits

Titles use the configured title model and request the transcript's language.
`clean_title` strips quotes/Markdown, takes the first output line, and caps at six
whitespace-separated words and 120 characters. On empty output or provider failure,
the deterministic fallback takes the transcript's first six words, with an
ellipsis if shortened. An empty transcript yields `Untitled recording`.
Word counts are whitespace-based, not language-aware segmentation.

Summaries have exactly `overview` and `points`: nonblank overview up to 1,000
characters and up to six nonblank points, each up to 1,000 characters. Prompts ask
for a short 1–2 sentence overview in the source language, using only transcript
facts and preserving uncertainty. Runtime validation enforces shape, types and
lengths; it does **not** prove factual accuracy, language matching or sentence count.
These require evaluation with representative transcripts.

Groq actions use internal JSON `{ "items": ["source quote", ...] }`, then return
only the strings. At most ten nonblank strings of up to 2,000 characters are
accepted. Each must occur contiguously in the original transcript after whitespace
normalization, preserving spelling, case and punctuation. This intentionally
prefers extractive tasks over paraphrases so names/deadlines cannot be added by
paraphrasing. Duplicates are removed in source response order. Prompts require
complete explicit requests/commitments, exclude hypothetical/negated/completed
work, and require `[]` when none exist. Source matching proves textual presence;
it cannot prove that a quote is actionable or that all context was included.

FakeLLM summarizes the first two sentences and first six unique sentence excerpts.
Its action extraction uses a conservative list of common English action verbs
and separate commitment, polite-request and bare-command patterns. Requests may
have a comma-separated addressee, including multiword names. Bare commands are
checked for common declarative predicates in their main clause: `Test results
were positive.` is a statement, while `Test the backup before Friday.` is a task.
An embedded `if`/`whether` question does not invalidate an otherwise valid request:
`Please check if the report is ready.` remains one full action. Negation inside
that embedded question is retained; a negated main request such as `Please do not
send the report.` is excluded. Tentative statements and conditional promises such
as `We will send the report if approved.` remain excluded. Commitments to check,
confirm or investigate an `if`/`whether` question are recognized.

The review regressions now produce:

| Transcript | FakeLLM action strings |
| --- | --- |
| `Test results were positive.` | `[]` |
| `Please check if the report is ready.` | `["Please check if the report is ready."]` |
| `Ada, please send the report by Friday.` | `["Ada, please send the report by Friday."]` |

The complete sentence is returned, preserving addressees, deadlines and embedded
conditions. This remains a deterministic English heuristic, not a grammar parser
or semantic AI: unlisted verbs, unusual address forms, ambiguous noun/verb uses
and complex clauses can still be missed or misclassified. Extractive output
retains source language, but task detection is English-focused. It does not
evaluate accents or perform speech recognition. The runnable example above is
unchanged and was re-executed against the implemented interface.

Both providers reject summary/action input longer than **32,000 characters** with
`LLMError`, before network I/O. They do not silently discard transcript tails.
Empty/whitespace-only input returns `{overview: "", points: []}` and `[]` locally.
Title generation intentionally uses only the first 1,200 characters and a legacy
225-word estimate (`head_tokens(..., 300)`); its fallback reads a bounded head.
The word estimate is not a tokenizer. Longer recordings need a separately designed
chunk-and-merge strategy; the Phase 2 recording duration limit does not imply this
provider can summarize an entire multi-hour recording in one request.

## Configuration, transport and errors

No new dependencies or configuration keys were added. Existing `Settings` fields
are used: `llm_provider`, `groq_api_key`, `groq_base_url`, `groq_model_title`,
`groq_model_text`, and `groq_model_fallback`. Defaults remain fake/no key,
`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, and `openai/gpt-oss-120b`.
Groq selection requires a nonblank backend-only key; it never silently switches
to fake results. No live credentials were used in verification.

Requests use existing HTTPX and Groq's
[Chat Completions API](https://console.groq.com/docs/api-reference).
Summary/actions request `response_format: {"type": "json_object"}`. Groq's
[JSON Object Mode](https://console.groq.com/docs/structured-outputs) provides JSON
syntax rather than schema enforcement, so the adapter validates locally. One
complete Markdown JSON fence is accepted. Invalid JSON, duplicate object keys,
non-JSON constants, wrong fields/types, oversized content and incomplete output
raise sanitized `LLMError`; malformed outputs are not retried. Transcript data is
JSON-encoded in a separate user message; system prompts instruct the model to
ignore embedded instructions. This reduces injection risk but cannot guarantee
model compliance. No tools are enabled and generated text is never executed.

Each operation permits **three total HTTP attempts**, including fallback. Request
errors, HTTP 408/429 and 5xx are retried with exponential waits of 1 then 2 seconds.
Numeric `Retry-After` on 429 is respected up to five seconds; longer requested
waits fail immediately so the caller can retry later. There is no sleep after
the final attempt. Timeouts per attempt are connect/pool 5 seconds, write 10 and
read 20. These are HTTPX phase/inactivity limits, not a total wall-clock deadline.

For 400/403/404 errors identifying a missing/inaccessible/decommissioned model,
switch once to the configured fallback within the same three-attempt budget.
Generic auth/input errors do not trigger fallback. GPT-OSS models receive
`reasoning_effort: "low"` and 4,096 completion tokens; other models get 2,048 for
JSON or 128 for titles. Redirects are disabled. Base URLs require HTTPS (loopback
HTTP is allowed for local testing) and cannot embed credentials/query/fragment.
Errors omit credentials, transcript text and raw provider bodies; this module
does not log request/response content. Avoid enabling wire/body logging elsewhere.

## Verification and integration boundary

Run from `backend` in PowerShell using the existing Python 3.12 environment:

```powershell
.\.venv\Scripts\python.exe -B -m pytest --noconftest ai_tests tests/test_providers.py -q -p no:cacheprovider
```

`--noconftest` avoids the existing session/app fixture imports; none of these tests
need them. It does not skip provider assertions or insert replacement modules.
New tests cover repeatability, limits, no-task input, extractive names/deadlines,
malformed JSON/envelopes, bounded timeout/retry behavior, fallback, request
boundaries and safe error messages. Groq uses **HTTPX MockTransport only**, not a
live call. The existing provider tests also run unchanged.

Working-copy verification on 2026-11-14 with the existing CPython 3.12.13 environment
and HTTPX 0.28.1: **145 passed in 8.47s** (138 AI tests and all seven unchanged
starter provider tests). The three review regressions were first run against
the old implementation and all three failed. The fix adds 38 regression cases
covering those failures, related statements/requests, names, negation, embedded
clauses and mixed transcripts. The guide's runnable example was re-executed and
matched its JSON exactly; method signatures still match the `LLM` protocol.
Diff whitespace checks passed. A SHA-256 comparison against the 97-file snapshot
at the start of this fix found changes only to this document, `llm.py` and
`ai_tests/test_llm.py`; the other 94 files were unchanged.

The earlier working-copy full-suite command was also attempted:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider
```

It stops during `tests/conftest.py` loading, before test execution, with
`ModuleNotFoundError: No module named 'app.services.sessions'`. The direct
`python -B -c "import app.main"` startup/import check fails at the same import.

The full backend still cannot start: `app.deps` imports the absent
`app.services.sessions`. Normal application test collection has the same blocker.
No replacement SessionService was added. Endpoint integration, persistence,
checkbox state, real Groq model access/quality, multilingual evaluation and
representative long-transcript handling remain for the backend owner.

## Isolated local review verification

The AI-only review branch is `feat/ai-providers-review`, based on the refreshed
integration branch `origin/main` at
`5868b89d6595bf6b5599082263c907d47e4fdfef`. Its only changed files are:

- `backend/app/services/llm.py`
- `backend/ai_tests/test_llm.py`
- `docs/AI_PROVIDER_INTEGRATION.md`

On 2026-11-14 the focused command above passed **145 tests in 10.20s** in this
separate worktree. A fresh uv-managed CPython 3.12.13 environment was installed
from the base branch's `backend/requirements-dev.txt`, using temporary constraints
to match the existing package versions. Only the base requirements and their
dependencies were installed: 48 packages, with no auth-only pwdlib/PyJWT/Argon2
packages. `uv pip check` passed. HTTPX 0.28.1 and pytest 9.2.0 match the baseline.
No dependency/configuration changes or authentication/frontend files are needed
for this provider slice.

The guide's runnable example executed in the isolated environment and matched
its documented JSON exactly. All three provider method signatures match `LLM`.
Imports were verified to come from this worktree and its own virtual environment.
There is no missing shared AI dependency or provider contract on this base.

The isolated application import check still fails with
`ModuleNotFoundError: No module named 'app.services.sessions'` (exit 1). This is
unfinished session integration, outside the AI-only commit; isolated provider
tests do not establish that the full backend starts.

**Live Groq verification is pending because a project key is unavailable.** All
Groq tests use mocks; no live Groq requests were made.
