"""Build CORS allow_origins from env + local dev defaults."""

from __future__ import annotations

import os

_DEFAULT_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def cors_allow_origins() -> list[str]:
    """
    ALLOWED_ORIGINS: comma-separated list of browser origins (no trailing slash),
    e.g. https://myapp.netlify.app,https://www.example.com

    Local dev defaults are always included so CRA proxy + npm start keep working.
    """
    raw = os.environ.get("ALLOWED_ORIGINS", "").strip()
    extra = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    seen: set[str] = set()
    out: list[str] = []
    for o in _DEFAULT_DEV_ORIGINS + extra:
        if o not in seen:
            seen.add(o)
            out.append(o)
    return out
