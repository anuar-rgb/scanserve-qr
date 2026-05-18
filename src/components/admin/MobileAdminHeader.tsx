"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useRole, useDisplayName } from "@/lib/role-context";

const ROLE_LABEL: Record<string, string> = {
  owner:   "Owner Platform",
  manager: "Manager Platform",
  cashier: "Cashier Terminal",
  waiter:  "Waiter Terminal",
  chef:    "Chef Terminal",
};

export default function MobileAdminHeader() {
  const router      = useRouter();
  const role        = useRole();
  const displayName = useDisplayName();
  const isWaiter    = role === "waiter";

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <div className="md:hidden shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0 select-none">
        А
      </div>
      <div className="flex-1 min-w-0">
        {isWaiter && displayName ? (
          <>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
              Привет, {displayName}! 👋
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">Waiter Terminal</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">АС ТӨРІ</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">
              {role ? (ROLE_LABEL[role] ?? "Staff Terminal") : "…"}
            </p>
          </>
        )}
      </div>
      <button
        onClick={signOut}
        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title="Выйти"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
