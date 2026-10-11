"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Eye,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  RotateCcw,
  Package,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch, apiDelete, apiPost, getImageUrl } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminTableState } from "@/components/admin/AdminTableState";

export interface AdminProductItem {
  id: string;
  code?: string | null;
  name: string;
  slug: string;
  regularPrice: number | string;
  salePrice?: number | string | null;
  costPrice?: number | string | null;
  status: "ACTIVE" | "DRAFT" | "OUT_OF_STOCK";
  isNewest: boolean;
  isFeatured: boolean;
  isHomepage: boolean;
  isBestDeal: boolean;
  totalStock: number;
  category?: { id: string; name: string; slug: string } | null;
  brand?: { id: string; name: string; logo?: string | null } | null;
  images?: Array<{ id: string; url: string; sortOrder: number }>;
  variants?: Array<{ id: string; sku: string; price: number; stock: number }>;
}

export default function AllProductsPage() {
  const { setTitle, setBadge, setDateFilter, selectedBranchId, selectedBranchName } = useAdminPage();
  const router = useRouter();

  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const limit = 20;
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  // Filters State
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedSort, setSelectedSort] = useState("latest");
  const [filterHomepage, setFilterHomepage] = useState("all");
  const [filterNewest, setFilterNewest] = useState("all");
  const [filterFeatured, setFilterFeatured] = useState("all");
  const [filterBestDeal, setFilterBestDeal] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Row Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const [cats, brs] = await Promise.all([
        apiGet<any[]>("/products/categories").catch(() => apiGet<any[]>("/categories")),
        apiGet<any[]>("/products/brands").catch(() => apiGet<any[]>("/brands")),
      ]);
      setCategories(cats || []);
      setBrands(brs || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        limit,
      };

      if (selectedBranchId && selectedBranchId !== "all") {
        params.branchId = selectedBranchId;
      }

      if (activeSearch.trim()) params.search = activeSearch.trim();
      if (selectedCategory !== "all") params.categoryId = selectedCategory;
      if (selectedBrand !== "all") params.brandId = selectedBrand;
      if (selectedSort !== "latest") params.sort = selectedSort;
      if (filterHomepage !== "all") params.homepage = filterHomepage === "yes";
      if (filterNewest !== "all") params.newest = filterNewest === "yes";
      if (filterFeatured !== "all") params.featured = filterFeatured === "yes";
      if (filterBestDeal !== "all") params.bestDeal = filterBestDeal === "yes";
      if (filterStatus !== "all") params.status = filterStatus;

      const res = await apiGet<{ data: AdminProductItem[]; meta: any }>("/products/admin", params);
      setProducts(res?.data || []);
      if (res?.meta) {
        setMeta({
          total: res.meta.total || 0,
          page: res.meta.page || 1,
          limit: res.meta.limit || 20,
          totalPages: res.meta.totalPages || 1,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load products");
      toast.error(err.message || "Failed to load products");
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    limit,
    selectedBranchId,
    activeSearch,
    selectedCategory,
    selectedBrand,
    selectedSort,
    filterHomepage,
    filterNewest,
    filterFeatured,
    filterBestDeal,
    filterStatus,
  ]);

  useEffect(() => {
    setTitle("Product List");
    setBadge("Website");
    setDateFilter("");
    fetchDropdowns();
  }, [setTitle, setBadge, setDateFilter, fetchDropdowns]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search.trim());
  };

  const handleResetFilters = () => {
    setSearch("");
    setActiveSearch("");
    setSelectedCategory("all");
    setSelectedBrand("all");
    setSelectedSort("latest");
    setFilterHomepage("all");
    setFilterNewest("all");
    setFilterFeatured("all");
    setFilterBestDeal("all");
    setFilterStatus("all");
    setSelectedIds([]);
    setPage(1);
  };

  // Instant Switch Flag Toggle with optimistic UI update and rollback
  const handleToggleFlag = async (
    product: AdminProductItem,
    flagKey: "isNewest" | "isFeatured" | "isHomepage" | "isBestDeal"
  ) => {
    const nextVal = !product[flagKey];

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, [flagKey]: nextVal } : p))
    );

    try {
      await apiPatch(`/products/${product.id}/toggle`, {
        [flagKey]: nextVal,
      });
      fetch("/api/revalidate?path=/").catch(() => {});
      toast.success(
        `Updated ${product.name}: ${flagKey} set to ${nextVal ? "ON" : "OFF"}`
      );
    } catch (err: any) {
      // Revert on failure
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, [flagKey]: !nextVal } : p))
      );
      toast.error(err.message || "Failed to update product flag");
    }
  };

  // Row Selection Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(products.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleDeleteProduct = async (product: AdminProductItem) => {
    if (!confirm(`Are you sure you want to delete product "${product.name}"?`)) return;

    try {
      await apiDelete(`/products/${product.id}`);
      fetch("/api/revalidate?path=/").catch(() => {});
      toast.success(`Product "${product.name}" deleted successfully.`);
      fetchProducts();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete product");
    }
  };

  const handleDuplicateProduct = async (product: AdminProductItem) => {
    try {
      const code = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
      await apiPost("/products", {
        name: `${product.name} (Copy)`,
        slug: `${product.slug}-copy-${Date.now().toString().slice(-4)}`,
        code,
        categoryId: product.category?.id,
        brandId: product.brand?.id,
        regularPrice: Number(product.regularPrice),
        salePrice: product.salePrice ? Number(product.salePrice) : null,
        status: "DRAFT",
      });
      toast.success(`Duplicated "${product.name}" as a new draft product.`);
      fetchProducts();
    } catch (e: any) {
      toast.error(e.message || "Failed to duplicate product");
    }
  };

  const allSelected =
    products.length > 0 && selectedIds.length === products.length;

  // Generate pagination items with ellipsis
  const paginationItems = useMemo(() => {
    const totalPages = meta.totalPages || 1;
    const current = page;
    const delta = 2;
    const range: (number | string)[] = [];

    for (
      let i = Math.max(2, current - delta);
      i <= Math.min(totalPages - 1, current + delta);
      i++
    ) {
      range.push(i);
    }

    if (current - delta > 2) {
      range.unshift("…");
    }
    range.unshift(1);

    if (current + delta < totalPages - 1) {
      range.push("…");
    }
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  }, [meta.totalPages, page]);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Product List</h2>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
              {meta.total.toLocaleString()} Products
            </Badge>
            {selectedBranchName && selectedBranchName !== "All Branches" && (
              <span className="text-xs text-slate-500 font-medium">
                • Scope: <strong className="text-slate-700">{selectedBranchName}</strong>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, filter, manage attributes and stock for all inventory items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/products/create">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 gap-1.5 shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              Create New Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Row 1 */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search product name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50/50 border-slate-200"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={selectedSort}
              onChange={(e) => {
                setSelectedSort(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="latest">Latest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
            </select>
          </div>
        </form>

        {/* Filter Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
          <select
            value={filterHomepage}
            onChange={(e) => {
              setFilterHomepage(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="all">All Homepage</option>
            <option value="yes">Homepage: Yes</option>
            <option value="no">Homepage: No</option>
          </select>

          <select
            value={filterNewest}
            onChange={(e) => {
              setFilterNewest(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="all">All Newest</option>
            <option value="yes">Newest: Yes</option>
            <option value="no">Newest: No</option>
          </select>

          <select
            value={filterFeatured}
            onChange={(e) => {
              setFilterFeatured(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="all">All Featured</option>
            <option value="yes">Featured: Yes</option>
            <option value="no">Featured: No</option>
          </select>

          <select
            value={filterBestDeal}
            onChange={(e) => {
              setFilterBestDeal(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="all">All Best Deal</option>
            <option value="yes">Best Deal: Yes</option>
            <option value="no">Best Deal: No</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="h-8 text-xs border-slate-200 text-slate-600 gap-1 hover:bg-slate-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-14">IMAGE</th>
                <th className="py-3 px-3">PRODUCT DETAILS</th>
                <th className="py-3 px-3">CATEGORY</th>
                <th className="py-3 px-3">BRAND</th>
                <th className="py-3 px-3 text-center">STOCK</th>
                <th className="py-3 px-3 text-center">NEWEST</th>
                <th className="py-3 px-3 text-center">FEATURED</th>
                <th className="py-3 px-3 text-center w-24">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              <AdminTableState
                isLoading={isLoading}
                error={error}
                isEmpty={products.length === 0}
                onRetry={fetchProducts}
                colSpan={9}
                loadingRows={6}
                emptyTitle="No records found"
                emptyDescription="Try clearing your filters or creating a new product."
                emptyActionLabel="Clear Filters"
                onEmptyAction={handleResetFilters}
              >
                {products.map((product) => {
                  const isChecked = selectedIds.includes(product.id);
                  const imgUrl = product.images?.[0]?.url
                    ? getImageUrl(product.images[0].url)
                    : "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=100&h=100&fit=crop";

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isChecked ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 cursor-pointer"
                        />
                      </td>

                      {/* Image */}
                      <td className="py-3 px-3">
                        <div className="relative w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgUrl}
                            alt={product.name}
                            className="w-full h-full object-contain p-0.5"
                          />
                        </div>
                      </td>

                      {/* Product Details (Name + Code + Price) */}
                      <td className="py-3 px-3">
                        <div>
                          <p className="font-bold text-slate-900 text-xs leading-snug">{product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-400 font-medium">
                              Code: {product.code || "--"}
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-700">
                              ৳{Number(product.regularPrice).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        {product.category ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {product.category.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </td>

                      {/* Brand */}
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {product.brand?.name || "--"}
                      </td>

                      {/* Stock Badge */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            Number(product.totalStock || 0) > 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {Number(product.totalStock || 0)} Left
                        </span>
                      </td>

                      {/* Newest Switch */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={!!product.isNewest}
                            onCheckedChange={() => handleToggleFlag(product, "isNewest")}
                            className="data-[state=checked]:bg-emerald-600 scale-90"
                          />
                        </div>
                      </td>

                      {/* Featured Switch */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={!!product.isFeatured}
                            onCheckedChange={() => handleToggleFlag(product, "isFeatured")}
                            className="data-[state=checked]:bg-amber-500 scale-90"
                          />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/product/${product.slug}`}
                            target="_blank"
                            title="View on Storefront"
                            className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white rounded-lg shadow-lg border p-1 text-xs">
                              <DropdownMenuItem
                                onClick={() => router.push(`/admin/products/${product.id}/edit`)}
                                className="cursor-pointer gap-2 py-1.5"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                                <span>Edit Product</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicateProduct(product)}
                                className="cursor-pointer gap-2 py-1.5"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-600" />
                                <span>Duplicate</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteProduct(product)}
                                className="cursor-pointer gap-2 py-1.5 text-red-600 focus:text-red-700 focus:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </AdminTableState>
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            {meta.total === 0 ? (
              "Showing 0 results"
            ) : (
              <>
                Showing{" "}
                <span className="font-semibold text-slate-800">
                  {(page - 1) * limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-800">
                  {Math.min(page * limit, meta.total)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800">
                  {meta.total.toLocaleString()}
                </span>{" "}
                results
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0 text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {paginationItems.map((item, idx) => {
              if (item === "…") {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                    …
                  </span>
                );
              }
              const isCurrent = item === page;
              return (
                <Button
                  key={idx}
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  disabled={isLoading}
                  onClick={() => setPage(Number(item))}
                  className={`h-8 min-w-8 px-2 text-xs font-semibold ${
                    isCurrent
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {item}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              className="h-8 w-8 p-0 text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
