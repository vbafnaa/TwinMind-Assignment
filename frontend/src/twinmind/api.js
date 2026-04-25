const API_BASE = process.env.REACT_APP_API_URL || "";

function headersJson(apiKey) {
  return {
    "Content-Type": "application/json",
    "X-Groq-Api-Key": apiKey,
  };
}

export async function fetchDefaults() {
  const r = await fetch(`${API_BASE}/api/defaults`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function transcribeChunk(blob, filename, apiKey) {
  const fd = new FormData();
  fd.append("audio", blob, filename || "chunk.webm");
  const r = await fetch(`${API_BASE}/api/transcribe`, {
    method: "POST",
    headers: { "X-Groq-Api-Key": apiKey },
    body: fd,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}

export async function fetchSuggestions(transcript, settings, apiKey) {
  const r = await fetch(`${API_BASE}/api/suggestions`, {
    method: "POST",
    headers: headersJson(apiKey),
    body: JSON.stringify({ transcript, settings }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function postExpandStream(body, apiKey) {
  return fetch(`${API_BASE}/api/expand-stream`, {
    method: "POST",
    headers: headersJson(apiKey),
    body: JSON.stringify(body),
  });
}

export async function postChatStream(body, apiKey) {
  return fetch(`${API_BASE}/api/chat-stream`, {
    method: "POST",
    headers: headersJson(apiKey),
    body: JSON.stringify(body),
  });
}
