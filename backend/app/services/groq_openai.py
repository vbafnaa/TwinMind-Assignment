from __future__ import annotations

import json
from io import BytesIO
from typing import AsyncIterator, List, Optional

from openai import AsyncOpenAI
from openai import APIError

from app import defaults
from app.schemas import PromptSettings, SuggestionsResponse
from app.util_text import tail_chars


def client_for_key(api_key: str) -> AsyncOpenAI:
    return AsyncOpenAI(api_key=api_key, base_url=defaults.GROQ_BASE_URL)


def merge_settings(ps: Optional[PromptSettings]) -> PromptSettings:
    return ps or PromptSettings()


async def transcribe_audio(
    api_key: str,
    audio_bytes: bytes,
    filename: str,
    _content_type: Optional[str] = None,
) -> str:
    client = client_for_key(api_key)
    buf = BytesIO(audio_bytes)
    buf.name = filename or "audio.webm"
    try:
        tr = await client.audio.transcriptions.create(
            file=buf,
            model=defaults.TRANSCRIBE_MODEL,
            temperature=0,
        )
    except APIError as e:
        raise RuntimeError(getattr(e, "message", None) or str(e)) from e
    text = getattr(tr, "text", None) or ""
    return text.strip()


async def generate_suggestions(
    api_key: str,
    full_transcript: str,
    settings: Optional[PromptSettings],
) -> SuggestionsResponse:
    s = merge_settings(settings)
    ctx = s.context_suggestions_chars or defaults.DEFAULT_CONTEXT_SUGGESTIONS_CHARS
    tail = tail_chars(full_transcript, ctx)
    system = s.live_suggestions_system or defaults.DEFAULT_LIVE_SUGGESTIONS_SYSTEM
    tmpl = s.live_suggestions_user_template or defaults.DEFAULT_SUGGESTIONS_USER_TEMPLATE
    from datetime import datetime, timezone

    user = tmpl.format(
        transcript_tail=tail,
        utc_hint=datetime.now(timezone.utc).isoformat(),
    )
    temp = (
        s.suggestion_temperature
        if s.suggestion_temperature is not None
        else defaults.DEFAULT_SUGGESTION_TEMPERATURE
    )
    client = client_for_key(api_key)
    try:
        completion = await client.chat.completions.create(
            model=defaults.CHAT_MODEL,
            temperature=temp,
            max_tokens=1200,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
    except APIError as e:
        raise RuntimeError(getattr(e, "message", None) or str(e)) from e
    raw = completion.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Model returned non-JSON: {raw[:500]}") from e
    items = data.get("suggestions")
    if not isinstance(items, list):
        raise RuntimeError("JSON missing 'suggestions' array")

    allowed = {"question", "talking_point", "answer", "fact_check", "clarify"}

    def normalize_type(raw: object) -> str:
        t = str(raw or "").lower().strip().replace(" ", "_").replace("-", "_")
        if t in allowed:
            return t
        if t in ("factcheck", "fact_checking"):
            return "fact_check"
        if t in ("talkingpoint", "point"):
            return "talking_point"
        return "clarify"

    cleaned: List[dict] = []
    for it in items[:5]:
        if not isinstance(it, dict):
            continue
        cleaned.append(
            {
                "type": normalize_type(it.get("type")),
                "preview": str(it.get("preview", "")).strip() or "…",
                "title": str(it.get("title", "")).strip() or "Suggestion",
            }
        )
        if len(cleaned) == 3:
            break
    if len(cleaned) < 3:
        raise RuntimeError("Model returned fewer than 3 usable suggestions")
    return SuggestionsResponse.model_validate({"suggestions": cleaned})


async def expand_suggestion_stream(
    api_key: str,
    full_transcript: str,
    suggestion_type: str,
    suggestion_title: str,
    suggestion_preview: str,
    settings: Optional[PromptSettings],
) -> AsyncIterator[str]:
    s = merge_settings(settings)
    ctx = s.context_detail_chars or defaults.DEFAULT_CONTEXT_DETAIL_CHARS
    transcript_ctx = tail_chars(full_transcript, ctx)
    system = s.detail_system or defaults.DEFAULT_DETAIL_SYSTEM
    tmpl = s.detail_user_template or defaults.DEFAULT_DETAIL_USER_TEMPLATE
    user = tmpl.format(
        transcript_context=transcript_ctx,
        suggestion_type=suggestion_type,
        suggestion_title=suggestion_title,
        suggestion_preview=suggestion_preview,
    )
    temp = (
        s.chat_temperature
        if s.chat_temperature is not None
        else defaults.DEFAULT_CHAT_TEMPERATURE
    )
    client = client_for_key(api_key)
    try:
        stream = await client.chat.completions.create(
            model=defaults.CHAT_MODEL,
            temperature=temp,
            max_tokens=4096,
            stream=True,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
    except APIError as e:
        raise RuntimeError(getattr(e, "message", None) or str(e)) from e
    async for event in stream:
        delta = event.choices[0].delta.content or ""
        if delta:
            yield delta


async def chat_stream(
    api_key: str,
    messages: list[dict],
    transcript: str,
    settings: Optional[PromptSettings],
) -> AsyncIterator[str]:
    s = merge_settings(settings)
    ctx = s.context_chat_chars or defaults.DEFAULT_CONTEXT_CHAT_CHARS
    transcript_tail = tail_chars(transcript, ctx)
    system = s.chat_system or defaults.DEFAULT_CHAT_SYSTEM
    system_full = (
        f"{system}\n\n---\nLIVE TRANSCRIPT CONTEXT (may truncate):\n{transcript_tail}\n---"
    )
    temp = (
        s.chat_temperature
        if s.chat_temperature is not None
        else defaults.DEFAULT_CHAT_TEMPERATURE
    )
    client = client_for_key(api_key)
    payload = [{"role": "system", "content": system_full}, *messages]
    try:
        stream = await client.chat.completions.create(
            model=defaults.CHAT_MODEL,
            temperature=temp,
            max_tokens=4096,
            stream=True,
            messages=payload,
        )
    except APIError as e:
        raise RuntimeError(getattr(e, "message", None) or str(e)) from e
    async for event in stream:
        delta = event.choices[0].delta.content or ""
        if delta:
            yield delta
