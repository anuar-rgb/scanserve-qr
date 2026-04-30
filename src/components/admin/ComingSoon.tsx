"use client";

import { Clock } from "lucide-react";
import { useTranslations, type Dict } from "@/lib/i18n";

type AdminKey = keyof Dict["admin"];

interface Props {
  titleKey: AdminKey;
  descKey: AdminKey;
}

export default function ComingSoon({ titleKey, descKey }: Props) {
  const { t } = useTranslations();
  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin[titleKey]}</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{t.admin[descKey]}</p>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center">
          <Clock size={20} className="text-zinc-400 dark:text-zinc-500" />
        </div>
        <div>
          <p className="text-zinc-700 dark:text-zinc-300 font-medium text-sm">{t.admin.comingSoon}</p>
          <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-1">{t.admin.underDevelopment}</p>
        </div>
      </div>
    </div>
  );
}
