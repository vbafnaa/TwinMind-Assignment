import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("flag"));

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.setItem("flag", "");
    localStorage.setItem("access_token", "");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <nav
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3"
        aria-label="Main"
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          TwinMind
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            onClick={() => navigate("/twinmind")}
          >
            Live session
          </button>
          <Link
            to="/twinmind/settings"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Settings
          </Link>
          {!isLoggedIn ? (
            <>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                onClick={() => navigate("/Signup")}
              >
                Sign up
              </button>
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
                onClick={() => navigate("/Login")}
              >
                Log in
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              onClick={handleLogout}
            >
              Log out
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
