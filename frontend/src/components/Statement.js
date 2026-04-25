import React from "react";
import { useNavigate } from "react-router-dom";

export default function Statement() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="mx-auto max-w-2xl py-24 min-h-screen flex flex-col items-center px-4">
        <div className="text-center">
          <h1 className="text-6xl font-bold tracking-tight text-gray-900 sm:text-8xl">
            Railway Mitron
          </h1>
        </div>
        <div className="mt-16 flex flex-col items-center text-center max-w-md">
          <button
            type="button"
            className="flex justify-center items-center text-xl font-semibold leading-6 text-gray-200 py-3 px-12 bg-gradient-to-r bg-cover bg-center from-indigo-600 to-blue-600 hover:bg-blue-900 hover:animate-pulse rounded-md transition-all duration-150 ease-in-out border-2 border-blue-600"
            onClick={() => {
              navigate("/Assistant");
            }}
          >
            Information through chatbots
          </button>
          <span className="mt-2" aria-hidden="true">
            &uarr;
          </span>
          <p className="mt-4 text-lg font-bold tracking-tight text-gray-900">
            Open the chat assistant for real-time queries.
          </p>
        </div>
      </div>
    </div>
  );
}
