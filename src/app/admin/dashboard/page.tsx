"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2, XCircle, Tag, Pencil, Trash2, Archive,
  ArchiveRestore, Plus, Flame, Star, Sparkles, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbCategory, DbProduct } from "@/lib/db-types";
import { useTranslations, getName } from "@/lib/i18n";
import { useIsStrictOwner } from "@/lib/role-context";
import { useBranchRestaurantId } from "@/lib/branch-context";
import ProductModal from "@/components/admin/ProductModal";
import CategoryModal from "@/components/admin/CategoryModal";

type ProductModalState = { mode: "create" | "edit"; product?: DbProduct } | null;
type CategoryModalState = { mode: "create" | "edit"; category?: DbCategory } | null;
type DeleteState = { type: "product" | "category"; id: string; label: string } | null;

export default function CatalogPage() {
  const restaurantId = useBranchRestaurantId() ?? "";
  const { t, lang } = useTranslations();
  const isStrictOwner = useIsStrictOwner();

  const [categories, setCategories]       = useState<DbCategory[]>([]);
  const [products, setProducts]           = useState<DbProduct[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState<string | null>(null);
  const [editPrice, setEditPrice]         = useState<{ id: string; val: string } | null>(null);
  const [showArchived, setShowArchived]   = useState(false);

  const [productModal, setProductModal]   = useState<ProductModalState>(null);
  const [categoryModal, setCategoryModal] = useState<CategoryModalState>(null);
  const [deleteState, setDeleteState]     = useState<DeleteState>(null);
  const [deleting, setDeleting]           = useState(false);

  // Mobile two-step navigation: null = show categories, string = show that category's dishes
  const [mobileCatId, setMobileCatId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    const [catsRes, prodsRes] = await Promise.all([
      supabase.from("categories").select("*").eq("restaurant_id", restaurantId).order("order_index"),
      supabase.from("products").select("*").eq("restaurant_id", restaurantId).order("order_index"),
    ]);
    const cats = (catsRes.data as DbCategory[]) ?? [];
    setCategories(cats);
    setProducts((prodsRes.data as DbProduct[]) ?? []);
    setSelectedCatId((prev) => prev ?? cats[0]?.id ?? null);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const visibleProducts = products.filter((p) =>
    (!selectedCatId || p.category_id === selectedCatId) &&
    (showArchived ? p.is_archived : !p.is_archived)
  );
  const selectedCat = categories.find((c) => c.id === selectedCatId);

  /* ── Availability toggle ── */
  async function toggleAvailable(p: DbProduct) {
    if (!isConfigured) return;
    setSaving(p.id);
    await supabase.from("products").update({ is_available: !p.is_available }).eq("id", p.id);
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_available: !p.is_available } : x));
    setSaving(null);
  }

  /* ── Archive toggle ── */
  async function toggleArchive(p: DbProduct) {
    if (!isConfigured) return;
    setSaving(p.id);
    await supabase.from("products").update({ is_archived: !p.is_archived }).eq("id", p.id);
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_archived: !p.is_archived } : x));
    setSaving(null);
  }

  /* ── Inline price edit ── */
  async function commitPrice(id: string) {
    if (!isConfigured || !editPrice || editPrice.id !== id) { setEditPrice(null); return; }
    const price = parseInt(editPrice.val, 10);
    if (!isNaN(price) && price >= 0) {
      setSaving(id);
      await supabase.from("products").update({ price }).eq("id", id);
      setProducts((prev) => prev.map((x) => x.id === id ? { ...x, price } : x));
      setSaving(null);
    }
    setEditPrice(null);
  }

  /* ── Delete (product or category) ── */
  async function confirmDelete() {
    if (!isConfigured || !deleteState) return;
    setDeleting(true);
    if (deleteState.type === "product") {
      await supabase.from("products").delete().eq("id", deleteState.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteState.id));
    } else {
      // Delete all products in the category first, then the category
      await supabase.from("products").delete().eq("category_id", deleteState.id);
      await supabase.from("categories").delete().eq("id", deleteState.id);
      setProducts((prev) => prev.filter((p) => p.category_id !== deleteState.id));
      setCategories((prev) => prev.filter((c) => c.id !== deleteState.id));
      if (selectedCatId === deleteState.id) setSelectedCatId(null);
    }
    setDeleting(false);
    setDeleteState(null);
  }

  /* ── Modal callbacks ── */
  function onProductSaved(saved: DbProduct) {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      return idx >= 0 ? prev.map((p) => p.id === saved.id ? saved : p) : [...prev, saved];
    });
    setProductModal(null);
  }

  function onCategorySaved(saved: DbCategory) {
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      return idx >= 0 ? prev.map((c) => c.id === saved.id ? saved : c) : [...prev, saved];
    });
    setSelectedCatId(saved.id);
    setCategoryModal(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-600 text-sm">
        {t.admin.loadingCatalog}
      </div>
    );
  }

  const totalAvail = products.filter((p) => !p.is_archived && p.is_available).length;
  const totalActive = products.filter((p) => !p.is_archived).length;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.catalogTitle}</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {categories.length} {t.admin.categories} · {totalAvail}/{totalActive} {t.admin.available}
            </p>
          </div>
          <button
            onClick={() => setProductModal({ mode: "create" })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={14} />
            {t.admin.addProduct}
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Categories panel — on mobile: full width when no category selected, hidden otherwise */}
          <aside className={`${mobileCatId !== null ? "hidden md:flex" : "flex"} w-full md:w-64 md:shrink-0 border-r border-zinc-200 dark:border-zinc-800/60 overflow-y-auto flex-col`}>
            <div className="p-2.5">
              <button
                onClick={() => setCategoryModal({ mode: "create" })}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 text-xs font-medium transition-all mb-1"
              >
                <Plus size={12} />
                {t.admin.addCategory}
              </button>

              {categories.length === 0 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-600 px-3 py-2">
                  {t.admin.noCategories}
                </p>
              )}

              {categories.map((cat) => {
                const cp  = products.filter(p => p.category_id === cat.id && !p.is_archived);
                const av  = cp.filter(p => p.is_available).length;
                const sel = cat.id === selectedCatId;
                return (
                  <div key={cat.id} className="group relative mb-0.5">
                    <button
                      onClick={() => { setSelectedCatId(cat.id); setMobileCatId(cat.id); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 md:py-2.5 min-h-[48px] md:min-h-0 rounded-xl text-left transition-all ${
                        sel
                          ? "bg-violet-50 dark:bg-violet-600/15 border border-violet-200 dark:border-violet-500/20"
                          : "border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate leading-tight ${
                          sel ? "text-violet-700 dark:text-violet-200" : "text-zinc-600 dark:text-zinc-300"
                        }`}>
                          {getName(cat.name, lang)}
                        </p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">
                          {av}/{cp.length} {t.admin.available}
                        </p>
                      </div>
                      {/* Chevron: mobile only, shows navigation hint */}
                      <ChevronRight size={14} className="md:hidden shrink-0 text-zinc-300 dark:text-zinc-600" />
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={() => setCategoryModal({ mode: "edit", category: cat })}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => setDeleteState({ type: "category", id: cat.id, label: getName(cat.name, lang) })}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Products panel — on mobile: hidden when no category selected, full width otherwise */}
          <div className={`${mobileCatId === null ? "hidden md:block" : "block"} flex-1 overflow-y-auto`}>
            {/* Mobile back button */}
            <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0">
              <button
                onClick={() => setMobileCatId(null)}
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors min-h-[44px]"
              >
                <ChevronLeft size={16} />
                {t.admin.backToCategories}
              </button>
            </div>
            <div className="p-4 md:p-6">
              {/* Sub-header */}
              {selectedCat && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-lg leading-none">{selectedCat.icon ?? "🍽️"}</span>
                  <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                    {getName(selectedCat.name, lang)}
                  </h2>
                  <span className="text-xs text-zinc-400 dark:text-zinc-600 ml-1">
                    {visibleProducts.length} {t.admin.items}
                  </span>
                  <div className="ml-auto">
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${
                        showArchived
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                      }`}
                    >
                      {t.admin.showArchived}
                    </button>
                  </div>
                </div>
              )}

              {visibleProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <p className="text-zinc-400 dark:text-zinc-600 text-sm">{t.admin.noProducts}</p>
                  <button
                    onClick={() => setProductModal({ mode: "create" })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Plus size={12} />
                    {t.admin.addProduct}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/40">
                  {visibleProducts.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-start gap-3 px-4 md:px-5 py-3 transition-opacity ${
                        !p.is_available || p.is_archived
                          ? "bg-zinc-50 dark:bg-zinc-900/10 opacity-60"
                          : "bg-white dark:bg-zinc-900/30"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mt-0.5">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl leading-none">{p.emoji ?? "🍽️"}</span>
                        )}
                      </div>

                      {/* Name + badges + mobile action row */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                            {getName(p.name, lang)}
                          </span>
                          {p.is_new && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                              <Sparkles size={8} /> NEW
                            </span>
                          )}
                          {p.is_popular && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                              <Star size={8} /> TOP
                            </span>
                          )}
                          {p.is_spicy && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                              <Flame size={8} /> HOT
                            </span>
                          )}
                          {p.badge && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                              <Tag size={8} /> {p.badge}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 truncate mt-0.5">
                            {getName(p.description, lang)}
                          </p>
                        )}

                        {/* Mobile-only: price + action buttons below the name */}
                        <div className="flex items-center gap-2 mt-2 md:hidden">
                          <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400 select-none">
                            {p.price.toLocaleString()}₸
                          </span>
                          {!p.is_available && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                              Выкл
                            </span>
                          )}
                          <div className="flex items-center gap-0.5 ml-auto">
                            <button
                              onClick={() => setProductModal({ mode: "edit", product: p })}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => toggleArchive(p)}
                              disabled={saving === p.id}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                            >
                              {p.is_archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                            </button>
                            <button
                              onClick={() => setDeleteState({ type: "product", id: p.id, label: getName(p.name, lang) })}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop-only: price + toggle + action buttons */}
                      <div className="hidden md:flex items-center gap-3 shrink-0">
                        {/* Price (inline edit — owner only) */}
                        <div className="shrink-0">
                          {!isStrictOwner ? (
                            <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400 px-3 py-1.5 select-none">
                              {p.price.toLocaleString()}₸
                            </span>
                          ) : editPrice?.id === p.id ? (
                            <input
                              autoFocus
                              type="number"
                              min={0}
                              value={editPrice.val}
                              onChange={(e) => setEditPrice({ id: p.id, val: e.target.value })}
                              onBlur={() => commitPrice(p.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitPrice(p.id);
                                if (e.key === "Escape") setEditPrice(null);
                              }}
                              className="w-24 bg-white dark:bg-zinc-800 border border-violet-500/60 rounded-lg text-zinc-900 dark:text-zinc-100 text-sm text-right px-2.5 py-1.5 focus:outline-none tabular-nums"
                            />
                          ) : (
                            <button
                              onClick={() => !saving && setEditPrice({ id: p.id, val: String(p.price) })}
                              title="Click to edit price"
                              className="text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/40 rounded-lg px-3 py-1.5 transition-all tabular-nums"
                            >
                              {p.price.toLocaleString()}₸
                            </button>
                          )}
                        </div>

                        {/* Available toggle */}
                        <button
                          onClick={() => toggleAvailable(p)}
                          disabled={saving === p.id || p.is_archived}
                          className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                            saving === p.id
                              ? "opacity-40 cursor-wait border-zinc-300 dark:border-zinc-700 text-zinc-400"
                              : p.is_available
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                              : "bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20 hover:bg-red-500/20"
                          }`}
                        >
                          {p.is_available
                            ? <><CheckCircle2 size={12} /> {t.admin.on}</>
                            : <><XCircle size={12} /> {t.admin.off}</>
                          }
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => setProductModal({ mode: "edit", product: p })}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title={t.admin.editProduct}
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Archive */}
                        <button
                          onClick={() => toggleArchive(p)}
                          disabled={saving === p.id}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                          title={p.is_archived ? t.admin.unarchive : t.admin.archive}
                        >
                          {p.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteState({ type: "product", id: p.id, label: getName(p.name, lang) })}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title={t.admin.delete}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product Modal */}
      {productModal && (
        <ProductModal
          mode={productModal.mode}
          product={productModal.product}
          categories={categories}
          defaultCategoryId={selectedCatId ?? undefined}
          restaurantId={restaurantId}
          onClose={() => setProductModal(null)}
          onSaved={onProductSaved}
        />
      )}

      {/* Category Modal */}
      {categoryModal && (
        <CategoryModal
          mode={categoryModal.mode}
          category={categoryModal.category}
          restaurantId={restaurantId}
          onClose={() => setCategoryModal(null)}
          onSaved={onCategorySaved}
        />
      )}

      {/* Delete Confirm Dialog */}
      {deleteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteState(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              {t.admin.delete} &ldquo;{deleteState.label}&rdquo;?
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
              {deleteState.type === "product"
                ? t.admin.deleteProductConfirm
                : t.admin.deleteCategoryConfirm
              }
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteState(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t.admin.cancel}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60"
              >
                {deleting ? "…" : t.admin.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
