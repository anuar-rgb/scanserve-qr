"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, RefreshCw, Copy, Check, FileText, Users, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Doc {
  id: string;
  title: string;
  content: string;
  is_required: boolean;
  created_at: string;
}

interface StaffMember {
  id: string;
  display_name: string | null;
  username: string;
  role: string;
}

interface SigRecord {
  document_id:   string;
  staff_user_id: string;
  sign_token:    string;
  status:        "pending" | "signed";
  signed_at:     string | null;
}

type Tab = "documents" | "signatures";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  manager:      "Менеджер",
  cashier:      "Кассир",
  waiter:       "Официант",
  senior_waiter:"Старший официант",
  chef:         "Повар",
  bartender:    "Бармен",
  sommelier:    "Сомелье",
  hostess:      "Хостес",
  runner:       "Раннер",
  courier:      "Курьер",
  storekeeper:  "Кладовщик",
  accountant:   "Бухгалтер",
  cleaner:      "Уборщик",
  doorman:      "Швейцар",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Document Form ────────────────────────────────────────────────────────────

function DocForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Doc;
  onSave: (doc: Doc) => void;
  onCancel: () => void;
}) {
  const [title,      setTitle]      = useState(initial?.title      ?? "");
  const [content,    setContent]    = useState(initial?.content    ?? "");
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? true);
  const [saving,     setSaving]     = useState(false);

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      toast.error("Заголовок и содержимое обязательны");
      return;
    }
    setSaving(true);
    try {
      const method = initial ? "PATCH" : "POST";
      const url    = initial ? `/api/admin/documents/${initial.id}` : "/api/admin/documents";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), is_required: isRequired }),
      });
      const d = await res.json() as { document?: Doc; error?: string };
      if (!res.ok || !d.document) throw new Error(d.error ?? "Ошибка сохранения");
      toast.success("Документ сохранён");
      onSave(d.document);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Название документа</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Договор о материальной ответственности"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Содержимое</Label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          placeholder="Текст документа…"
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/50 placeholder:text-zinc-400"
        />
        <p className="text-xs text-zinc-400">Поддерживаются переносы строк. Сотрудник увидит текст таким, как он введён здесь.</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="is_required"
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          className="rounded border-zinc-300 accent-violet-600"
        />
        <Label htmlFor="is_required" className="cursor-pointer">
          Обязательный для всех сотрудников
        </Label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
          {saving ? "Сохраняем…" : "Сохранить"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

// ─── Copy Link Button ─────────────────────────────────────────────────────────

function CopyLinkButton({ documentId, staffUserId }: { documentId: string; staffUserId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied">("idle");

  async function handleCopy() {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/sign-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffUserId }),
      });
      const d = await res.json() as { url?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error ?? "Ошибка");
      // Use full production URL
      const fullUrl = window.location.origin + d.url;
      await navigator.clipboard.writeText(fullUrl);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось скопировать");
      setState("idle");
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={state === "loading"}
      title="Скопировать ссылку для подписи"
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:opacity-50"
    >
      {state === "copied"
        ? <><Check size={11} className="text-emerald-500" /> Скопировано</>
        : state === "loading"
          ? <><RefreshCw size={11} className="animate-spin" /> Генерируем…</>
          : <><Link2 size={11} /> Ссылка</>
      }
    </button>
  );
}

// ─── Signatures Tab ───────────────────────────────────────────────────────────

function SignaturesTab() {
  const [staff,      setStaff]      = useState<StaffMember[]>([]);
  const [documents,  setDocuments]  = useState<{ id: string; title: string; is_required: boolean }[]>([]);
  const [signatures, setSignatures] = useState<SigRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/documents/signatures");
      const d   = await res.json() as { staff?: StaffMember[]; documents?: typeof documents; signatures?: SigRecord[] };
      setStaff(d.staff      ?? []);
      setDocuments(d.documents  ?? []);
      setSignatures(d.signatures ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function sigFor(staffId: string, docId: string): SigRecord | undefined {
    return signatures.find((s) => s.staff_user_id === staffId && s.document_id === docId);
  }

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-400">
        Нет документов. Создайте хотя бы один документ во вкладке «Документы».
      </p>
    );
  }

  if (staff.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-400">Нет активных сотрудников.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {staff.length} сотрудников · {documents.length} документов
        </p>
        <button onClick={load} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1">
          <RefreshCw size={11} /> Обновить
        </button>
      </div>

      {staff.map((member) => {
        const allSigned  = documents.every((doc) => sigFor(member.id, doc.id)?.status === "signed");
        const pendingCount = documents.filter((doc) => sigFor(member.id, doc.id)?.status !== "signed").length;
        const isOpen = expanded[member.id] ?? false;

        return (
          <div key={member.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {/* Staff header row */}
            <button
              onClick={() => toggle(member.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0">
                {(member.display_name ?? member.username).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {member.display_name ?? member.username}
                </p>
                <p className="text-xs text-zinc-400">{ROLE_LABEL[member.role] ?? member.role}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {allSigned ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Все подписаны
                  </span>
                ) : (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {pendingCount} ожидает
                  </span>
                )}
                {isOpen ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
              </div>
            </button>

            {/* Document list */}
            {isOpen && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {documents.map((doc) => {
                  const sig    = sigFor(member.id, doc.id);
                  const signed = sig?.status === "signed";
                  return (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 bg-zinc-50/50 dark:bg-zinc-900/30">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${signed ? "bg-emerald-500" : "bg-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{doc.title}</p>
                        {signed && sig?.signed_at && (
                          <p className="text-[11px] text-zinc-400">Подписан {fmtDate(sig.signed_at)}</p>
                        )}
                        {!signed && (
                          <p className="text-[11px] text-amber-500">Ожидает подписи</p>
                        )}
                      </div>
                      {!signed && (
                        <CopyLinkButton documentId={doc.id} staffUserId={member.id} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [tab,         setTab]         = useState<Tab>("documents");
  const [docs,        setDocs]        = useState<Doc[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [addOpen,     setAddOpen]     = useState(false);
  const [editTarget,  setEditTarget]  = useState<Doc | null>(null);
  const [deleteTarget,setDeleteTarget]= useState<Doc | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [expanded,    setExpanded]    = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/documents");
      const d   = await res.json() as { documents?: Doc[] };
      setDocs(d.documents ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleDelete(doc: Doc) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Ошибка");
      }
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      setDeleteTarget(null);
      toast.success("Документ удалён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  }

  async function toggleRequired(doc: Doc) {
    const res = await fetch(`/api/admin/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_required: !doc.is_required }),
    });
    const d = await res.json() as { document?: Doc };
    if (res.ok && d.document) {
      setDocs((prev) => prev.map((x) => x.id === doc.id ? d.document! : x));
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Документы сотрудников</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Договоры и документы для цифрового подписания</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {([["documents", FileText, "Документы"], ["signatures", Users, "Подписи"]] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? "border-violet-600 text-violet-600 dark:text-violet-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Documents Tab */}
      {tab === "documents" && (
        <div className="space-y-4">
          {/* Add button */}
          {!addOpen && (
            <Button
              onClick={() => setAddOpen(true)}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
            >
              <Plus size={15} /> Добавить документ
            </Button>
          )}

          {/* Add form */}
          {addOpen && (
            <div className="border border-violet-200 dark:border-violet-800/40 rounded-xl p-5 bg-violet-50/30 dark:bg-violet-500/5">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Новый документ</p>
              <DocForm
                onSave={(doc) => { setDocs((prev) => [...prev, doc]); setAddOpen(false); }}
                onCancel={() => setAddOpen(false)}
              />
            </div>
          )}

          {/* Documents list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText size={32} className="mx-auto text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm text-zinc-400">Нет документов. Нажмите «Добавить документ».</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => {
                const isEditing  = editTarget?.id === doc.id;
                const isExpanded = expanded[doc.id];

                return (
                  <div key={doc.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    {isEditing ? (
                      <div className="p-5">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Редактировать документ</p>
                        <DocForm
                          initial={editTarget}
                          onSave={(updated) => {
                            setDocs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
                            setEditTarget(null);
                          }}
                          onCancel={() => setEditTarget(null)}
                        />
                      </div>
                    ) : (
                      <>
                        {/* Doc header */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{doc.title}</p>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                doc.is_required
                                  ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}>
                                {doc.is_required ? "Обязательный" : "Необязательный"}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {doc.content.slice(0, 80)}{doc.content.length > 80 ? "…" : ""}
                            </p>
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            <button
                              onClick={() => toggleExpand(doc.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title={isExpanded ? "Свернуть" : "Показать текст"}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <button
                              onClick={() => toggleRequired(doc)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Переключить обязательность"
                            >
                              <Check size={14} className={doc.is_required ? "text-violet-500" : "text-zinc-300"} />
                            </button>
                            <button
                              onClick={() => setEditTarget(doc)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(doc)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded content preview */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800/60">
                            <pre className="mt-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed font-sans max-h-60 overflow-y-auto">
                              {doc.content}
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Signatures Tab */}
      {tab === "signatures" && <SignaturesTab />}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Удалить документ?</h3>
            <p className="text-sm text-zinc-500">
              Будут удалены также все записи о подписях сотрудников по документу
              <span className="font-medium text-zinc-800 dark:text-zinc-200"> «{deleteTarget.title}»</span>.
              Это действие необратимо.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="flex-1"
              >
                {deleting ? "Удаляем…" : "Удалить"}
              </Button>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="flex-1">
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
