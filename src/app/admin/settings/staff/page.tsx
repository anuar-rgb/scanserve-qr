"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Loader2, RefreshCw, Pencil, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRole } from "@/lib/role-context";
import { supabase } from "@/lib/supabase";
import { RESTAURANT_ID } from "@/constants";

// ─── types ────────────────────────────────────────────────────────────────────

interface ActiveStaffMember {
  id: string;
  display_name: string | null;
  username: string;
  role: StaffRole;
  checked_in_at: string;
}

type StaffRole =
  | "owner" | "manager" | "cashier" | "waiter" | "chef"
  | "bartender" | "hostess" | "courier" | "cleaner" | "doorman"
  | "sommelier" | "senior_waiter" | "runner" | "storekeeper" | "accountant";

interface StaffUser {
  id: string;
  username: string;
  role: StaffRole;
  display_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── constants ────────────────────────────────────────────────────────────────

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "owner",        label: "Владелец"         },
  { value: "manager",      label: "Менеджер"         },
  { value: "cashier",      label: "Кассир"           },
  { value: "waiter",       label: "Официант"         },
  { value: "senior_waiter",label: "Старший официант" },
  { value: "chef",         label: "Повар"            },
  { value: "bartender",    label: "Бармен"           },
  { value: "sommelier",    label: "Сомелье"          },
  { value: "hostess",      label: "Хостес"           },
  { value: "runner",       label: "Раннер"           },
  { value: "courier",      label: "Курьер"           },
  { value: "storekeeper",  label: "Кладовщик"        },
  { value: "accountant",   label: "Бухгалтер"        },
  { value: "cleaner",      label: "Уборщик"          },
  { value: "doorman",      label: "Швейцар"          },
];

const ROLE_COLOR: Record<StaffRole, string> = {
  owner:        "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  manager:      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  cashier:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  waiter:       "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  senior_waiter:"bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  chef:         "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  bartender:    "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  sommelier:    "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  hostess:      "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  runner:       "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
  courier:      "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  storekeeper:  "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300",
  accountant:   "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  cleaner:      "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  doorman:      "bg-stone-100 text-stone-700 dark:bg-stone-500/15 dark:text-stone-300",
};

// ─── component ────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const viewerRole = useRole();
  const isManager  = viewerRole === "manager";

  const [activeTab, setActiveTab] = useState<"all" | "active_today">("all");

  const [staff, setStaff]     = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeStaff, setActiveStaff]       = useState<ActiveStaffMember[]>([]);
  const [loadingActive, setLoadingActive]   = useState(false);
  const [noShift, setNoShift]               = useState(false);

  const [addOpen, setAddOpen]               = useState(false);
  const [editTarget, setEditTarget]         = useState<StaffUser | null>(null);
  const [resetTarget, setResetTarget]       = useState<StaffUser | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<StaffUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/staff");
    if (res.ok) {
      const json = await res.json();
      setStaff(json.staff ?? []);
    }
    setLoading(false);
  }, []);

  const loadActiveStaff = useCallback(async () => {
    setLoadingActive(true);
    setNoShift(false);

    const { data: shift } = await supabase
      .from("shifts")
      .select("id")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!shift) {
      setNoShift(true);
      setActiveStaff([]);
      setLoadingActive(false);
      return;
    }

    const { data: checkins } = await supabase
      .from("shift_checkins")
      .select("staff_user_id, checked_in_at")
      .eq("shift_id", shift.id)
      .is("checked_out_at", null);

    if (!checkins || checkins.length === 0) {
      setActiveStaff([]);
      setLoadingActive(false);
      return;
    }

    const userIds = checkins.map((c) => c.staff_user_id as string);
    const { data: users } = await supabase
      .from("staff_users")
      .select("id, display_name, username, role")
      .in("id", userIds);

    const merged: ActiveStaffMember[] = (users ?? []).map((u) => ({
      id: u.id as string,
      display_name: u.display_name as string | null,
      username: u.username as string,
      role: u.role as StaffRole,
      checked_in_at: (checkins.find((c) => c.staff_user_id === u.id)?.checked_in_at as string) ?? "",
    }));

    setActiveStaff(merged);
    setLoadingActive(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeTab === "active_today") loadActiveStaff();
  }, [activeTab, loadActiveStaff]);

  function onAdded(user: StaffUser) {
    setStaff((prev) => [...prev, user]);
    setAddOpen(false);
  }

  function onEdited(updated: Partial<StaffUser> & { id: string }) {
    setStaff((prev) => prev.map((u) => u.id === updated.id ? { ...u, ...updated } : u));
    setEditTarget(null);
  }

  async function onDelete(user: StaffUser) {
    const res = await fetch(`/api/admin/staff/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      setStaff((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`${user.display_name ?? user.username} удалён`);
    } else {
      const j = await res.json();
      toast.error(j.error ?? "Ошибка удаления");
    }
    setDeleteTarget(null);
  }

  const isRefreshing = activeTab === "all" ? loading : loadingActive;

  function handleRefresh() {
    if (activeTab === "all") load();
    else loadActiveStaff();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-8 py-5 border-b border-border shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Сотрудники</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Управление персоналом и ролями</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </Button>
        {activeTab === "all" && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} />
            Добавить
          </Button>
        )}
      </header>

      {/* Tab switcher */}
      <div className="px-8 pt-4 pb-1 shrink-0">
        <div className="flex w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-full p-1 gap-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${
              activeTab === "all"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Все сотрудники
          </button>
          <button
            onClick={() => setActiveTab("active_today")}
            className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${
              activeTab === "active_today"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Сегодня в работе
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === "all" ? (
          loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Загрузка…
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center py-20 text-sm text-muted-foreground">
              Нет сотрудников. Нажмите «Добавить».
            </div>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {staff.filter((u) => !isManager || u.role !== "owner").map((user) => (
                <StaffRow
                  key={user.id}
                  user={user}
                  onEdit={() => setEditTarget(user)}
                  onReset={() => setResetTarget(user)}
                  onDelete={() => setDeleteTarget(user)}
                />
              ))}
            </div>
          )
        ) : (
          loadingActive ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Загрузка…
            </div>
          ) : noShift ? (
            <div className="text-center py-20 text-sm text-muted-foreground">
              Смена не открыта. Нет данных о присутствии.
            </div>
          ) : activeStaff.length === 0 ? (
            <div className="text-center py-20 text-sm text-muted-foreground">
              Никто ещё не отметился на смене сегодня.
            </div>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {activeStaff.map((member) => (
                <ActiveStaffCard key={member.id} member={member} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {addOpen && (
        <AddModal excludeOwner={isManager} onClose={() => setAddOpen(false)} onAdded={onAdded} />
      )}
      {editTarget && (
        <EditModal excludeOwner={isManager} user={editTarget} onClose={() => setEditTarget(null)} onSaved={onEdited} />
      )}
      {resetTarget && (
        <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} />
      )}
    </div>
  );
}

// ─── Active staff card ────────────────────────────────────────────────────────

function ActiveStaffCard({ member }: { member: ActiveStaffMember }) {
  const initials = (member.display_name ?? member.username).slice(0, 2).toUpperCase();
  const time = member.checked_in_at
    ? new Date(member.checked_in_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card">
      <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-violet-700 dark:text-violet-300">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">
          {member.display_name ?? member.username}
        </p>
        <p className="text-xs text-muted-foreground leading-tight flex items-center gap-1.5 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
          На смене с {time}
        </p>
      </div>
      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${ROLE_COLOR[member.role]}`}>
        {ROLES.find((r) => r.value === member.role)?.label ?? member.role}
      </span>
    </div>
  );
}

// ─── Staff row ────────────────────────────────────────────────────────────────

function StaffRow({
  user, onEdit, onReset, onDelete,
}: {
  user: StaffUser;
  onEdit: () => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const initials = (user.display_name ?? user.username).slice(0, 2).toUpperCase();
  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card transition-opacity ${!user.is_active ? "opacity-50" : ""}`}>
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-violet-700 dark:text-violet-300">{initials}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">
          {user.display_name ?? user.username}
        </p>
        <p className="text-xs text-muted-foreground leading-tight">@{user.username}</p>
      </div>

      {/* Role badge */}
      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${ROLE_COLOR[user.role]}`}>
        {ROLES.find((r) => r.value === user.role)?.label ?? user.role}
      </span>

      {/* Status */}
      {!user.is_active && (
        <span className="text-[11px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
          Отключён
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Редактировать"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onReset}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
          title="Сбросить пароль"
        >
          <KeyRound size={13} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          title="Удалить"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Add modal ────────────────────────────────────────────────────────────────

function AddModal({
  excludeOwner, onClose, onAdded,
}: {
  excludeOwner?: boolean;
  onClose: () => void;
  onAdded: (user: StaffUser) => void;
}) {
  const [username, setUsername]       = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone]             = useState("");
  const [role, setRole]               = useState<StaffRole>("cashier");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [saving, setSaving]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Пароли не совпадают"); return; }
    if (password.length < 4)  { toast.error("Пароль минимум 4 символа"); return; }

    setSaving(true);
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role, display_name: displayName, phone: phone || undefined }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) { toast.error(json.error ?? "Ошибка"); return; }

    onAdded({
      id: json.id,
      username,
      role,
      display_name: displayName || null,
      phone: phone || null,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    toast.success("Сотрудник добавлен");
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-base font-semibold">Новый сотрудник</h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Логин *">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="cashier1" required />
          </Field>
          <Field label="Имя (отображаемое)">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Иван К." />
          </Field>
        </div>

        <Field label="Роль *">
          <RoleSelect value={role} onChange={setRole} excludeOwner={excludeOwner} />
        </Field>

        <Field label="Номер телефона">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 777 123 4567" type="tel" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Пароль *">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Повторите пароль *">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            Добавить
          </Button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  excludeOwner, user, onClose, onSaved,
}: {
  excludeOwner?: boolean;
  user: StaffUser;
  onClose: () => void;
  onSaved: (u: Partial<StaffUser> & { id: string }) => void;
}) {
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [phone, setPhone]             = useState(user.phone ?? "");
  const [role, setRole]               = useState<StaffRole>(user.role);
  const [isActive, setIsActive]       = useState(user.is_active);
  const [saving, setSaving]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/admin/staff/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, display_name: displayName || null, is_active: isActive, phone: phone || null }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(json.error ?? "Ошибка"); return; }
    onSaved({ id: user.id, role, display_name: displayName || null, phone: phone || null, is_active: isActive });
    toast.success("Сохранено");
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-base font-semibold">Редактировать — @{user.username}</h2>

        <Field label="Имя (отображаемое)">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Иван К." />
        </Field>

        <Field label="Номер телефона">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 777 123 4567" type="tel" />
        </Field>

        <Field label="Роль">
          <RoleSelect value={role} onChange={setRole} excludeOwner={excludeOwner} />
        </Field>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded accent-violet-600"
          />
          <span className="text-sm">Активен</span>
        </label>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            Сохранить
          </Button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

// ─── Reset password modal ─────────────────────────────────────────────────────

function ResetPasswordModal({
  user, onClose,
}: {
  user: StaffUser;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving, setSaving]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Пароли не совпадают"); return; }

    setSaving(true);
    const res = await fetch(`/api/admin/staff/${user.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(json.error ?? "Ошибка"); return; }
    toast.success("Пароль обновлён");
    onClose();
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-base font-semibold">Сброс пароля — @{user.username}</h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Новый пароль">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Повторите">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            Обновить пароль
          </Button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  user, onClose, onConfirm,
}: {
  user: StaffUser;
  onClose: () => void;
  onConfirm: (u: StaffUser) => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center shrink-0">
            <Trash2 size={16} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Удалить сотрудника?</h2>
            <p className="text-sm text-muted-foreground">
              @{user.username} · {ROLES.find((r) => r.value === user.role)?.label}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Это действие нельзя отменить. Сотрудник потеряет доступ немедленно.
        </p>
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={loading}
            onClick={async () => { setLoading(true); await onConfirm(user); }}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Удалить
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function RoleSelect({ value, onChange, excludeOwner }: { value: StaffRole; onChange: (r: StaffRole) => void; excludeOwner?: boolean }) {
  const roles = excludeOwner ? ROLES.filter((r) => r.value !== "owner") : ROLES;
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            value === r.value
              ? `${ROLE_COLOR[r.value]} border-transparent`
              : "border-border text-muted-foreground hover:border-zinc-400"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

