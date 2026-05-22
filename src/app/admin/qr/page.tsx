"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, RefreshCw, QrCode } from "lucide-react";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID!;

export default function QrPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/qr-token");
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? "Нет доступа");
      } else {
        const d = await r.json() as { token: string };
        setToken(d.token);
      }
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  const qrData = token
    ? JSON.stringify({ r: RESTAURANT_ID, t: token, v: "checkin" })
    : null;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex-1 overflow-y-auto admin-scroll p-6">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">QR-код для сотрудников</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Распечатайте и разместите у входа в заведение. Сотрудники сканируют его при приходе и уходе.
          </p>
        </div>

        {/* QR card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col items-center gap-6">
          {loading && (
            <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          )}

          {error && (
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto">
                <QrCode size={24} className="text-red-400" />
              </div>
              <p className="text-sm text-red-500">{error}</p>
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 mx-auto"
              >
                <RefreshCw size={14} />
                Повторить
              </button>
            </div>
          )}

          {qrData && (
            <>
              <div className="p-4 bg-white rounded-2xl shadow-sm">
                <QRCodeSVG
                  value={qrData}
                  size={220}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="text-center space-y-1">
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">АС ТӨРІ</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Отметка прихода / ухода</p>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <Download size={14} />
                  Распечатать
                </button>
              </div>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Инструкция</h2>
          <ol className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400 list-decimal list-inside">
            <li>Распечатайте QR-код и разместите у входа / выхода из заведения.</li>
            <li>Сотрудник (официант, повар) при входе открывает приложение — увидит экран сканирования.</li>
            <li>После сканирования фиксируется время прихода, открывается рабочий интерфейс.</li>
            <li>При уходе сотрудник нажимает «Завершить работу» и снова сканирует QR — фиксируется уход.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
