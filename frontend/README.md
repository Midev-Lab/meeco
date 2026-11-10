# meeco: frontend

Listen to audio, transcribe it, then act on it. This is the front end: React + Vite, built to a
**single self-contained `meeco.html`** (JS, CSS and font all inlined).

## Run

```bash
npm install
npm run dev            # local dev server
npm run build          # -> dist/index.html and ./meeco.html (open it straight from disk)
npm run build:preview  # demo build: simulated mic + sample captions (no microphone needed)
```

`meeco.html` is already built in this folder. The microphone needs a secure context, so it works from
`https://`, `http://localhost` and `file://` in Chrome; some browsers restrict `file://`, so host it if the mic is blocked.

## Flow

`Home (idle) -> Recording -> Processing -> Result (Transcript | Summary | Action items)`
plus **Profile** and **History** from the `meeco` dropdown.

## Where things live

| File | Job |
| --- | --- |
| `src/hooks/useRecorder.js` | Mic capture (`getUserMedia`), `MediaRecorder` (WebM/Opus or MP4/AAC by feature detection), timer, wake lock |
| `src/lib/meter.js` | `AnalyserNode` -> 9 smoothed levels that drive the waveform |
| `src/lib/transcriber.js` | **Transcription provider interface.** Web Speech today; swap in your backend here |
| `src/lib/mockActions.js` | **Mocked** `summarise()` / `getActionItems()`; same async signatures a real API will have |
| `src/lib/pdf.js` | PDF export (jsPDF) + Web Share API with download fallback |
| `src/lib/storage.js` | `localStorage` for history and profile |
| `src/components/*` | One file per screen |

## Plugging in the backend later

1. **Transcription:** add a provider in `transcriber.js` that uploads the recorded `Blob` inside `finish()` and
   calls `onProgress(0..100)` from real upload/processing progress. Nothing else changes: the processing ring
   already renders whatever progress it is given.
2. **Summary / action items:** replace the bodies of `summarise()` and `getActionItems()`. Keep the return
   shapes: `{ overview, points[] }` and `[{ id, text, done }]`.

## Known limits (front-end stage)

- Web Speech works in Chrome, Edge and Safari; not Firefox. Where it is missing or errors, meeco keeps the
  recording and shows a clearly-labelled **demo transcript**.
- Chrome ends continuous recognition on silence; the provider restarts it automatically.
- Whether Web Speech can share the microphone with the waveform meter varies by browser/OS and is not
  defined by the spec: test on target devices. The recorded audio is always kept, so the backend path does not depend on it.
- Audio is kept in memory for the last recording only (play button); history stores text, not audio.

## Cloud mode

Set `VITE_API_URL` (or open the page with `?api=https://...`) to switch from on-device mode to the backend:
streaming transcription, S3 backup, server-side history and AI summaries. See `../README.md`.
Modules: `cloudEngine.js` (capture + orchestration), `liveStream.js` (AssemblyAI socket, reconnect), `chunker.js`
(S3 uploads), `intervals.js` (gap ledger), `api.js`, `pcm-worklet.js`. Tests: `npm test`.
