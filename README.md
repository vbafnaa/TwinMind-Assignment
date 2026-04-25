# TwinMind — Live Suggestions Assignment

Full-stack demo: **mic → 15s chunks → Whisper (Groq) → transcript**, **GPT-OSS 120B (Groq)** generates **three contextual suggestion cards** on each refresh, and the **right-hand chat** streams **detailed answers** (suggestion click or free-form questions). **Settings** stores your **Groq API key** and editable prompts in **browser localStorage** only.

## Quick start

### 1. Backend (Python 3.9+)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Frontend (React / CRA)

```bash
cd frontend
npm install
npm start
```

The CRA `proxy` points to `http://127.0.0.1:8000`, so the app calls `/api/...` on the same origin in development.

Open **`http://localhost:3000/twinmind`**.

- Configure your key and prompts: **`http://localhost:3000/twinmind/settings`**
- Export evaluation JSON from the **Export session** button on the live page.

### Production / custom API host

Set `REACT_APP_API_URL` to your deployed API origin (no trailing slash). Remove or override CRA `proxy` as needed.

## Deploy (production)

### Prerequisites

1. **API** reachable over **HTTPS** (e.g. `https://twinmind-api.onrender.com`).
2. **CORS**: set **`ALLOWED_ORIGINS`** on the API to your SPA origin(s), comma-separated, no trailing slash (see [backend/README.md](backend/README.md)).
3. **Frontend build**: set **`REACT_APP_API_URL`** to that same API base (no trailing slash) **at build time** — see [frontend/.env.production.example](frontend/.env.production.example).

### Option A — Two hosts (typical)

| Step | What to do |
|------|------------|
| 1 | Deploy **backend**: Docker image from [backend/Dockerfile](backend/Dockerfile), or use [render.yaml](render.yaml) Blueprint on Render. |
| 2 | Set env **`ALLOWED_ORIGINS`** = `https://<your-static-site-host>` |
| 3 | Build **frontend** with `REACT_APP_API_URL=https://<your-api-host>` then `npm run build` |
| 4 | Upload **`frontend/build/`** to Netlify / Vercel / Cloudflare Pages. For Netlify from the **repo root**, [netlify.toml](netlify.toml) sets `base = "frontend"` and SPA fallback; [frontend/public/_redirects](frontend/public/_redirects) is also copied into `build/`. |

### Option B — Same origin (nginx)

Serve `frontend/build` at `/` and reverse-proxy `/api` to uvicorn. Build with **`REACT_APP_API_URL` empty** so the browser calls relative `/api/...`.

### After deploy — smoke tests

Scripts call **`/api/health`** and **`/api/defaults`** (same checks Settings uses for defaults).

```bash
./scripts/verify-deploy.sh https://YOUR-API-HOST
```

On Windows:

```powershell
.\scripts\verify-deploy.ps1 -ApiBase https://YOUR-API-HOST
```

Then in the browser: open **Settings** (loads `/api/defaults`), open **Live session**, run mic + chat once.

## How it works

1. **Audio** — While recording, the app captures **~15s segments** as complete media files; each segment is POSTed to `/api/transcribe` as `multipart/form-data` (`audio` field). The backend calls Groq **`audio/transcriptions`** with **`whisper-large-v3`**.
2. **Transcript** — Returned text is appended to the left column with a timestamp. The pane auto-scrolls.
3. **Suggestions** — After each successful transcription (roughly every ~15s while recording), the client POSTs the **full transcript** to `/api/suggestions`. The model must return **JSON with exactly three** items (`type`, `title`, `preview`). New batches are **prepended** so the freshest ideas stay on top. **Refresh** runs the same step on demand (requires non-empty transcript).
4. **Chat** — Tapping a card POSTs `/api/expand-stream` with the **full transcript** and suggestion metadata; tokens stream over **SSE** (`data: {"t":"..."}` … `data: [DONE]`). Typed questions use `/api/chat-stream` with **prior user/assistant messages** plus transcript context injected in the **server-built system** message.
5. **Export** — Client downloads JSON: transcript lines, full text, every suggestion batch (with timestamps/reason), and finalized chat messages.

## Repository layout

```
backend/app/
  main.py           # FastAPI routes, CORS, SSE wrappers
  defaults.py       # Hard-coded default prompts & model IDs
  schemas.py        # Pydantic request/response models
  services/groq_openai.py  # AsyncOpenAI client → Groq base URL
frontend/src/
  pages/TwinMindLive.jsx      # 3-column session UI
  pages/TwinMindSettings.jsx  # Key + prompts + numeric limits
  twinmind/api.js             # fetch helpers
  twinmind/sse.js             # SSE token parser
  twinmind/storage.js         # localStorage merge helpers
```

## Models (fixed for fair comparison)

| Role | Model ID on Groq |
|------|------------------|
| Transcription | `whisper-large-v3` |
| Suggestions + chat | `openai/gpt-oss-120b` |

## Integration notes for reviewers

- **Latency**: Chunk size trades off **ASR context** vs **time-to-text**. Streaming endpoints target **time-to-first-token** in the chat column.
- **Errors**: Groq/OpenAI errors bubble as HTTP 502 with text; SSE sends `{"error": "..."}` if streaming fails at creation time.
- **Security**: Never commit a real `gsk_` key; use Settings in the running app only.

### Optional Hugging Face token (legacy Assistant)

`UserInterface.jsx` can call Hugging Face inference if you set **`REACT_APP_HF_TOKEN`** (see `frontend/.env.example`). Do not commit tokens; GitHub push protection will block `hf_…` strings in the repo.
