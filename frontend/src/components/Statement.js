import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Statement() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-indigo-600">
        Live meeting copilot
      </p>
      <h1 className="mt-3 text-center text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
        TwinMind
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-600">
        Live audio → transcript, three contextual suggestions on each refresh, and
        a copilot chat that streams answers grounded in what was said.
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button
          type="button"
          className="w-full rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-500 sm:w-auto"
          onClick={() => navigate("/twinmind")}
        >
          Open live session
        </button>
        <Link
          to="/twinmind/settings"
          className="w-full rounded-xl border border-slate-300 bg-white px-8 py-3 text-center text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 sm:w-auto"
        >
          Settings &amp; API key
        </Link>
      </div>
      <p className="mt-10 text-center text-sm text-slate-600">
        <button
          type="button"
          className="font-semibold text-indigo-600 hover:text-indigo-800"
          onClick={() => navigate("/Login")}
        >
          Sign in
        </button>
        <span className="mx-2 text-slate-400">·</span>
        <button
          type="button"
          className="font-semibold text-indigo-600 hover:text-indigo-800"
          onClick={() => navigate("/Signup")}
        >
          Create account
        </button>
      </p>
    </div>
  );
}
