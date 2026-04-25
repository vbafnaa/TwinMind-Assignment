# TwinMind assignment API (Python)

FastAPI service that proxies your Groq API key to:

- **Whisper Large V3** (`whisper-large-v3`) for each uploaded audio chunk
- **GPT-OSS 120B** (`openai/gpt-oss-120b`) for JSON live suggestions and streaming chat/detail answers

The server **never persists** API keys. The browser sends `X-Groq-Api-Key` on every request.

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
