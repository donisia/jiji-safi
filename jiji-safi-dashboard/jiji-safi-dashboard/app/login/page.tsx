"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, Database, KeyRound, Sparkles, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("safitrack2024");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please provide an authority username or badge ID");
      return;
    }
    login(username, password);
    router.push("/");
  };

  const handleQuickDemo = () => {
    login("admin", "safitrack2024");
    router.push("/");
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-emerald-400 text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20 mb-3">
            JS
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Jiji Safi Waste Command
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Municipal Authority Portal & Carbon Intelligence Dashboard
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Authority ID / Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              placeholder="e.g. nms_inspector_04"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Access Token / Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Sign In to Dashboard
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-2 text-slate-500 font-mono text-[10px]">
              Or Hackathon Fast-Track
            </span>
          </div>
        </div>

        <button
          onClick={handleQuickDemo}
          className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-emerald-400 font-semibold text-xs border border-emerald-500/30 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          One-Click Demo Inspector Login
        </button>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Database className="w-3 h-3 text-red-400" />
            Oracle APEX Cloud Connected
          </span>
          <span>Version 2.4-Hackathon</span>
        </div>
      </div>
    </div>
  );
}
