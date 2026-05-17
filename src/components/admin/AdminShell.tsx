"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import { Toaster } from "@/components/ui/sonner";
import { RoleProvider } from "@/lib/role-context";
import { ShiftProvider, ShiftGate } from "@/lib/shift-context";

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") return <>{children}</>;

  return (
    <RoleProvider>
      <ShiftProvider>
        <ShiftGate>
          <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
            <AdminSidebar />
            <main className="flex-1 ml-60 overflow-hidden flex flex-col">
              {children}
            </main>
            <Toaster position="bottom-right" richColors />
          </div>
        </ShiftGate>
      </ShiftProvider>
    </RoleProvider>
  );
}
