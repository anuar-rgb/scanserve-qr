"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import MobileAdminHeader from "./MobileAdminHeader";
import MobileBottomNav from "./MobileBottomNav";
import { Toaster } from "@/components/ui/sonner";
import { RoleProvider } from "@/lib/role-context";
import { ShiftProvider, ShiftGate, CheckinGate } from "@/lib/shift-context";
import { CheckinProvider } from "@/lib/checkin-context";
import { WaiterCallProvider } from "@/lib/waiter-call-context";

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") return <>{children}</>;

  return (
    <RoleProvider>
      <ShiftProvider>
        <CheckinProvider>
          <WaiterCallProvider>
            <ShiftGate>
              <CheckinGate>
                <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
                  <AdminSidebar />
                  <main className="flex-1 md:ml-60 overflow-y-auto flex flex-col pb-16 md:pb-0">
                    <MobileAdminHeader />
                    {children}
                  </main>
                  <MobileBottomNav />
                  <Toaster position="bottom-right" richColors />
                </div>
              </CheckinGate>
            </ShiftGate>
          </WaiterCallProvider>
        </CheckinProvider>
      </ShiftProvider>
    </RoleProvider>
  );
}
