"use client";

import type { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import MobileAdminHeader from "./MobileAdminHeader";
import MobileBottomNav from "./MobileBottomNav";
import { Toaster } from "@/components/ui/sonner";
import { RoleProvider, useRole } from "@/lib/role-context";
import { ShiftProvider, ShiftGate, CheckinGate } from "@/lib/shift-context";
import { CheckinProvider } from "@/lib/checkin-context";
import { WaiterCallProvider } from "@/lib/waiter-call-context";
import { BranchProvider } from "@/lib/branch-context";

// Separate component so it can read role from context (AdminShell itself is the provider)
function ShellMain({ children }: { children: ReactNode }) {
  const role = useRole();
  const isCourier = role === "courier";
  return (
    <main className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col pb-16 ${isCourier ? "" : "md:ml-16 md:pb-0"}`}>
      <MobileAdminHeader />
      {children}
    </main>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <BranchProvider>
        <ShiftProvider>
          <CheckinProvider>
            <WaiterCallProvider>
              <ShiftGate>
                <CheckinGate>
                  <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
                    <AdminSidebar />
                    <ShellMain>{children}</ShellMain>
                    <MobileBottomNav />
                    <Toaster position="bottom-right" richColors />
                  </div>
                </CheckinGate>
              </ShiftGate>
            </WaiterCallProvider>
          </CheckinProvider>
        </ShiftProvider>
      </BranchProvider>
    </RoleProvider>
  );
}
