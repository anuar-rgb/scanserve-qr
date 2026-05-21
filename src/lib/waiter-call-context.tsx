"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";

export interface WaiterCall {
  id: string;
  restaurant_id: string;
  table_label: string;
  action: string;
  status: string;
  created_at: string;
}

interface WaiterCallCtx {
  calls: WaiterCall[];
  pendingCount: number;
  resolveCall: (id: string) => Promise<void>;
}

const Ctx = createContext<WaiterCallCtx>({
  calls: [],
  pendingCount: 0,
  resolveCall: async () => {},
});

function playBellSound() {
  try {
    const ac = new AudioContext();

    function ding(startAt: number, freq: number, vol: number, dur: number) {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startAt);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, startAt + dur);
      gain.gain.setValueAtTime(vol, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
      osc.start(startAt);
      osc.stop(startAt + dur);
    }

    // Double ding — classic bell pattern
    ding(ac.currentTime,        1480, 0.35, 0.9);
    ding(ac.currentTime + 0.35, 1760, 0.28, 0.9);
  } catch { /* AudioContext unavailable */ }
}

export function WaiterCallProvider({ children }: { children: React.ReactNode }) {
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const known = useRef(new Set<string>());

  useEffect(() => {
    if (!RESTAURANT_ID) return;

    // Load existing pending calls on mount
    supabase
      .from(DB_TABLES.waiterCalls)
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const rows = data as WaiterCall[];
        setCalls(rows);
        rows.forEach(c => known.current.add(c.id));
      });

    // Realtime subscription
    const channel = supabase
      .channel(`waiter-calls-${RESTAURANT_ID}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DB_TABLES.waiterCalls, filter: `restaurant_id=eq.${RESTAURANT_ID}` },
        (payload) => {
          const call = payload.new as WaiterCall;
          if (known.current.has(call.id)) return;
          known.current.add(call.id);
          if (call.status === "pending") {
            setCalls(prev => [call, ...prev]);
            playBellSound();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DB_TABLES.waiterCalls, filter: `restaurant_id=eq.${RESTAURANT_ID}` },
        (payload) => {
          const updated = payload.new as WaiterCall;
          if (updated.status === "resolved") {
            setCalls(prev => prev.filter(c => c.id !== updated.id));
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function resolveCall(id: string) {
    const { error } = await supabase
      .from(DB_TABLES.waiterCalls)
      .update({ status: "resolved" })
      .eq("id", id);
    if (!error) {
      setCalls(prev => prev.filter(c => c.id !== id));
    }
  }

  const pendingCount = calls.filter(c => c.status === "pending").length;

  return (
    <Ctx.Provider value={{ calls, pendingCount, resolveCall }}>
      {children}
    </Ctx.Provider>
  );
}

export const useWaiterCalls = () => useContext(Ctx);
