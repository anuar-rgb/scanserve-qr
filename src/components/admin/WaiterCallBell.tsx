"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bell, CheckCircle, X } from "lucide-react";
import { useWaiterCalls } from "@/lib/waiter-call-context";

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const ACTION_LABEL: Record<string, string> = {
  clean: "Убрать со стола",
  bill:  "Принесите счёт",
  come:  "Подойдите к столу",
};

const POPUP_W = 288; // w-72
const MARGIN  = 16;

export function WaiterCallBell() {
  const { calls, pendingCount, resolveCall } = useWaiterCalls();
  const [open, setOpen]         = useState(false);
  const ref                     = useRef<HTMLDivElement>(null);
  const buttonRef               = useRef<HTMLButtonElement>(null);
  const [pos, setPos]           = useState<{ top: number; right: number } | null>(null);
  const hasCalls = pendingCount > 0;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Compute viewport-safe position from the button's bounding rect
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) { setPos(null); return; }
    const r   = buttonRef.current.getBoundingClientRect();
    const vw  = window.innerWidth;
    // Ideally align popup's right edge with button's right edge
    const idealRight  = vw - r.right;
    // Clamp so popup never overflows either viewport edge
    const clampedRight = Math.max(MARGIN, Math.min(idealRight, vw - POPUP_W - MARGIN));
    setPos({ top: r.bottom + 8, right: clampedRight });
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        title="Вызовы официанта"
        className={`relative p-2 rounded-lg transition-colors ${
          hasCalls
            ? "text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20"
            : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
      >
        <Bell size={16} className={hasCalls ? "animate-bounce" : ""} />

        {hasCalls && (
          <span className="absolute -top-0.5 -right-0.5">
            <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 items-center justify-center">
              <span className="text-white text-[8px] font-bold leading-none">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            </span>
          </span>
        )}
      </button>

      {/* Dropdown — fixed to viewport, position derived from button rect */}
      {open && pos && (
        <div
          style={{ position: "fixed", top: pos.top, right: pos.right, width: POPUP_W, zIndex: 9999 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Bell size={13} className={hasCalls ? "text-red-500" : "text-zinc-400"} />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Вызовы официанта
              </span>
              {hasCalls && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {pendingCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded"
            >
              <X size={13} />
            </button>
          </div>

          {/* Call list */}
          {calls.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 dark:text-zinc-500 py-8">
              Нет активных вызовов
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {calls.map(call => (
                <div key={call.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {call.table_label}
                      </span>
                      <span className="shrink-0 text-[9px] text-zinc-400 dark:text-zinc-500">
                        {formatTime(call.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {ACTION_LABEL[call.action] ?? call.action}
                    </p>
                  </div>

                  <button
                    onClick={() => resolveCall(call.id)}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                  >
                    <CheckCircle size={11} />
                    Принять
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
