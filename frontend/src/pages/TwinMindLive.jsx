import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  fetchSuggestions,
  postChatStream,
  postExpandStream,
  transcribeChunk,
} from "../twinmind/api";
import { consumeSseTokens } from "../twinmind/sse";
import {
  buildPromptPayload,
  loadTwinMindSettings,
} from "../twinmind/storage";
import { ChatMarkdown } from "../twinmind/ChatMarkdown";

function formatRecordingTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function uid() {
  return window.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random()}`;
}

function pickMime() {
  const c = "audio/webm;codecs=opus";
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c))
    return c;
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm"))
    return "audio/webm";
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/mp4"))
    return "audio/mp4";
  return "audio/webm";
}

/** Filename extension for Groq (expects complete media files, not timeslice fragments). */
function extForMime(mime) {
  const m = (mime || "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4")) return "mp4";
  return "webm";
}

export default function TwinMindLive() {
  const promptPayloadRef = useRef(null);
  const transcriptRef = useRef("");
  const messagesRef = useRef([]);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);

  const [recording, setRecording] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState([]);
  const [fullTranscript, setFullTranscript] = useState("");
  const [suggestionBatches, setSuggestionBatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const [busyTranscribe, setBusyTranscribe] = useState(false);
  const [busySuggest, setBusySuggest] = useState(false);
  const [error, setError] = useState("");
  /** Wall-clock seconds while mic session is active (Start → Stop). */
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);
  const recordingStartedAtRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  /** True while user wants continuous 15s segment capture. */
  const recordingActiveRef = useRef(false);
  /** Fires after 15s to stop current segment (complete file for Whisper). */
  const segmentStopTimerRef = useRef(null);
  const suggestLockRef = useRef(false);
  const transcriptEndRef = useRef(null);

  const reloadLocalSettings = useCallback(() => {
    const s = loadTwinMindSettings();
    promptPayloadRef.current = buildPromptPayload(s);
  }, []);

  useEffect(() => {
    reloadLocalSettings();
  }, [reloadLocalSettings]);

  useEffect(() => {
    const onFocus = () => reloadLocalSettings();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadLocalSettings]);

  useEffect(() => {
    transcriptRef.current = fullTranscript;
  }, [fullTranscript]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines]);

  useEffect(() => {
    if (!recording) {
      setRecordingElapsedSec(0);
      recordingStartedAtRef.current = null;
      return;
    }
    recordingStartedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      if (!recordingStartedAtRef.current) return;
      setRecordingElapsedSec(
        Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [recording]);

  const runSuggestions = useCallback(async (reason) => {
    const stored = loadTwinMindSettings();
    const key = stored?.apiKey?.trim();
    promptPayloadRef.current = buildPromptPayload(stored);
    if (!key) {
      setError("Add your Groq API key in Settings.");
      return;
    }
    const text = transcriptRef.current.trim();
    if (!text) {
      if (reason === "manual") {
        setError("Transcript is empty — record some audio first.");
      }
      return;
    }
    if (suggestLockRef.current) return;
    suggestLockRef.current = true;
    setBusySuggest(true);
    setError("");
    try {
      const res = await fetchSuggestions(
        text,
        promptPayloadRef.current,
        key
      );
      const batch = {
        id: uid(),
        ts: new Date().toISOString(),
        reason,
        suggestions: res.suggestions || [],
      };
      setSuggestionBatches((prev) => [batch, ...prev]);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusySuggest(false);
      suggestLockRef.current = false;
    }
  }, []);

  const processAudioBlob = useCallback(
    async (blob, filename) => {
      const stored = loadTwinMindSettings();
      const key = stored?.apiKey?.trim();
      promptPayloadRef.current = buildPromptPayload(stored);
      if (!key) {
        setError("Add your Groq API key in Settings.");
        return;
      }
      if (blob.size < 64) return;
      setBusyTranscribe(true);
      setError("");
      try {
        const { text } = await transcribeChunk(
          blob,
          filename || "segment.webm",
          key
        );
        const trimmed = (text || "").trim();
        if (trimmed) {
          const line = {
            id: uid(),
            ts: new Date().toISOString(),
            text: trimmed,
          };
          setTranscriptLines((prev) => [...prev, line]);
          setFullTranscript((prev) =>
            prev ? `${prev}\n\n${trimmed}` : trimmed
          );
        }
        await runSuggestions("interval");
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setBusyTranscribe(false);
      }
    },
    [runSuggestions]
  );

  const stopRecording = useCallback(() => {
    recordingActiveRef.current = false;
    if (segmentStopTimerRef.current != null) {
      clearTimeout(segmentStopTimerRef.current);
      segmentStopTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRecording(false);
  }, []);

  /**
   * One complete segment: record ~15s, stop → single Blob (valid WebM/MP4).
   * Timeslice blobs are often invalid for ASR; segmented files are not.
   */
  const beginSegmentRecorder = useCallback(() => {
    if (!recordingActiveRef.current) return;
    const stream = streamRef.current;
    if (!stream) return;

    const mime = pickMime();
    const chunks = [];
    let mr;
    try {
      mr = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      try {
        mr = new MediaRecorder(stream);
      } catch (e) {
        setError(String(e.message || e));
        stopRecording();
        return;
      }
    }

    mediaRecorderRef.current = mr;

    mr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    mr.onstop = () => {
      const blob = new Blob(chunks, { type: mr.mimeType || mime });
      const ext = extForMime(mr.mimeType || mime);
      if (blob.size > 64) {
        void processAudioBlob(blob, `segment-${Date.now()}.${ext}`);
      }
      if (recordingActiveRef.current) {
        window.setTimeout(() => beginSegmentRecorder(), 0);
      }
    };

    mr.onerror = () => setError("Microphone recorder error.");

    try {
      mr.start();
    } catch (e) {
      setError(String(e.message || e));
      stopRecording();
      return;
    }

    segmentStopTimerRef.current = window.setTimeout(() => {
      segmentStopTimerRef.current = null;
      if (mr.state === "recording") {
        try {
          mr.stop();
        } catch {
          /* ignore */
        }
      }
    }, 15000);
  }, [processAudioBlob, stopRecording]);

  const startRecording = async () => {
    reloadLocalSettings();
    setError("");
    const stored = loadTwinMindSettings();
    if (!stored?.apiKey?.trim()) {
      setError("Add your Groq API key in Settings first.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordingActiveRef.current = true;
      setSessionStartedAt((t) => t || new Date().toISOString());
      setRecording(true);
      beginSegmentRecorder();
    } catch (e) {
      setError(
        e?.name === "NotAllowedError"
          ? "Microphone permission denied."
          : String(e.message || e)
      );
    }
  };

  useEffect(() => {
    return () => stopRecording();
  }, [stopRecording]);

  const manualRefresh = async () => {
    reloadLocalSettings();
    await runSuggestions("manual");
  };

  const finalizeLastAssistant = () => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        next[next.length - 1] = { ...last, streaming: false };
      }
      return next;
    });
  };

  const onSuggestionClick = async (s) => {
    reloadLocalSettings();
    const key = loadTwinMindSettings()?.apiKey?.trim();
    if (!key) {
      setError("Add your Groq API key in Settings.");
      return;
    }
    const userLine = `**${s.title}** (${s.type})\n${s.preview}`;
    const userMsg = {
      id: uid(),
      role: "user",
      content: userLine,
      ts: new Date().toISOString(),
    };
    const asstMsg = {
      id: uid(),
      role: "assistant",
      content: "",
      ts: new Date().toISOString(),
      streaming: true,
    };
    setMessages((prev) => [...prev.filter((m) => !m.streaming), userMsg, asstMsg]);
    setError("");
    try {
      const res = await postExpandStream(
        {
          transcript: transcriptRef.current,
          suggestion_type: s.type,
          suggestion_title: s.title,
          suggestion_preview: s.preview,
          settings: promptPayloadRef.current,
        },
        key
      );
      await consumeSseTokens(res, (tok) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && last.streaming) {
            next[next.length - 1] = {
              ...last,
              content: last.content + tok,
            };
          }
          return next;
        });
      });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      finalizeLastAssistant();
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    reloadLocalSettings();
    const key = loadTwinMindSettings()?.apiKey?.trim();
    if (!key) {
      setError("Add your Groq API key in Settings.");
      return;
    }
    const base = messagesRef.current.filter((m) => !m.streaming);
    const hist = [
      ...base.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];
    const userMsg = {
      id: uid(),
      role: "user",
      content: text,
      ts: new Date().toISOString(),
    };
    const asstMsg = {
      id: uid(),
      role: "assistant",
      content: "",
      ts: new Date().toISOString(),
      streaming: true,
    };
    setMessages((prev) => [...prev.filter((m) => !m.streaming), userMsg, asstMsg]);
    setChatInput("");
    setError("");
    try {
      const res = await postChatStream(
        {
          messages: hist,
          transcript: transcriptRef.current,
          settings: promptPayloadRef.current,
        },
        key
      );
      await consumeSseTokens(res, (tok) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && last.streaming) {
            next[next.length - 1] = {
              ...last,
              content: last.content + tok,
            };
          }
          return next;
        });
      });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      finalizeLastAssistant();
    }
  };

  const exportSession = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      sessionStartedAt,
      transcriptLines,
      fullTranscript,
      suggestionBatches,
      chatMessages: messages.filter((m) => !m.streaming),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `twinmind-session-${dayjs().format("YYYY-MM-DD-HHmmss")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const typeStyle = (t) => {
    const map = {
      question: "bg-violet-50 text-violet-800 ring-violet-200",
      talking_point: "bg-sky-50 text-sky-800 ring-sky-200",
      answer: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      fact_check: "bg-amber-50 text-amber-900 ring-amber-200",
      clarify: "bg-slate-100 text-slate-800 ring-slate-200",
    };
    return map[t] || "bg-slate-50 text-slate-800 ring-slate-200";
  };

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="z-20 shrink-0 border-b border-slate-800 bg-[#0f172a] text-white shadow-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="text-lg font-bold tracking-tight text-white hover:text-indigo-200"
            >
              TwinMind
            </Link>
            <span className="hidden text-xs text-slate-400 sm:inline">
              Live session
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportSession}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
            >
              Export session
            </button>
            <Link
              to="/twinmind/settings"
              className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400"
            >
              Settings
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <div className="shrink-0 border-b border-red-100 bg-red-50/95 px-4 py-2">
          <div className="mx-auto max-w-[1600px] text-sm text-red-800">{error}</div>
        </div>
      )}

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Transcript */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-slate-200 bg-white lg:w-[34%] lg:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Transcript
            </h2>
            <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
              {recording && (
                <span
                  className="tabular-nums text-xs font-semibold text-indigo-600"
                  title="Recording time this session"
                >
                  {formatRecordingTime(recordingElapsedSec)}
                </span>
              )}
              {busyTranscribe && (
                <span className="text-xs text-slate-500">Transcribing…</span>
              )}
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`rounded-full px-4 py-1.5 text-xs font-bold shadow ${
                  recording
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                }`}
              >
                {recording ? "Stop mic" : "Start mic"}
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 text-sm leading-relaxed">
            {transcriptLines.length === 0 && (
              <p className="text-slate-500">
                Click <strong>Start mic</strong>. Audio is captured in{" "}
                <strong>15-second segments</strong> (each file is a complete
                WebM/MP4 clip for Whisper). Text appears after each segment.
              </p>
            )}
            {transcriptLines.map((ln) => (
              <div key={ln.id} className="mb-4 border-b border-slate-100 pb-3">
                <div className="mb-1 text-xs font-medium text-slate-400">
                  {dayjs(ln.ts).format("HH:mm:ss")}
                </div>
                <p className="text-slate-800">{ln.text}</p>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </section>

        {/* Suggestions */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-slate-200 bg-slate-50 lg:w-[33%] lg:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Live suggestions
            </h2>
            <button
              type="button"
              onClick={manualRefresh}
              disabled={busySuggest}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {busySuggest ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {busySuggest && suggestionBatches.length === 0 && (
              <p className="px-1 text-sm text-slate-500">Generating suggestions…</p>
            )}
            {suggestionBatches.map((batch) => (
              <div key={batch.id} className="mb-6">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-500">
                    {dayjs(batch.ts).format("HH:mm:ss")} · {batch.reason}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {(batch.suggestions || []).map((s, idx) => (
                    <button
                      key={`${batch.id}-${idx}`}
                      type="button"
                      onClick={() => onSuggestionClick(s)}
                      className={`rounded-xl p-3 text-left shadow-sm ring-1 ring-inset transition hover:shadow-md ${typeStyle(
                        s.type
                      )}`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                          {s.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {s.title}
                      </div>
                      <p className="mt-1 text-sm leading-snug text-slate-800">
                        {s.preview}
                      </p>
                      <span className="mt-2 inline-block text-xs font-semibold text-indigo-700">
                        Tap for detail →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Chat */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white lg:w-[33%]">
          <div className="shrink-0 border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Chat
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Ask anything about this session. Suggestion clicks stream a deeper
              answer with full transcript context.
            </p>
          </div>
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 text-sm">
            {messages.length === 0 && (
              <p className="text-slate-500">
                Try:{" "}
                <em>
                  &quot;What should I push back on based on the last few
                  minutes?&quot;
                </em>
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[min(100%,28rem)] min-w-0 rounded-2xl px-3 py-2 ${
                  m.role === "user"
                    ? "ml-auto w-fit bg-indigo-600 text-white"
                    : "mr-auto w-full max-w-full bg-slate-100 text-slate-900"
                }`}
              >
                <div className="mb-1 text-[10px] font-medium opacity-70">
                  {dayjs(m.ts).format("HH:mm:ss")} · {m.role}
                </div>
                {m.role === "assistant" ? (
                  <div className="min-w-0 max-w-full overflow-hidden leading-relaxed">
                    <ChatMarkdown inverted={false}>{m.content}</ChatMarkdown>
                    {m.streaming && (
                      <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-indigo-600 align-middle" />
                    )}
                  </div>
                ) : (
                  <div className="min-w-0 max-w-full overflow-hidden leading-relaxed">
                    <ChatMarkdown inverted>{m.content}</ChatMarkdown>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="shrink-0 border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Ask anything…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void sendChat()}
                className="rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
