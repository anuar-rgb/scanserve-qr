"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useBranch } from "@/lib/branch-context";

interface Props {
  expanded?: boolean;
}

export function BranchSelector({ expanded = true }: Props) {
  const { branches, selectedId, setSelectedId, isMultiBranch } = useBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!isMultiBranch) return null;

  const currentBranch = selectedId === "all" ? null : branches.find((b) => b.id === selectedId);
  const label = selectedId === "all" ? "Все филиалы" : (currentBranch?.name ?? "Филиал");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors whitespace-nowrap ${
          expanded ? "" : "justify-center"
        }`}
        title={expanded ? undefined : label}
      >
        <Building2 size={13} className="shrink-0" />
        {expanded && (
          <>
            <span className="flex-1 text-left truncate max-w-[120px]">{label}</span>
            <ChevronDown size={11} className="shrink-0 opacity-60" />
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
          style={{ maxHeight: 260, overflowY: "auto" }}
        >
          <button
            onClick={() => { setSelectedId("all"); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <span className="w-3 shrink-0">
              {selectedId === "all" && <Check size={11} className="text-violet-600" />}
            </span>
            <span className="font-medium">Все филиалы</span>
          </button>
          <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-2" />
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => { setSelectedId(b.id); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="w-3 shrink-0">
                {selectedId === b.id && <Check size={11} className="text-violet-600" />}
              </span>
              <span className="truncate">{b.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
