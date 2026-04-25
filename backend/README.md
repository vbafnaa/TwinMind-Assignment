# TwinMind assignment API (Python)

FastAPI service that proxies your Groq API key to:

- **Whisper Large V3** (`whisper-large-v3`) for each uploaded audio chunk
- **GPT-OSS 120B** (`openai/gpt-oss-120b`) for JSON live suggestions and streaming chat/detail answers

The server **never persists** API keys. The browser sends `X-Groq-Api-Key` on every request.

## CORS (required for deployed SPA)

Browser requests from your **frontend origin** must be listed explicitly.

- **`ALLOWED_ORIGINS`** — comma-separated origins **without** trailing slashes, e.g.  
  `https://my-app.netlify.app,https://www.example.com`
- If unset, defaults still allow local dev: `http://localhost:3000` and `http://127.0.0.1:3000`.

Set this env var wherever you host the API (Render, Railway, Fly, etc.).

## Deploy (Docker)

From repo root (parent of `backend/`):

```bash
docker build -t twinmind-api ./backend
docker run --rm -p 8000:8000 -e ALLOWED_ORIGINS=https://your-spa.example.com twinmind-api
```

Health check: `curl -sS http://127.0.0.1:8000/api/health`

## Deploy (Render Blueprint)

Use [render.yaml](../render.yaml) in the repo root: **New → Blueprint** → pick this repository. Set **`ALLOWED_ORIGINS`** in the service environment to match your static site URL after the frontend is deployed.

## Run locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for interactive OpenAPI.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness |
| GET | `/api/defaults` | Default prompts + context sizes for the Settings UI |
| POST | `/api/transcribe` | `multipart/form-data` field `audio` → `{ "text": "..." }` |
| POST | `/api/suggestions` | JSON `{ "transcript", "settings"? }` → `{ "suggestions": [3 items] }` |
| POST | `/api/expand-stream` | SSE stream of expanded answer for a tapped suggestion |
| POST | `/api/chat-stream` | SSE stream for free-form chat |

All POSTs except transcribe require header `X-Groq-Api-Key: gsk_...` (or `Authorization: Bearer ...`).

## About the assignment’s `transformers` snippet

Running **Whisper Large V3 locally** via Hugging Face `transformers` is possible but heavy (GPU RAM, slow cold start, harder to scale). This backend uses **Groq’s hosted Whisper** instead, which matches the assignment’s requirement (“Groq for everything”) and gives the latency profile evaluators care about. The `transformers` code in the brief is conceptual reference for the model family, not a mandate to self-host.
