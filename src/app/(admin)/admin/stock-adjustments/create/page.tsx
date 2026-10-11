"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Building2,
  Package,
  Layers,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  FileText,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiGet, apiPost, getImageUrl } from "@/lib/api-client";
import Image from "next/image";

interface BranchItem {
  id: string;
  name: string;
  code: string;
}

interface ProductVariantItem {
  id: string;
  sku: string;
  color?: string | null;
  quality?: string | null;
  stock: number;
  price: number | string;
}

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  regularPrice: number | string;
  salePrice?: number | string | null;
  category?: { id: string; name: string; slug: string } | null;
  brand?: { id: string; name: string } | null;
  images?: { url: string }[];
  variants: ProductVariantItem[];
  totalStock?: number;
}

interface CategoryTreeItem {
  id: string;
  name: string;
  slug: string;
  children?: CategoryTreeItem[];
}

interface PendingAdjustmentItem {
  key: string;
  productId: string;
  productName: string;
  productImage?: string;
  categoryName?: string;
  variantId: string;
  variantSku: string;
  color?: string | null;
  quality?: string | null;
  type: "INCREASE" | "DECREASE";
  quantity: number;
  stockNow: number;
}

export default function CreateStockAdjustmentPage() {
  const { setTitle, setBadge, setDateFilter, selectedBranchId } = useAdminPage();
  const router = useRouter();

  // Master Data
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Top Filter / Branch Selection
  const [branchId, setBranchId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [modalAdjustmentType, setModalAdjustmentType] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [modalQuantity, setModalQuantity] = useState<number>(1);

  // Batch List & Finalization State
  const [pendingItems, setPendingItems] = useState<PendingAdjustmentItem[]>([]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setTitle("Create Stock Adjustment");
    setBadge("Inventory");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  // Initial Data Fetching
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [branchRes, catRes, prodRes] = await Promise.all([
        apiGet<BranchItem[]>("/branches/public"),
        apiGet<CategoryTreeItem[]>("/categories/tree"),
        apiGet<{ data: ProductItem[] }>("/products/admin", { limit: 100 }),
      ]);

      if (Array.isArray(branchRes)) {
        setBranches(branchRes);
        if (branchRes.length > 0) {
          const matched = selectedBranchId && selectedBranchId !== "all"
            ? branchRes.find((b) => b.id === selectedBranchId)
            : branchRes[0];
          setBranchId(matched ? matched.id : branchRes[0].id);
        }
      }

      if (Array.isArray(catRes)) {
        // Flatten category tree to simple list
        const flat: { id: string; name: string; slug: string }[] = [];
        const extractCats = (items: CategoryTreeItem[]) => {
          items.forEach((c) => {
            flat.push({ id: c.id, name: c.name, slug: c.slug });
            if (c.children && c.children.length > 0) {
              extractCats(c.children);
            }
          });
        };
        extractCats(catRes);
        setCategories(flat);
      }

      if (prodRes?.data) {
        setProducts(prodRes.data);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load catalog data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Filtered Products for Catalog Grid
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategorySlug !== "all") {
        if (p.category?.slug !== selectedCategorySlug && p.category?.id !== selectedCategorySlug) {
          return false;
        }
      }

      // Product search (token matching across name, code, slug, brand, variant SKU/spec)
      if (productSearch.trim()) {
        const tokens = productSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const matchesAllTokens = tokens.every((tok) => {
          const inName = p.name.toLowerCase().includes(tok);
          const inCode = ((p as any).code || "").toLowerCase().includes(tok);
          const inSlug = (p.slug || "").toLowerCase().includes(tok);
          const inBrand = (p.brand?.name || "").toLowerCase().includes(tok);
          const inVariants = (p.variants || []).some(
            (v) =>
              (v.sku || "").toLowerCase().includes(tok) ||
              (v.color || "").toLowerCase().includes(tok) ||
              (v.quality || "").toLowerCase().includes(tok)
          );
          return inName || inCode || inSlug || inBrand || inVariants;
        });
        if (!matchesAllTokens) return false;
      }

      // Brand search
      if (brandSearch.trim()) {
        const bQuery = brandSearch.toLowerCase().trim();
        const matchesBrand = p.brand?.name?.toLowerCase().includes(bQuery);
        if (!matchesBrand) return false;
      }

      return true;
    });
  }, [products, selectedCategorySlug, productSearch, brandSearch]);

  // Open Modal for a Product
  const handleOpenProductModal = (product: ProductItem) => {
    setSelectedProduct(product);
    setModalAdjustmentType("INCREASE");
    setModalQuantity(1);

    // Pick first variant's attributes
    if (product.variants && product.variants.length > 0) {
      const first = product.variants[0];
      setSelectedColor(first.color || null);
      setSelectedQuality(first.quality || null);
    } else {
      setSelectedColor(null);
      setSelectedQuality(null);
    }

    setIsModalOpen(true);
  };

  // Find active variant in modal
  const activeModalVariant = useMemo(() => {
    if (!selectedProduct || !selectedProduct.variants || selectedProduct.variants.length === 0) {
      return null;
    }

    // Match by color and quality
    let match = selectedProduct.variants.find((v) => {
      const colorMatch = selectedColor ? v.color === selectedColor : true;
      const qualityMatch = selectedQuality ? v.quality === selectedQuality : true;
      return colorMatch && qualityMatch;
    });

    return match || selectedProduct.variants[0];
  }, [selectedProduct, selectedColor, selectedQuality]);

  // Distinct colors and qualities for current product
  const availableColors = useMemo(() => {
    if (!selectedProduct?.variants) return [];
    const set = new Set<string>();
    selectedProduct.variants.forEach((v) => {
      if (v.color) set.add(v.color);
    });
    return Array.from(set);
  }, [selectedProduct]);

  const availableQualities = useMemo(() => {
    if (!selectedProduct?.variants) return [];
    const set = new Set<string>();
    selectedProduct.variants.forEach((v) => {
      if (v.quality) set.add(v.quality);
    });
    return Array.from(set);
  }, [selectedProduct]);

  // Add Item to Pending List
  const handleAddToList = () => {
    if (!selectedProduct) return;
    if (!activeModalVariant) {
      toast.error("Selected variant combination does not exist.");
      return;
    }

    const currentStock = Number(activeModalVariant.stock || 0);
    const qty = Number(modalQuantity) || 1;

    if (qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    const key = `${activeModalVariant.id}-${modalAdjustmentType}`;

    // Add or replace item in pending list
    setPendingItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.key === key);
      const newItem: PendingAdjustmentItem = {
        key,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productImage: selectedProduct.images?.[0]?.url || "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=200&h=200&fit=crop",
        categoryName: selectedProduct.category?.name || "General",
        variantId: activeModalVariant.id,
        variantSku: activeModalVariant.sku,
        color: activeModalVariant.color,
        quality: activeModalVariant.quality,
        type: modalAdjustmentType,
        quantity: qty,
        stockNow: currentStock,
      };

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newItem;
        return updated;
      }
      return [...prev, newItem];
    });

    toast.success(`Added "${selectedProduct.name}" (${activeModalVariant.sku}) to adjustment list`);
    setIsModalOpen(false);
  };

  // Remove Item from Pending List
  const handleRemovePendingItem = (key: string) => {
    setPendingItems((prev) => prev.filter((i) => i.key !== key));
    toast.info("Item removed from adjustment list");
  };

  // Submit Final Batch Adjustment
  const handleSubmitBatch = async () => {
    if (!branchId) {
      toast.error("Please select a target branch");
      return;
    }
    if (pendingItems.length === 0) {
      toast.error("Please add at least one item to the adjustment list");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please enter a reason for this adjustment");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        branchId,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        items: pendingItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          type: item.type,
          quantity: Number(item.quantity),
        })),
      };

      await apiPost("/stock-adjustments/batch", payload);

      toast.success(`Successfully recorded batch adjustment of ${pendingItems.length} item(s)!`);
      router.push("/admin/stock-adjustments");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit batch adjustment request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* B1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Stock Adjustment</h1>
            <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
              Batch Builder
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Create a new multi-item adjustment request for branch inventory
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Branch Picker */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              if (pendingItems.length > 0 && !window.confirm("You have unsaved adjustment items. Discard and leave?")) {
                return;
              }
              router.push("/admin/stock-adjustments");
            }}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-xl transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to List
          </button>
        </div>
      </div>

      {/* B2. Branch Catalog Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              Branch Catalog
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Click any product to configure quantity and add to adjustment list</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full self-start md:self-auto">
            Showing {filteredProducts.length} products
          </span>
        </div>

        {/* Dual Search Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products by name or code..."
              className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium focus:bg-white"
            />
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder="Search Brand..."
              className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium focus:bg-white"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategorySlug("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
              selectedCategorySlug === "all"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategorySlug(c.slug || c.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                selectedCategorySlug === c.slug || selectedCategorySlug === c.id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Loading branch catalog products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No products found matching the current search filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const totalStock = product.variants?.reduce((sum, v) => sum + Number(v.stock || 0), 0) ?? 0;
              const imgUrl = product.images?.[0]?.url || "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=200&h=200&fit=crop";

              return (
                <div
                  key={product.id}
                  onClick={() => handleOpenProductModal(product)}
                  className="group flex items-center gap-3.5 p-3.5 bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-400 rounded-2xl cursor-pointer transition-all duration-150 hover:shadow-sm"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 relative">
                    <Image
                      src={getImageUrl(imgUrl)}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                      unoptimized
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-emerald-700 transition-colors" title={product.name}>
                      {product.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                        {product.category?.name || "General"}
                      </span>

                      {/* Stock Badge */}
                      {totalStock > 5 ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                          {totalStock} Left
                        </span>
                      ) : totalStock > 0 ? (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                          {totalStock} Left
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                          0 Left
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* B3. Product Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-6 rounded-2xl">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900">Product Details</DialogTitle>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-5 pt-2">
              {/* Product Info */}
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 leading-snug">
                  {selectedProduct.name}
                </h3>
                {selectedProduct.category && (
                  <span className="inline-block mt-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    {selectedProduct.category.name}
                  </span>
                )}
              </div>

              {/* Color Pill Row */}
              {availableColors.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          selectedColor === color
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quality Pill Row */}
              {availableQualities.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Quality
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableQualities.map((qual) => (
                      <button
                        key={qual}
                        type="button"
                        onClick={() => setSelectedQuality(qual)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          selectedQuality === qual
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {qual}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Adjustment Type Toggles */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Adjustment Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModalAdjustmentType("INCREASE")}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                      modalAdjustmentType === "INCREASE"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    + Addition
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalAdjustmentType("DECREASE")}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                      modalAdjustmentType === "DECREASE"
                        ? "bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 text-rose-600" />
                    - Subtraction
                  </button>
                </div>
              </div>

              {/* Available Stock & Quantity Stepper */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Available Stock
                  </span>
                  <div className="text-xl font-black text-slate-800">
                    {Number(activeModalVariant?.stock || 0)} <span className="text-xs font-semibold text-slate-500">Units</span>
                  </div>
                  {activeModalVariant && (
                    <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                      SKU: {activeModalVariant.sku}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Quantity
                  </span>
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setModalQuantity((prev) => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={modalQuantity}
                      onChange={(e) => setModalQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full text-center font-bold text-sm text-slate-800 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setModalQuantity((prev) => prev + 1)}
                      className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Add to List Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAddToList}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" /> Add to List
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* B4. Adjustment Items Table */}
      {pendingItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              Adjustment Items
            </h3>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              {pendingItems.length} Items Selected
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-400">
                  <th className="pb-3 pl-2">Specification</th>
                  <th className="pb-3 px-3">Type</th>
                  <th className="pb-3 px-3 text-right">Stock Now</th>
                  <th className="pb-3 px-3 text-right">Adj. Qty</th>
                  <th className="pb-3 px-3 text-right">Stock After</th>
                  <th className="pb-3 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingItems.map((item) => {
                  const stockNow = Number(item.stockNow);
                  const qty = Number(item.quantity);
                  const stockAfter = item.type === "INCREASE" ? stockNow + qty : stockNow - qty;

                  return (
                    <tr key={item.key} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 pl-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                            <Image
                              src={getImageUrl(item.productImage)}
                              alt={item.productName}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 leading-tight">{item.productName}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              {item.color ? `Color: ${item.color}` : ""} {item.quality ? `• Quality: ${item.quality}` : ""} • SKU: {item.variantSku}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {item.type === "INCREASE" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                            <ArrowUpRight className="w-3.5 h-3.5" /> + Add
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
                            <ArrowDownRight className="w-3.5 h-3.5" /> - Sub
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-600">
                        {stockNow}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-slate-800">
                        {qty}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <span
                          className={`font-black text-sm ${
                            stockAfter > stockNow
                              ? "text-emerald-700"
                              : stockAfter < stockNow
                              ? "text-rose-700"
                              : "text-slate-800"
                          }`}
                        >
                          {stockAfter}
                        </span>
                      </td>

                      <td className="py-3.5 pr-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemovePendingItem(item.key)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* B5. Finalization Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <FileText className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900">Finalization</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Adjustment Note / Reason *
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the reason for this adjustment (e.g., Damage, Inventory count discrepancy...)"
              className="resize-none h-24 text-sm font-medium border-slate-200 rounded-xl"
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            {/* Informational Note */}
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Requires Admin Verification</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  if (pendingItems.length > 0 && !window.confirm("Discard selected adjustment items and go back?")) {
                    return;
                  }
                  router.push("/admin/stock-adjustments");
                }}
                className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmitBatch}
                disabled={isSubmitting || pendingItems.length === 0 || !reason.trim()}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? "Submitting..." : "Submit Adjustment Request"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

