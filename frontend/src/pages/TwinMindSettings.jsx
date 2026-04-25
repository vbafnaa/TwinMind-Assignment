import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDefaults } from "../twinmind/api";
import {
  loadTwinMindSettings,
  saveTwinMindSettings,
} from "../twinmind/storage";

const emptyPrompts = () => ({
  live_suggestions_system: "",
  live_suggestions_user_template: "",
  detail_system: "",
  detail_user_template: "",
  chat_system: "",
});

export default function TwinMindSettings() {
  const [apiKey, setApiKey] = useState("");
  const [prompts, setPrompts] = useState(emptyPrompts);
  const [contextSuggestionsChars, setContextSuggestionsChars] = useState(14000);
  const [contextDetailChars, setContextDetailChars] = useState(100000);
  const [contextChatChars, setContextChatChars] = useState(24000);
  const [suggestionTemperature, setSuggestionTemperature] = useState(0.55);
  const [chatTemperature, setChatTemperature] = useState(0.45);
  const [models, setModels] = useState({ transcribe: "", chat: "" });
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchDefaults();
        if (cancelled) return;
        setModels({ transcribe: d.transcribe_model, chat: d.chat_model });
        const saved = loadTwinMindSettings();
        const p = saved?.prompts || {};
        setPrompts({
          live_suggestions_system:
            p.live_suggestions_system ?? d.default_strings.live_suggestions_system,
          live_suggestions_user_template:
            p.live_suggestions_user_template ??
            d.default_strings.live_suggestions_user_template,
          detail_system: p.detail_system ?? d.default_strings.detail_system,
          detail_user_template:
            p.detail_user_template ?? d.default_strings.detail_user_template,
          chat_system: p.chat_system ?? d.default_strings.chat_system,
        });
        if (saved?.apiKey) setApiKey(saved.apiKey);
        setContextSuggestionsChars(
          saved?.context_suggestions_chars ??
            d.settings.context_suggestions_chars ??
            14000
        );
        setContextDetailChars(
          saved?.context_detail_chars ?? d.settings.context_detail_chars ?? 100000
        );
        setContextChatChars(
          saved?.context_chat_chars ?? d.settings.context_chat_chars ?? 24000
        );
        setSuggestionTemperature(
          saved?.suggestion_temperature ??
            d.settings.suggestion_temperature ??
            0.55
        );
        setChatTemperature(
          saved?.chat_temperature ?? d.settings.chat_temperature ?? 0.45
        );
      } catch (e) {
        if (!cancelled) setErr(String(e.message || e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = () => {
    saveTwinMindSettings({
      apiKey,
      prompts,
      context_suggestions_chars: Number(contextSuggestionsChars),
      context_detail_chars: Number(contextDetailChars),
      context_chat_chars: Number(contextChatChars),
      suggestion_temperature: Number(suggestionTemperature),
      chat_temperature: Number(chatTemperature),
    });
    setStatus("Saved to this browser.");
    setTimeout(() => setStatus(""), 2500);
  };

  const field = (label, key, rows = 8) => (
    <label className="block mb-6">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
        rows={rows}
        value={prompts[key]}
        onChange={(e) => setPrompts({ ...prompts, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            to="/twinmind"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            ← Back to live session
          </Link>
          <span className="text-sm font-bold tracking-tight text-slate-800">
            TwinMind · Settings
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {err && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Could not load defaults from API ({err}). Defaults shown may be
            incomplete — ensure the Python backend is running on port 8000 or
            set REACT_APP_API_URL.
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Groq API key</h1>
          <p className="mt-1 text-sm text-slate-600">
            Stored only in your browser localStorage. Never committed to git.
          </p>
          <input
            type="password"
            autoComplete="off"
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="gsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Models (fixed)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Assignment: Whisper Large V3 for ASR,{" "}
            <code className="rounded bg-slate-100 px-1">openai/gpt-oss-120b</code>{" "}
            for reasoning. Keys are sent per request from this app; backend
            proxies Groq only.
          </p>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Transcription</dt>
              <dd className="font-mono text-slate-800">{models.transcribe || "…"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Chat & suggestions</dt>
              <dd className="font-mono text-slate-800">{models.chat || "…"}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Context windows</h2>
          <p className="mt-1 text-sm text-slate-600">
            Number of characters taken from the end of the full transcript for
            each call.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Live suggestions</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={contextSuggestionsChars}
                onChange={(e) => setContextSuggestionsChars(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Expanded answer</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={contextDetailChars}
                onChange={(e) => setContextDetailChars(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Chat + transcript</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={contextChatChars}
                onChange={(e) => setContextChatChars(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">
                Suggestion temperature
              </span>
              <input
                type="number"
                step="0.05"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={suggestionTemperature}
                onChange={(e) => setSuggestionTemperature(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Chat temperature</span>
              <input
                type="number"
                step="0.05"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={chatTemperature}
                onChange={(e) => setChatTemperature(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Prompts</h2>
          <p className="mt-1 text-sm text-slate-600 mb-4">
            User template for live suggestions must include{" "}
            <code className="rounded bg-slate-100 px-1">{"{transcript_tail}"}</code>{" "}
            and <code className="rounded bg-slate-100 px-1">{"{utc_hint}"}</code>.
            Detail user template:{" "}
            <code className="rounded bg-slate-100 px-1">{"{transcript_context}"}</code>,{" "}
            <code className="rounded bg-slate-100 px-1">{"{suggestion_type}"}</code>,{" "}
            <code className="rounded bg-slate-100 px-1">{"{suggestion_title}"}</code>,{" "}
            <code className="rounded bg-slate-100 px-1">{"{suggestion_preview}"}</code>.
          </p>
          {field("Live suggestions — system", "live_suggestions_system", 12)}
          {field(
            "Live suggestions — user template",
            "live_suggestions_user_template",
            6
          )}
          {field("Expanded answer — system", "detail_system", 10)}
          {field("Expanded answer — user template", "detail_user_template", 6)}
          {field("Free chat — system", "chat_system", 8)}
        </section>

        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700"
          >
            Save settings
          </button>
          {status && <span className="text-sm text-emerald-700">{status}</span>}
        </div>
      </main>
    </div>
  );
}
