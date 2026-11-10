# meeco

Listens, transcribes, then acts on it (summary, action items). `frontend/` is React + Vite; `backend/` is FastAPI.

## How the speed works

One microphone capture feeds two paths at once:

- **Fast path:** 100 ms frames go straight to AssemblyAI streaming. When you press stop, the last words are flushed and the transcript is already there, so processing is short.
- **Safety path:** the same audio is cut into 30 s WAV chunks and uploaded to S3. Chunk edges never touch the recorder or the timer.

If the stream drops, the app reconnects (replaying at most the last 5 s). Whatever the stream did not finish is found by comparing timelines, and only those stretches are transcribed from the S3 chunks. A clean recording never triggers a batch job.

## Run locally (no keys needed)

```bash
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
cp .env.example .env            # defaults use local storage and fake providers
uvicorn app.main:create_app --factory --reload      # http://localhost:8000
pytest                          # 31 tests

cd ../frontend && npm install && npm test
VITE_API_URL=http://localhost:8000 npm run dev
```

Without `VITE_API_URL` (or `?api=`) the front end runs fully on-device like phase 1.

End-to-end check (headless Chromium, fake mic, real FastAPI, fake AssemblyAI socket, with a simulated outage):
`npm run build` in `frontend`, then `python3 e2e/run.py clean|drop|gap`.

## Go live

The API runs on **AWS Lambda** (no server to sleep, free at this scale, uses your AWS credits). The front end is a free Render static site.

1. **S3:** create a private bucket, then
   `python backend/scripts/setup_s3.py --bucket NAME --origin https://YOUR-FRONTEND`
   (upload CORS, 1-day expiry for `audio/`, public access blocked; S3 expiry is day-granular).
2. **API:** with AWS credentials that can create IAM roles and Lambda functions:
   ```bash
   export ASSEMBLYAI_API_KEY=... GROQ_API_KEY=...
   cd backend && python scripts/deploy_lambda.py --bucket NAME --origin https://YOUR-FRONTEND
   ```
   It builds the package, creates a bucket-scoped role, the function and a public Function URL, and prints the URL. Re-run it to update.
3. **Front end:** on Render, New, Blueprint, pick this repo (`render.yaml`), and set `VITE_API_URL` to the URL from step 2.
4. Keys live only on the backend. The browser gets a short-lived streaming token.

(Prefer a normal server? `render.yaml` has the API service commented out as an alternative.)

## Know before you ship

- **Cold starts:** Lambda should wake in a second or two (my estimate; not measured on your account), versus about a minute on Render's free plan. A recording never waits on the backend either way.
- **Lambda limits:** one call may run 15 minutes (finalize is far shorter). The Function URL is public and the device id is not authentication, so add sign-in before real users.
- **Secrets** are Lambda environment variables. Fine for now; move to Secrets Manager later.
- **AssemblyAI cost:** streaming on Universal-3.6 Pro is $0.45/h, so $150 is about 330 hours of live recording. Batch repair (only for gaps) is $0.21/h. The cheaper `universal-streaming-english` is $0.15/h but has no Voice Focus, so it is not the default. Free accounts allow 5 new streaming connections per minute.
- **Data use:** the live stream is about 32 KB/s (115 MB/h). The backup copy is compressed to Opus in the browser (about 3 KB/s on speech, roughly 10 MB/h) and falls back to uncompressed WAV where the browser cannot encode Opus.
- Repairing a gap from compressed backup transcribes the whole 30 s chunk that touches the gap (words are kept by position), so repair costs a little more audio than the gap itself.
- Batch gap-filling has no `voice_focus`; only the live stream does.
- Bedrock on the $100 credits is unconfirmed; `LLM` is an interface, so Bedrock is one new class. If Groq refuses its default Llama models for your key, the backend falls back to `openai/gpt-oss-120b`.
- Not built yet: offline recording queue, playback in cloud mode, real sign-in.
- Limit: 2h30m per recording; the app stops itself there.
