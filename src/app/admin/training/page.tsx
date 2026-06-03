"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen, Plus, ChevronLeft, Loader2, Trash2, ExternalLink,
  Link2, ImageIcon, X, Upload, Save, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import { uploadImage } from "@/services/storage";
import { useIsOwner } from "@/lib/role-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── types ────────────────────────────────────────────────────────────────────

interface ArticleLink { name: string; url: string; }

interface TrainingArticle {
  id: string;
  title: string;
  content: string;
  links: ArticleLink[];
  images: string[];
  order_index: number;
  created_at: string;
}

interface Draft {
  title: string;
  content: string;
  links: ArticleLink[];
  images: string[];
}

const EMPTY_DRAFT: Draft = { title: "", content: "", links: [], images: [] };

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

// ─── component ────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const isOwner = useIsOwner();

  const [articles, setArticles]     = useState<TrainingArticle[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [draft, setDraft]           = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const selected = articles.find((a) => a.id === selectedId) ?? null;

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from(DB_TABLES.trainingArticles)
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    setArticles((data ?? []) as TrainingArticle[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setIsEditing(true);
    setSelectedId(null);
  }

  function openEdit(article: TrainingArticle) {
    setDraft({
      title: article.title,
      content: article.content,
      links: article.links ?? [],
      images: article.images ?? [],
    });
    setEditingId(article.id);
    setIsEditing(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    const urls: string[] = [];
    for (const f of files) {
      try {
        const url = await uploadImage(f, "trainingImages", "training");
        urls.push(url);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    }
    setDraft((d) => ({ ...d, images: [...d.images, ...urls] }));
    setUploading(false);
  }

  function removeImage(idx: number) {
    setDraft((d) => ({ ...d, images: d.images.filter((_, i) => i !== idx) }));
  }

  function addLink() {
    setDraft((d) => ({ ...d, links: [...d.links, { name: "", url: "" }] }));
  }

  function removeLink(idx: number) {
    setDraft((d) => ({ ...d, links: d.links.filter((_, i) => i !== idx) }));
  }

  function updateLink(idx: number, field: "name" | "url", value: string) {
    setDraft((d) => ({
      ...d,
      links: d.links.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    }));
  }

  async function handleSave() {
    if (!draft.title.trim()) { toast.error("Введите заголовок"); return; }
    setSaving(true);
    const payload = {
      restaurant_id: RESTAURANT_ID,
      title: draft.title.trim(),
      content: draft.content.trim(),
      links: draft.links.filter((l) => l.url.trim()),
      images: draft.images,
      updated_at: new Date().toISOString(),
    };
    try {
      if (editingId) {
        const { error } = await supabase
          .from(DB_TABLES.trainingArticles)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Тема обновлена");
        setSelectedId(editingId);
      } else {
        const { data, error } = await supabase
          .from(DB_TABLES.trainingArticles)
          .insert({ ...payload, order_index: articles.length })
          .select("id")
          .single();
        if (error) throw error;
        setSelectedId((data as { id: string }).id);
        toast.success("Тема создана");
      }
      await load();
      setIsEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить тему? Это действие необратимо.")) return;
    setDeleting(true);
    const { error } = await supabase
      .from(DB_TABLES.trainingArticles)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Тема удалена");
      setSelectedId(null);
      setIsEditing(false);
      await load();
    }
    setDeleting(false);
  }

  function goBack() {
    if (isEditing) {
      setIsEditing(false);
      if (!editingId) setSelectedId(null);
    } else {
      setSelectedId(null);
    }
  }

  // mobile view state
  const mobileView: "list" | "detail" | "edit" =
    isEditing ? "edit" : selectedId ? "detail" : "list";

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 px-4 md:px-6 py-3 md:py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        {mobileView !== "list" && (
          <button
            onClick={goBack}
            className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft size={18} className="text-zinc-600 dark:text-zinc-400" />
          </button>
        )}
        <BookOpen size={16} className="text-violet-500 shrink-0 hidden md:block" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
            {mobileView === "edit"
              ? (editingId ? "Редактировать тему" : "Новая тема")
              : mobileView === "detail"
              ? (selected?.title ?? "")
              : "База знаний"}
          </h1>
          {mobileView === "list" && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Регламенты и инструкции для персонала
            </p>
          )}
        </div>
        <Button
          variant="outline" size="sm" onClick={load} disabled={loading}
          className="hidden md:flex"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </Button>
        {isOwner && mobileView === "list" && (
          <Button
            size="sm" onClick={openNew}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Добавить тему</span>
          </Button>
        )}
        {isOwner && mobileView === "detail" && selected && (
          <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>
            Редактировать
          </Button>
        )}
        {mobileView === "edit" && (
          <Button
            size="sm" onClick={handleSave} disabled={saving}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {saving
              ? <Loader2 size={13} className="animate-spin" />
              : <Save size={13} />}
            <span className="hidden sm:inline">Сохранить</span>
          </Button>
        )}
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* ── Left sidebar: article list ───────────────────────────────────── */}
        <aside className={`
          ${mobileView === "list" ? "flex" : "hidden"} md:flex
          flex-col w-full md:w-72 lg:w-80 shrink-0
          border-r border-zinc-200 dark:border-zinc-800
          overflow-y-auto admin-scroll
        `}>
          {isOwner && (
            <button
              onClick={openNew}
              className="hidden md:flex items-center gap-2 mx-3 mt-3 mb-1 px-3 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-400 dark:text-zinc-500 hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            >
              <Plus size={13} /> Добавить тему
            </button>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-zinc-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs">Загрузка…</span>
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
              <BookOpen size={28} className="text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm text-zinc-400">Тем пока нет</p>
              {isOwner && (
                <>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Создайте первый регламент — кнопка «Добавить тему» выше
                  </p>
                  <Button
                    size="sm" onClick={openNew}
                    className="mt-1 bg-violet-600 hover:bg-violet-700 text-white md:hidden"
                  >
                    <Plus size={13} /> Добавить тему
                  </Button>
                </>
              )}
            </div>
          ) : (
            <ul className="p-2 space-y-1">
              {articles.map((a) => {
                const isActive = selectedId === a.id && !isEditing;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => { setSelectedId(a.id); setIsEditing(false); }}
                      className={`w-full text-left px-3 py-3 rounded-xl transition-colors border ${
                        isActive
                          ? "bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20"
                          : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <p className={`text-sm font-semibold leading-tight truncate ${
                        isActive
                          ? "text-violet-700 dark:text-violet-300"
                          : "text-zinc-900 dark:text-zinc-100"
                      }`}>
                        {a.title}
                      </p>
                      {a.content && (
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {a.content}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-zinc-400">{fmtDate(a.created_at)}</span>
                        {(a.images?.length ?? 0) > 0 && (
                          <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                            <ImageIcon size={9} /> {a.images.length}
                          </span>
                        )}
                        {(a.links?.length ?? 0) > 0 && (
                          <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                            <Link2 size={9} /> {a.links.length}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ── Right: detail or edit form ──────────────────────────────────── */}
        <main className={`
          ${mobileView === "list" ? "hidden" : "flex"} md:flex
          flex-1 flex-col overflow-y-auto admin-scroll min-h-0
        `}>
          {/* Desktop empty state */}
          {!selectedId && !isEditing && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3 text-zinc-400 py-20">
              <BookOpen size={32} className="text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm">Выберите тему из списка слева</p>
              {isOwner && (
                <Button
                  size="sm" onClick={openNew}
                  className="mt-1 bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Plus size={13} /> Создать первую тему
                </Button>
              )}
            </div>
          )}

          {/* Detail view */}
          {selectedId && !isEditing && selected && (
            <ArticleDetail
              article={selected}
              isOwner={isOwner}
              onEdit={() => openEdit(selected)}
              onDelete={handleDelete}
              deleting={deleting}
            />
          )}

          {/* Edit / create form */}
          {isEditing && (
            <ArticleForm
              draft={draft}
              setDraft={setDraft}
              onSave={handleSave}
              onCancel={() => { setIsEditing(false); if (!editingId) setSelectedId(null); }}
              onDelete={editingId ? () => handleDelete(editingId) : undefined}
              onAddLink={addLink}
              onRemoveLink={removeLink}
              onUpdateLink={updateLink}
              onImageUploadTrigger={() => imgRef.current?.click()}
              onRemoveImage={removeImage}
              saving={saving}
              uploading={uploading}
              deleting={deleting}
              isNew={!editingId}
            />
          )}
        </main>
      </div>

      {/* Hidden file input — shared */}
      <input
        ref={imgRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
}

// ─── ArticleDetail ─────────────────────────────────────────────────────────────

function ArticleDetail({
  article, isOwner, onEdit, onDelete, deleting,
}: {
  article: TrainingArticle;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full space-y-6 pb-10">
      {/* Title + admin actions */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
            {article.title}
          </h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            {fmtDate(article.created_at)}
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={onEdit}>
              Редактировать
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => onDelete(article.id)}
              disabled={deleting}
              className="text-red-500 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950"
            >
              {deleting
                ? <Loader2 size={12} className="animate-spin" />
                : <Trash2 size={12} />}
            </Button>
          </div>
        )}
      </div>

      {/* Content text */}
      {article.content && (
        <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 p-5">
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {article.content}
          </p>
        </div>
      )}

      {/* Images gallery */}
      {(article.images?.length ?? 0) > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
            Фото / Инфографика
          </p>
          <div className="grid grid-cols-2 gap-2">
            {article.images.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 aspect-video hover:opacity-90 transition-opacity"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {(article.links?.length ?? 0) > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
            Полезные ссылки
          </p>
          <div className="flex flex-col gap-2">
            {article.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/15 transition-colors group"
              >
                <ExternalLink
                  size={14}
                  className="text-violet-500 shrink-0 group-hover:translate-x-0.5 transition-transform"
                />
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-300 flex-1 min-w-0 truncate">
                  {link.name || link.url}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Empty article fallback */}
      {!article.content && !article.images?.length && !article.links?.length && (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 p-8 text-center text-zinc-400">
          <p className="text-sm">Тема пока пустая</p>
          {isOwner && (
            <button
              onClick={onEdit}
              className="mt-2 text-xs text-violet-500 hover:text-violet-600 font-semibold"
            >
              Добавить содержимое →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ArticleForm ───────────────────────────────────────────────────────────────

function ArticleForm({
  draft, setDraft,
  onSave, onCancel, onDelete,
  onAddLink, onRemoveLink, onUpdateLink,
  onImageUploadTrigger, onRemoveImage,
  saving, uploading, deleting, isNew,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onAddLink: () => void;
  onRemoveLink: (i: number) => void;
  onUpdateLink: (i: number, f: "name" | "url", v: string) => void;
  onImageUploadTrigger: () => void;
  onRemoveImage: (i: number) => void;
  saving: boolean;
  uploading: boolean;
  deleting: boolean;
  isNew: boolean;
}) {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full space-y-6 pb-24">

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="article-title">Заголовок темы</Label>
        <Input
          id="article-title"
          placeholder="Например: Стандарты обслуживания гостей"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <Label htmlFor="article-content">Текст регламента</Label>
        <textarea
          id="article-content"
          rows={8}
          placeholder="Опишите регламент, инструкцию или правила…"
          value={draft.content}
          onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          className="flex w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 resize-y min-h-[160px]"
        />
        <p className="text-[11px] text-zinc-400">
          Поддерживается перенос строки. Текст отображается как написан.
        </p>
      </div>

      {/* Images */}
      <div className="space-y-2">
        <Label>Фото / Инфографика</Label>
        {draft.images.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {draft.images.map((url, i) => (
              <div
                key={i}
                className="relative group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 aspect-video bg-zinc-100 dark:bg-zinc-800"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => onRemoveImage(i)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onImageUploadTrigger}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-400 dark:text-zinc-500 hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-500 transition-colors w-full justify-center min-h-[44px]"
        >
          {uploading
            ? <><Loader2 size={13} className="animate-spin" /> Загружаем…</>
            : <><Upload size={13} /> Добавить фото</>}
        </button>
      </div>

      {/* Links */}
      <div className="space-y-2">
        <Label>Полезные ссылки</Label>
        {draft.links.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="Название"
              value={link.name}
              onChange={(e) => onUpdateLink(i, "name", e.target.value)}
              className="w-28 shrink-0"
            />
            <Input
              placeholder="https://…"
              value={link.url}
              onChange={(e) => onUpdateLink(i, "url", e.target.value)}
              className="flex-1 min-w-0"
            />
            <button
              onClick={() => onRemoveLink(i)}
              className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddLink}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-400 dark:text-zinc-500 hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-500 transition-colors w-full justify-center min-h-[44px]"
        >
          <Plus size={13} /> Добавить ссылку
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-violet-600 hover:bg-violet-700 text-white min-h-[44px]"
        >
          {saving
            ? <><Loader2 size={13} className="animate-spin mr-1" /> Сохраняем…</>
            : <><Save size={13} className="mr-1" /> {isNew ? "Создать тему" : "Сохранить"}</>}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="min-h-[44px]"
        >
          Отмена
        </Button>
        {!isNew && onDelete && (
          <Button
            variant="outline"
            onClick={onDelete}
            disabled={deleting}
            className="text-red-500 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950 min-h-[44px]"
          >
            {deleting
              ? <Loader2 size={13} className="animate-spin" />
              : <Trash2 size={13} />}
          </Button>
        )}
      </div>
    </div>
  );
}
