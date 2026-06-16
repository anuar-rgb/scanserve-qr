"use client";

import { useEffect, useState, useCallback } from "react";

type Restaurant = {
  id: string;
  numeric_id: number | null;
  name: string;
  slug: string;
  logo: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  monthly_payment_status: "paid" | "unpaid" | "overdue" | null;
  payment_due_date: string | null;
  created_at: string;
};

type EditState = {
  id: string;
  owner_name: string;
  owner_phone: string;
  monthly_payment_status: string;
  payment_due_date: string;
} | null;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  paid:    { label: "Оплачено",     cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  unpaid:  { label: "Не оплачено",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/20"       },
  overdue: { label: "Просрочено",   cls: "bg-red-500/15 text-red-400 border-red-500/20"             },
};

export default function SuperAdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading]         = useState(true);
  const [edit, setEdit]               = useState<EditState>(null);
  const [saving, setSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/restaurants");
    if (res.ok) setRestaurants(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(r: Restaurant) {
    setEdit({
      id: r.id,
      owner_name:             r.owner_name              ?? "",
      owner_phone:            r.owner_phone             ?? "",
      monthly_payment_status: r.monthly_payment_status  ?? "unpaid",
      payment_due_date:       r.payment_due_date        ?? "",
    });
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    const res = await fetch("/api/super-admin/restaurants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    if (res.ok) {
      const updated: Restaurant = await res.json();
      setRestaurants((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEdit(null);
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Рестораны</h1>
        <p className="text-sm text-zinc-500 mt-1">Все заведения на платформе</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {restaurants.map((r) => {
            const status  = STATUS_LABELS[r.monthly_payment_status ?? "unpaid"] ?? STATUS_LABELS.unpaid;
            const isEditing = edit?.id === r.id;

            return (
              <div key={r.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-zinc-500 font-mono">#{r.numeric_id}</span>
                      <span className="font-semibold text-zinc-100">{r.name}</span>
                      <span className="text-xs text-zinc-600">/{r.slug}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Имя владельца</label>
                        <input
                          value={edit.owner_name}
                          onChange={(e) => setEdit({ ...edit, owner_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                          placeholder="ФИО"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Телефон владельца</label>
                        <input
                          value={edit.owner_phone}
                          onChange={(e) => setEdit({ ...edit, owner_phone: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                          placeholder="+7 700 000 00 00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Статус оплаты</label>
                        <select
                          value={edit.monthly_payment_status}
                          onChange={(e) => setEdit({ ...edit, monthly_payment_status: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                        >
                          <option value="paid">Оплачено</option>
                          <option value="unpaid">Не оплачено</option>
                          <option value="overdue">Просрочено</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Дата следующего платежа</label>
                        <input
                          type="date"
                          value={edit.payment_due_date}
                          onChange={(e) => setEdit({ ...edit, payment_due_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                      >
                        {saving ? "Сохранение..." : "Сохранить"}
                      </button>
                      <button
                        onClick={() => setEdit(null)}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      {r.logo ? (
                        <img src={r.logo} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-zinc-800" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-zinc-500">{r.name[0]}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-zinc-100">{r.name}</span>
                          <span className="text-xs text-zinc-600 font-mono">/{r.slug}</span>
                          <span className="text-xs text-zinc-600">#{r.numeric_id}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.cls}`}>
                            {status.label}
                          </span>
                          {r.payment_due_date && (
                            <span className="text-xs text-zinc-500">
                              до {new Date(r.payment_due_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          {r.owner_name && (
                            <span className="text-xs text-zinc-400">{r.owner_name}</span>
                          )}
                          {r.owner_phone && (
                            <a href={`tel:${r.owner_phone}`} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                              {r.owner_phone}
                            </a>
                          )}
                          {!r.owner_name && !r.owner_phone && (
                            <span className="text-xs text-zinc-600">Контакты не заполнены</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(r)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                    >
                      Изменить
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-6 text-center">
        {restaurants.length} заведений на платформе
      </p>
    </div>
  );
}
