from __future__ import annotations

import json
from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from app import defaults
from app.deps import extract_groq_api_key
from app.schemas import (
    ChatStreamRequest,
    DefaultsResponse,
    ExpandSuggestionRequest,
    PromptSettings,
    SuggestionsRequest,
)
from app.services import groq_openai

app = FastAPI(title="TwinMind Assignment API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/defaults", response_model=DefaultsResponse)
def get_defaults() -> DefaultsResponse:
    ps = PromptSettings(
        live_suggestions_system=defaults.DEFAULT_LIVE_SUGGESTIONS_SYSTEM,
        live_suggestions_user_template=defaults.DEFAULT_SUGGESTIONS_USER_TEMPLATE,
        detail_system=defaults.DEFAULT_DETAIL_SYSTEM,
        detail_user_template=defaults.DEFAULT_DETAIL_USER_TEMPLATE,
        chat_system=defaults.DEFAULT_CHAT_SYSTEM,
        context_suggestions_chars=defaults.DEFAULT_CONTEXT_SUGGESTIONS_CHARS,
        context_detail_chars=defaults.DEFAULT_CONTEXT_DETAIL_CHARS,
        context_chat_chars=defaults.DEFAULT_CONTEXT_CHAT_CHARS,
        suggestion_temperature=defaults.DEFAULT_SUGGESTION_TEMPERATURE,
        chat_temperature=defaults.DEFAULT_CHAT_TEMPERATURE,
    )
    return DefaultsResponse(
        groq_base_url=defaults.GROQ_BASE_URL,
        transcribe_model=defaults.TRANSCRIBE_MODEL,
        chat_model=defaults.CHAT_MODEL,
        settings=ps,
        default_strings={
            "live_suggestions_system": defaults.DEFAULT_LIVE_SUGGESTIONS_SYSTEM,
            "live_suggestions_user_template": defaults.DEFAULT_SUGGESTIONS_USER_TEMPLATE,
            "detail_system": defaults.DEFAULT_DETAIL_SYSTEM,
            "detail_user_template": defaults.DEFAULT_DETAIL_USER_TEMPLATE,
            "chat_system": defaults.DEFAULT_CHAT_SYSTEM,
        },
    )


@app.post("/api/transcribe")
async def transcribe(
    api_key: Annotated[str, Depends(extract_groq_api_key)],
    audio: UploadFile = File(...),
) -> dict[str, str]:
    raw = await audio.read()
    if len(raw) < 32:
        raise HTTPException(400, "Audio chunk too small")
    name = audio.filename or "chunk.webm"
    ctype = audio.content_type
    try:
        text = await groq_openai.transcribe_audio(api_key, raw, name, ctype)
    except RuntimeError as e:
        raise HTTPException(502, str(e)) from e
    return {"text": text}


@app.post("/api/suggestions")
async def suggestions(
    api_key: Annotated[str, Depends(extract_groq_api_key)],
    body: SuggestionsRequest,
) -> dict:
    try:
        out = await groq_openai.generate_suggestions(
            api_key, body.transcript, body.settings
        )
    except RuntimeError as e:
        raise HTTPException(502, str(e)) from e
    except ValidationError as e:
        raise HTTPException(502, f"Invalid model output: {e}") from e
    return out.model_dump()


def _sse_token_stream(async_gen):
    async def _gen():
        try:
            async for piece in async_gen:
                yield f"data: {json.dumps({'t': piece})}\n\n"
            yield "data: [DONE]\n\n"
        except RuntimeError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return _gen()


@app.post("/api/expand-stream")
async def expand_stream(
    api_key: Annotated[str, Depends(extract_groq_api_key)],
    body: ExpandSuggestionRequest,
):
    agen = groq_openai.expand_suggestion_stream(
        api_key,
        body.transcript,
        body.suggestion_type,
        body.suggestion_title,
        body.suggestion_preview,
        body.settings,
    )
    return StreamingResponse(
        _sse_token_stream(agen),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/chat-stream")
async def chat_stream(
    api_key: Annotated[str, Depends(extract_groq_api_key)],
    body: ChatStreamRequest,
):
    msgs = [m.model_dump() for m in body.messages]
    agen = groq_openai.chat_stream(api_key, msgs, body.transcript, body.settings)
    return StreamingResponse(
        _sse_token_stream(agen),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
