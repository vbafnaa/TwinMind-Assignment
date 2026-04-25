from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException


def extract_groq_api_key(
    x_groq_api_key: Optional[str] = Header(None, alias="X-Groq-Api-Key"),
    authorization: Optional[str] = Header(None),
) -> str:
    if x_groq_api_key and x_groq_api_key.strip():
        return x_groq_api_key.strip()
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if token:
            return token
    raise HTTPException(
        status_code=401,
        detail="Missing Groq API key. Send header X-Groq-Api-Key or Authorization: Bearer <key>.",
    )
