"use client";

import { useState, useCallback } from "react";
import { RefreshCw, ExternalLink, Smartphone } from "lucide-react";

const PAGES = [
  { label: "Ас Төрі — меню", path: "/as-tori" },
];

export default function PreviewPage() {
  const [selectedPath, setSelectedPath] = useState(PAGES[0].path);
  const [frameKey, setFrameKey]         = useState(0);

  const refresh = useCallback(() => setFrameKey((k) => k + 1), []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-5 pb-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Smartphone size={22} className="text-violet-500" />
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Предпросмотр</h1>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                Клиентский вид · симулятор смартфона
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Page selector */}
            <select
              value={selectedPath}
              onChange={(e) => { setSelectedPath(e.target.value); setFrameKey((k) => k + 1); }}
              className="text-sm px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 outline-none cursor-pointer"
            >
              {PAGES.map((p) => (
                <option key={p.path} value={p.path}>{p.label}</option>
              ))}
            </select>

            <button
              onClick={refresh}
              title="Обновить"
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
            >
              <RefreshCw size={16} />
            </button>

            <a
              href={selectedPath}
              target="_blank"
              rel="noopener noreferrer"
              title="Открыть в новой вкладке"
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </div>

      {/* ── Phone frame area ─────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto flex items-start justify-center py-8 px-4"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.06) 0%, transparent 70%), var(--tw-bg-opacity, 1)" }}
      >
        <div
          style={{
            /* Outer phone body */
            width: 390,
            flexShrink: 0,
            background: "linear-gradient(160deg, #323232 0%, #1a1a1a 100%)",
            borderRadius: 52,
            padding: "14px 12px",
            boxShadow: [
              "0 0 0 1.5px #404040",
              "0 0 0 3px #111",
              "0 40px 100px rgba(0,0,0,0.55)",
              "0 10px 30px rgba(0,0,0,0.35)",
              "inset 0 1px 0 rgba(255,255,255,0.09)",
            ].join(", "),
            position: "relative",
          }}
        >
          {/* Volume up */}
          <div style={{ position: "absolute", left: -3.5, top: 152, width: 3.5, height: 30, background: "#2c2c2c", borderRadius: "2px 0 0 2px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }} />
          <div style={{ position: "absolute", left: -3.5, top: 194, width: 3.5, height: 30, background: "#2c2c2c", borderRadius: "2px 0 0 2px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }} />
          {/* Mute */}
          <div style={{ position: "absolute", left: -3.5, top: 116, width: 3.5, height: 22, background: "#2c2c2c", borderRadius: "2px 0 0 2px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }} />
          {/* Power */}
          <div style={{ position: "absolute", right: -3.5, top: 172, width: 3.5, height: 58, background: "#2c2c2c", borderRadius: "0 2px 2px 0", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }} />

          {/* Screen wrapper */}
          <div
            style={{
              width: "100%",
              height: 816,
              background: "#000",
              borderRadius: 40,
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {/* Status bar zone (time / battery icons sit here on real device) */}
            <div style={{ height: 14, flexShrink: 0 }} />

            {/* Dynamic Island */}
            <div style={{ position: "relative", height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div
                style={{
                  width: 126,
                  height: 34,
                  background: "#000",
                  borderRadius: 20,
                  boxShadow: "0 0 0 1.5px rgba(255,255,255,0.06)",
                }}
              />
            </div>

            {/* 4px gap between island and content */}
            <div style={{ height: 4, flexShrink: 0 }} />

            {/* Iframe — fills remaining space above home indicator */}
            <iframe
              key={frameKey}
              src={selectedPath}
              style={{
                flex: 1,
                width: "100%",
                border: "none",
                display: "block",
                minHeight: 0,
              }}
              title="Клиентский предпросмотр"
            />

            {/* Home indicator */}
            <div
              style={{
                height: 30,
                flexShrink: 0,
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 134,
                  height: 5,
                  background: "rgba(255,255,255,0.28)",
                  borderRadius: 99,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
