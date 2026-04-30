"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "@/lib/i18n";
import { RESTAURANT_ID } from "@/constants";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Flag = "is_promo" | "is_recommended" | "is_new";

interface Category {
  id: string;
  name: { en: string; ru: string; kz: string };
}

interface Product {
  id: string;
  category_id: string;
  name: { en: string; ru: string; kz: string };
  emoji: string | null;
  image_url: string | null;
  price: number;
  discount_label: string | null;
  is_promo: boolean;
  is_recommended: boolean;
  is_new: boolean;
  is_archived: boolean;
}

const TABS: { key: Flag; labelKey: "tabPromos" | "tabRecommended" | "tabNew" }[] = [
  { key: "is_promo",       labelKey: "tabPromos" },
  { key: "is_recommended", labelKey: "tabRecommended" },
  { key: "is_new",         labelKey: "tabNew" },
];

export default function StorefrontPage() {
  const { t } = useTranslations();
  const [categories, setCategories]   = useState<Category[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<Flag>("is_promo");
  const [toggling, setToggling]       = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [activeCat, setActiveCat]     = useState<string | null>(null);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", RESTAURANT_ID)
        .order("order_index"),
      supabase
        .from("products")
        .select("id, category_id, name, emoji, image_url, price, discount_label, is_promo, is_recommended, is_new, is_archived")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("is_archived", false)
        .order("name->en"),
    ]);
    if (cats) setCategories(cats as Category[]);
    if (prods) {
      const p = prods as Product[];
      setProducts(p);
      const drafts: Record<string, string> = {};
      p.forEach(prod => { drafts[prod.id] = prod.discount_label ?? ""; });
      setLabelDrafts(drafts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(productId: string, flag: Flag, current: boolean) {
    setToggling(productId + flag);
    setProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, [flag]: !current } : p)
    );
    const { error } = await supabase
      .from("products")
      .update({ [flag]: !current })
      .eq("id", productId);
    if (error) {
      setProducts(prev =>
        prev.map(p => p.id === productId ? { ...p, [flag]: current } : p)
      );
      toast.error("Failed to update product");
    } else {
      toast.success("Product updated");
    }
    setToggling(null);
  }

  async function saveLabel(productId: string) {
    const draft = (labelDrafts[productId] ?? "").trim();
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (draft === (product.discount_label ?? "")) return;

    const newVal = draft || null;
    setProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, discount_label: newVal } : p)
    );
    const { error } = await supabase
      .from("products")
      .update({ discount_label: newVal })
      .eq("id", productId);
    if (error) {
      setProducts(prev =>
        prev.map(p => p.id === productId ? { ...p, discount_label: product.discount_label } : p)
      );
      setLabelDrafts(prev => ({ ...prev, [productId]: product.discount_label ?? "" }));
      toast.error("Failed to save label");
    } else {
      toast.success(newVal ? "Label saved" : "Label removed");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      const matchesCat = activeCat === null || p.category_id === activeCat;
      const matchesSearch =
        !q ||
        p.name.ru?.toLowerCase().includes(q) ||
        p.name.en?.toLowerCase().includes(q) ||
        p.name.kz?.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [products, activeCat, search]);

  const flaggedCount = filtered.filter(p => p[activeTab]).length;

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold">{t.admin.navMainScreen}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t.admin.descMainScreen}</p>
      </header>

      <div className="px-8 pt-4 pb-0 border-b border-border shrink-0">
        <Tabs value={activeTab} onValueChange={(v) => { if (v) setActiveTab(v as Flag); }}>
          <TabsList variant="line">
            {TABS.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {t.admin[tab.labelKey]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground text-sm">
            <Loader2 size={16} className="animate-spin" />
            {t.admin.loadingCatalog}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm pt-12">
            {t.admin.noFlaggedProducts}
          </p>
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t.admin.searchPlaceholder}
                className="pl-8"
              />
            </div>

            {/* Category filter */}
            {categories.length > 0 && (
              <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setActiveCat(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeCat === null
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t.admin.allCategories}
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCat(cat.id === activeCat ? null : cat.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeCat === cat.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cat.name?.ru ?? cat.name?.en ?? "—"}
                  </button>
                ))}
              </div>
            )}

            {/* Count badge */}
            <div className="flex items-center gap-2 mb-5">
              <Badge variant={flaggedCount > 0 ? "default" : "secondary"}>
                {flaggedCount}
              </Badge>
              <span className="text-xs text-muted-foreground">
                / {filtered.length} {t.admin.items}
              </span>
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm pt-8">
                {t.admin.noSearchResults}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {filtered.map(product => {
                  const isOn      = product[activeTab];
                  const isLoading = toggling === product.id + activeTab;
                  const label     = product.discount_label;
                  const draft     = labelDrafts[product.id] ?? "";

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isLoading && toggle(product.id, activeTab, isOn)}
                      className={`flex flex-col gap-3 p-4 rounded-xl border cursor-pointer transition-all select-none ${
                        isOn
                          ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                          : "border-border bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Photo with badge overlay, or emoji */}
                        {product.image_url ? (
                          <div className="relative w-12 h-12 shrink-0">
                            <img
                              src={product.image_url}
                              alt={product.name?.ru ?? product.name?.en ?? ""}
                              className="w-full h-full rounded-lg object-cover"
                            />
                            {label && (
                              <Badge className="absolute bottom-0.5 left-0.5 bg-destructive text-white border-0 text-[9px] px-1 py-0 h-4 leading-none rounded-md">
                                {label}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="relative shrink-0">
                            <span className="text-2xl leading-none">{product.emoji ?? "🍽️"}</span>
                            {label && (
                              <Badge className="absolute -bottom-1 -right-2 bg-destructive text-white border-0 text-[9px] px-1 py-0 h-4 leading-none rounded-md">
                                {label}
                              </Badge>
                            )}
                          </div>
                        )}

                        {isLoading ? (
                          <Loader2 size={14} className="animate-spin text-muted-foreground mt-0.5 shrink-0" />
                        ) : (
                          <Switch
                            checked={isOn}
                            size="sm"
                            className="pointer-events-none shrink-0"
                            aria-hidden
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {product.name?.ru ?? product.name?.en ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {product.price.toLocaleString()} ₸
                        </p>
                      </div>

                      {/* Discount label input — stopPropagation prevents card toggle */}
                      <div onClick={e => e.stopPropagation()}>
                        <Input
                          value={draft}
                          onChange={e =>
                            setLabelDrafts(prev => ({ ...prev, [product.id]: e.target.value }))
                          }
                          onBlur={() => saveLabel(product.id)}
                          onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                          placeholder={t.admin.discountLabelPlaceholder}
                          className="h-7 text-xs"
                          maxLength={20}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
