"use client";

import { createContext, useContext, type ReactNode } from "react";

type CheckinCtx = {
  isCheckedIn: boolean;
  checkedInAt: string | null;
  isLoading: boolean;
  checkin: (qrToken: string) => Promise<{ ok: boolean; error?: string }>;
  checkout: (qrToken: string) => Promise<{ ok: boolean; error?: string }>;
};

const CheckinContext = createContext<CheckinCtx>({
  isCheckedIn: false,
  checkedInAt: null,
  isLoading: false,
  checkin: async () => ({ ok: false }),
  checkout: async () => ({ ok: false }),
});

export function useCheckin() {
  return useContext(CheckinContext);
}

export function CheckinProvider({ children }: { children: ReactNode }) {
  return (
    <CheckinContext.Provider
      value={{
        isCheckedIn: false,
        checkedInAt: null,
        isLoading: false,
        checkin: async () => ({ ok: false }),
        checkout: async () => ({ ok: false }),
      }}
    >
      {children}
    </CheckinContext.Provider>
  );
}
