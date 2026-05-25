"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Save, Plus, Trash2, RefreshCw, Copy, Check, FileText, Users, ChevronDown, ChevronUp, Link2, Pencil, Eye, X, Download } from "lucide-react";
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

interface SignatureViewState {
  docId:     string;
  staffId:   string;
  staffName: string;
  docTitle:  string;
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

// ─── Signature View Modal ─────────────────────────────────────────────────────

function SignatureModal({
  view,
  onClose,
}: {
  view: SignatureViewState;
  onClose: () => void;
}) {
  const [img,         setImg]         = useState<string | null>(null);
  const [signedAt,    setSignedAt]    = useState<string | null>(null);
  const [ipAddress,   setIpAddress]   = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [deviceModel, setDeviceModel] = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/documents/signature-image?docId=${view.docId}&staffId=${view.staffId}`)
      .then((r) => r.json())
      .then((d: { signatureImage?: string | null; signedAt?: string | null; ipAddress?: string | null; phoneNumber?: string | null; deviceModel?: string | null; error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setImg(d.signatureImage ?? null);
        setSignedAt(d.signedAt ?? null);
        setIpAddress(d.ipAddress ?? null);
        setPhoneNumber(d.phoneNumber ?? null);
        setDeviceModel(d.deviceModel ?? null);
      })
      .catch(() => setError("Не удалось загрузить подпись"))
      .finally(() => setLoading(false));
  }, [view.docId, view.staffId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">Подпись сотрудника</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{view.staffName}</p>
            <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[280px]">{view.docTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 ml-2"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-sm text-center text-red-500 py-8">{error}</p>
          )}

          {!loading && !error && (
            <>
              {img ? (
                <div className="rounded-xl border-2 border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt="Подпись сотрудника"
                    className="w-full h-auto block"
                    style={{ maxHeight: 200, objectFit: "contain", background: "#fff" }}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center py-10">
                  <p className="text-sm text-zinc-400">Изображение подписи недоступно</p>
                </div>
              )}

              <div className="mt-3 space-y-1.5">
                {signedAt && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    📅 Подписан: <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmtDate(signedAt)}</span>
                  </p>
                )}
                {phoneNumber && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    📱 Телефон: <span className="font-medium text-zinc-700 dark:text-zinc-300">{phoneNumber}</span>
                  </p>
                )}
                {deviceModel && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    💻 Устройство: <span className="font-medium text-zinc-700 dark:text-zinc-300">{deviceModel}</span>
                  </p>
                )}
                {ipAddress && ipAddress !== "unknown" && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    🌐 IP: <span className="font-mono text-zinc-600 dark:text-zinc-400">{ipAddress}</span>
                  </p>
                )}
              </div>

              {/* PDF download */}
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <a
                  href={`/print/signature?docId=${view.docId}&staffId=${view.staffId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
                >
                  <Download size={14} />
                  Скачать PDF договора
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Signatures Tab ───────────────────────────────────────────────────────────

function SignaturesTab() {
  const [staff,      setStaff]      = useState<StaffMember[]>([]);
  const [documents,  setDocuments]  = useState<{ id: string; title: string; is_required: boolean }[]>([]);
  const [signatures, setSignatures] = useState<SigRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});
  const [sigView,    setSigView]    = useState<SignatureViewState | null>(null);

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
    <>
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
          const allSigned    = documents.every((doc) => sigFor(member.id, doc.id)?.status === "signed");
          const pendingCount = documents.filter((doc) => sigFor(member.id, doc.id)?.status !== "signed").length;
          const isOpen       = expanded[member.id] ?? false;

          return (
            <div key={member.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
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
                        <div className="shrink-0 flex items-center gap-1.5">
                          {signed && (
                            <button
                              onClick={() => setSigView({
                                docId:     doc.id,
                                staffId:   member.id,
                                staffName: member.display_name ?? member.username,
                                docTitle:  doc.title,
                              })}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-violet-600 dark:text-violet-400 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                            >
                              <Eye size={11} /> Подпись
                            </button>
                          )}
                          {!signed && (
                            <CopyLinkButton documentId={doc.id} staffUserId={member.id} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sigView && (
        <SignatureModal view={sigView} onClose={() => setSigView(null)} />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const formRef = useRef<HTMLDivElement>(null);

  const [tab,          setTab]          = useState<Tab>("documents");
  const [docs,         setDocs]         = useState<Doc[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // Form state (shared for create + edit)
  const [selectedDocId,    setSelectedDocId]    = useState<string | null>(null);
  const [formTitle,        setFormTitle]        = useState("");
  const [formContent,      setFormContent]      = useState("");
  const [formRequired,     setFormRequired]     = useState(true);
  const [savingForm,       setSavingForm]       = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  // Sync form fields when selected doc changes
  useEffect(() => {
    if (selectedDocId === null) {
      setFormTitle("");
      setFormContent("");
      setFormRequired(true);
    } else {
      const doc = docs.find((d) => d.id === selectedDocId);
      if (doc) {
        setFormTitle(doc.title);
        setFormContent(doc.content);
        setFormRequired(doc.is_required);
      }
    }
  }, [selectedDocId, docs]);

  function selectForEdit(doc: Doc) {
    setSelectedDocId(doc.id);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function requestSave() {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Заголовок и содержимое обязательны");
      return;
    }
    // Editing existing — confirm reset of all signatures
    if (selectedDocId) {
      setShowResetConfirm(true);
      return;
    }
    void handleSaveForm();
  }

  async function handleSaveForm() {
    setShowResetConfirm(false);
    setSavingForm(true);
    try {
      if (selectedDocId) {
        // Update existing
        const res = await fetch(`/api/admin/documents/${selectedDocId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: formTitle.trim(), content: formContent.trim(), is_required: formRequired }),
        });
        const d = await res.json() as { document?: Doc; signaturesReset?: boolean; error?: string };
        if (!res.ok || !d.document) throw new Error(d.error ?? "Ошибка сохранения");
        setDocs((prev) => prev.map((x) => x.id === selectedDocId ? d.document! : x));
        if (d.signaturesReset) {
          toast.success("Документ обновлён. Все сотрудники должны подписать его заново.");
        } else {
          toast.success("Изменения сохранены");
        }
      } else {
        // Create new
        const res = await fetch("/api/admin/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: formTitle.trim(), content: formContent.trim(), is_required: formRequired }),
        });
        const d = await res.json() as { document?: Doc; error?: string };
        if (!res.ok || !d.document) throw new Error(d.error ?? "Ошибка создания");
        setDocs((prev) => [...prev, d.document!]);
        setFormTitle("");
        setFormContent("");
        setFormRequired(true);
        toast.success("Документ добавлен");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingForm(false);
    }
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
      if (selectedDocId === doc.id) setSelectedDocId(null);
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
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Документы сотрудников</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Договоры и документы для цифрового подписания</p>
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

          {/* Form panel — create or edit */}
          <div
            ref={formRef}
            className={`border rounded-xl p-5 space-y-4 ${
              selectedDocId
                ? "border-violet-200 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-500/5"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            {/* Document selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Выберите документ или создайте новый
              </Label>
              <select
                value={selectedDocId ?? ""}
                onChange={(e) => setSelectedDocId(e.target.value || null)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="">+ Новый документ</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-4 space-y-4">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {selectedDocId ? "Редактировать документ" : "Новый документ"}
              </p>

              <div className="space-y-1.5">
                <Label>Название документа</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Договор о материальной ответственности"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Содержимое</Label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={6}
                  placeholder="Текст документа…"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm px-3 py-2 resize-y max-h-[200px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-violet-500/50 placeholder:text-zinc-400"
                />
                <p className="text-xs text-zinc-400">
                  Поддерживаются переносы строк. Сотрудник увидит текст таким, как он введён здесь.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is_required"
                  type="checkbox"
                  checked={formRequired}
                  onChange={(e) => setFormRequired(e.target.checked)}
                  className="rounded border-zinc-300 accent-violet-600"
                />
                <Label htmlFor="is_required" className="cursor-pointer">
                  Обязательный для всех сотрудников
                </Label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={requestSave}
                  disabled={savingForm}
                  className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
                >
                  {savingForm ? (
                    "Сохраняем…"
                  ) : selectedDocId ? (
                    <><Save size={14} /> Сохранить изменения</>
                  ) : (
                    <><Plus size={14} /> Добавить документ</>
                  )}
                </Button>
                {selectedDocId && (
                  <Button variant="ghost" onClick={() => setSelectedDocId(null)}>
                    Отмена
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Documents list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText size={32} className="mx-auto text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm text-zinc-400">Нет документов. Заполните форму выше.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">
                Все документы ({docs.length})
              </p>
              {docs.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const isExpanded = expanded[doc.id];

                return (
                  <div
                    key={doc.id}
                    className={`border rounded-xl overflow-hidden transition-colors ${
                      isSelected
                        ? "border-violet-400 dark:border-violet-700"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
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
                          onClick={() => selectForEdit(doc)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isSelected
                              ? "text-violet-600 bg-violet-50 dark:bg-violet-500/10"
                              : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                          title="Редактировать"
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Signatures Tab */}
      {tab === "signatures" && <SignaturesTab />}

      {/* Reset signatures confirm modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Сохранить изменения?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              После сохранения <span className="font-semibold text-zinc-800 dark:text-zinc-200">все сотрудники потеряют статус «Подписано»</span> и будут обязаны подписать документ заново. Сотрудники увидят новый текст по тем же ссылкам.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => void handleSaveForm()}
                disabled={savingForm}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {savingForm ? "Сохраняем…" : "Да, сохранить"}
              </Button>
              <Button variant="ghost" onClick={() => setShowResetConfirm(false)} className="flex-1">
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Удалить документ?</h3>
            <p className="text-sm text-zinc-500">
              Будут удалены также все записи о подписях сотрудников по документу{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">«{deleteTarget.title}»</span>.
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
