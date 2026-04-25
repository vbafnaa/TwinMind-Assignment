from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

SuggestionType = Literal["question", "talking_point", "answer", "fact_check", "clarify"]


class PromptSettings(BaseModel):
    live_suggestions_system: Optional[str] = None
    live_suggestions_user_template: Optional[str] = None
    detail_system: Optional[str] = None
    detail_user_template: Optional[str] = None
    chat_system: Optional[str] = None
    context_suggestions_chars: Optional[int] = Field(default=None, ge=500, le=200_000)
    context_detail_chars: Optional[int] = Field(default=None, ge=500, le=200_000)
    context_chat_chars: Optional[int] = Field(default=None, ge=500, le=200_000)
    suggestion_temperature: Optional[float] = Field(default=None, ge=0, le=1.5)
    chat_temperature: Optional[float] = Field(default=None, ge=0, le=1.5)


class SuggestionItem(BaseModel):
    type: SuggestionType
    preview: str = Field(..., min_length=4, max_length=1200)
    title: str = Field(..., min_length=2, max_length=120)


class SuggestionsResponse(BaseModel):
    suggestions: List[SuggestionItem] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactly three live suggestions",
    )


class SuggestionsRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=500_000)
    settings: Optional[PromptSettings] = None


class ExpandSuggestionRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=500_000)
    suggestion_type: SuggestionType
    suggestion_title: str
    suggestion_preview: str
    settings: Optional[PromptSettings] = None


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., max_length=200_000)


class ChatStreamRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1)
    transcript: str = Field(default="", max_length=500_000)
    settings: Optional[PromptSettings] = None

    @field_validator("messages")
    @classmethod
    def no_nested_system(cls, v: List[ChatMessage]) -> List[ChatMessage]:
        if any(m.role == "system" for m in v):
            raise ValueError("Do not send system messages; server builds system prompt.")
        return v


class DefaultsResponse(BaseModel):
    groq_base_url: str
    transcribe_model: str
    chat_model: str
    settings: PromptSettings
    default_strings: dict[str, str]
