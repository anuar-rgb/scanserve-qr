"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function SuperAdminNav() {
  const pathname = usePathname();
  const router   = useRouter();

  async function logout() {
    await fetch("/api/super-admin/logout", { method: "POST" });
    router.push("/super-admin/login");
  }

  const links = [
    { href: "/super-admin",     label: "Рестораны" },
    { href: "/super-admin/ads", label: "Реклама"   },
  ];

  return (
    <nav className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-xs font-black text-white">S</span>
            <span className="text-sm font-bold text-zinc-100 hidden sm:block">Platform Admin</span>
          </span>
          <div className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <button
          onClick={logout}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800"
        >
          Выйти
        </button>
      </div>
    </nav>
  );
}
