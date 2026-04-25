import React from "react";
import Navbar from "../components/Navbar";
import Statement from "../components/Statement";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-100 via-white to-indigo-50/60">
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Statement />
      </main>
    </div>
  );
}
