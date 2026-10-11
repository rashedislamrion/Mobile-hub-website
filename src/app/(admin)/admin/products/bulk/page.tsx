"use client";

import { useEffect, useState } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { DownloadCloud, FileText, Clock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { exportToCsv } from "@/lib/export-utils";

export default function BulkImportExportPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();
  const [isExporting, setIsExporting] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");

  useEffect(() => {
    setTitle("Bulk Import & Export");
    setBadge("Products");
    setDateFilter("");

    apiGet<any[]>("/categories")
      .then((res) => {
        if (Array.isArray(res)) setCategories(res);
      })
      .catch(() => {});

    apiGet<any[]>("/brands")
      .then((res) => {
        if (Array.isArray(res)) setBrands(res);
      })
      .catch(() => {});
  }, [setTitle, setBadge, setDateFilter]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      toast.info("Preparing product export...");

      const params: Record<string, any> = { limit: 1000 };
      if (selectedCategory !== "all") params.categoryId = selectedCategory;
      if (selectedBrand !== "all") params.brandId = selectedBrand;

      const res = await apiGet<any>("/products", params);
      const items = Array.isArray(res) ? res : res?.items || res?.data || [];

      if (!items || items.length === 0) {
        toast.error("No products found matching the selected export filters.");
        return;
      }

      const headers = [
        "Product Name",
        "Brand",
        "Category",
        "Model",
        "Base Price",
        "Stock",
        "Status",
        "Created At",
      ];

      const rows = items.map((p: any) => [
        p.name || "",
        p.brand?.name || "",
        p.category?.name || "",
        p.model || "",
        p.basePrice || p.price || 0,
        p.stock ?? p.totalStock ?? 0,
        p.status || "ACTIVE",
        p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : "",
      ]);

      exportToCsv(`products_export_${new Date().toISOString().split("T")[0]}`, headers, rows);
      toast.success(`Exported ${rows.length} products successfully.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export products.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* LEFT COLUMN: Import Products (Honest Coming Soon state) */}
      <div className="w-full lg:w-1/2 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Import Products (Bulk CSV/Excel)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Coming Soon
            </span>
          </div>

          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h4 className="text-base font-bold text-slate-800">
                Bulk Import Feature is In Development
              </h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Automated bulk ingestion and SKU validation are currently being prepared for a future release. For current catalog management, please create or update products through the Products module.
              </p>
            </div>

            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
                <span>Status: Backend parser & multi-variant transaction engine scheduled</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Real Export Products */}
      <div className="w-full lg:w-1/2">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-slate-500" />
              Export Products
            </h3>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">All Brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm cursor-pointer shadow-sm"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Exporting Products...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Export Products as CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
