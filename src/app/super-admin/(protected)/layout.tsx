import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import SuperAdminNav from "./SuperAdminNav";

export default async function SuperAdminProtectedLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("super_admin_session");
  if (session?.value !== "authenticated") {
    redirect("/super-admin/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <SuperAdminNav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
