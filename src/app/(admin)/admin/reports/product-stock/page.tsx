"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Package,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { ReportKpiCard } from "@/components/admin/ReportKpiCard";
import { ReportFilterBar } from "@/components/admin/ReportFilterBar";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-utils";

interface ProductStockRecord {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  image: string | null;
  brand: string;
  category: string;
  color: string;
  quality: string;
  sku: string;
  stock: number;
  buyingPrice: number;
  sellingPrice: number;
  salePrice: number | null;
  wholesalePrice: number | null;
  branch: string;
}

export default function ProductStockReportPage() {
  const { setTitle, setBadge } = useAdminPage();

  const [data, setData] = useState<ProductStockRecord[]>([]);
  const [summary, setSummary] = useState({
    totalStockQty: 0,
    totalStockValueFIFO: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
  });
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedQuality, setSelectedQuality] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setTitle("Product Stock Report");
    setBadge("Reports");
  }, [setTitle, setBadge]);

  useEffect(() => {
    Promise.all([
      apiGet<any[]>("/brands").catch(() => []),
      apiGet<any[]>("/categories").catch(() => []),
    ]).then(([brandRes, catRes]) => {
      if (Array.isArray(brandRes)) setBrands(brandRes);
      if (Array.isArray(catRes)) setCategories(catRes);
    });
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedBrand !== "all") params.brand = selectedBrand;
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (selectedQuality !== "all") params.quality = selectedQuality;
      if (inStockOnly) params.inStockOnly = "true";
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        summary: typeof summary;
        data: ProductStockRecord[];
      }>("/reports/product-stock", params);

      setData(res?.data || []);
      if (res?.summary) setSummary(res.summary);
    } catch (err: any) {
      toast.error(err.message || "Failed to load product stock report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBrand, selectedCategory, selectedQuality, inStockOnly, searchTerm]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedBrand("all");
    setSelectedCategory("all");
    setSelectedQuality("all");
    setInStockOnly(false);
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [
      "Product Name",
      "Product Code",
      "SKU",
      "Brand",
      "Category",
      "Color",
      "Quality",
      "Current Stock",
      "Buying / Cost Price (BDT)",
      "Selling Price (BDT)",
      "Stock Valuation (BDT)",
    ];

    const rows = data.map((row) => [
      row.productName,
      row.productCode,
      row.sku,
      row.brand,
      row.category,
      row.color,
      row.quality,
      row.stock,
      row.buyingPrice,
      row.sellingPrice,
      Math.max(0, row.stock) * row.buyingPrice,
    ]);

    exportToCsv("product-stock-report", headers, rows);
  };

  const getStockBadge = (stock: number) => {
    if (stock <= 0) {
      return (
        <Badge className="bg-red-500 text-white font-mono text-xs">
          {stock} (Out of Stock)
        </Badge>
      );
    }
    if (stock <= 5) {
      return (
        <Badge className="bg-amber-500 text-white font-mono text-xs">
          {stock} (Low Stock)
        </Badge>
      );
    }
    return (
      <span className="font-mono font-bold text-foreground text-sm">
        {stock}
      </span>
    );
  };

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const paginatedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Product Stock Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time multi-variant inventory quantities, FIFO valuations, and stock level warnings
          </p>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpiCard
          label="Total Inventory Units"
          value={summary.totalStockQty}
          icon={Package}
          colorTint="blue"
        />
        <ReportKpiCard
          label="Stock Valuation (FIFO Cost)"
          value={`৳${Number(summary.totalStockValueFIFO).toLocaleString()}`}
          icon={DollarSign}
          colorTint="emerald"
        />
        <ReportKpiCard
          label="Out of Stock Items"
          value={summary.outOfStockCount}
          icon={AlertTriangle}
          colorTint="red"
        />
        <ReportKpiCard
          label="Low Stock Items (1-5)"
          value={summary.lowStockCount}
          icon={TrendingDown}
          colorTint="amber"
        />
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search Product Name, SKU, Code..."
        secondarySelect={{
          placeholder: "All Brands",
          options: brands.map((b) => ({ label: b.name, value: b.id })),
          value: selectedBrand,
          onChange: setSelectedBrand,
        }}
        thirdSelect={{
          placeholder: "All Categories",
          options: categories.map((c) => ({ label: c.name, value: c.id })),
          value: selectedCategory,
          onChange: setSelectedCategory,
        }}
        statusOptions={[
          { label: "Original Quality", value: "Original" },
          { label: "High Quality (HQ)", value: "High Quality" },
          { label: "Standard / Copy", value: "Copy" },
        ]}
        selectedStatus={selectedQuality}
        onStatusChange={setSelectedQuality}
        onReset={handleReset}
        onExport={handleExport}
        exportLabel="Export Excel"
      >
        <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none px-2">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="rounded border-input text-blue-600 focus:ring-blue-500 h-4 w-4"
          />
          <span>In Stock Only</span>
        </label>
      </ReportFilterBar>

      {/* Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="p-4 font-semibold tracking-wider">Product</th>
                <th className="p-4 font-semibold tracking-wider">Brand & Category</th>
                <th className="p-4 font-semibold tracking-wider">Variant Details</th>
                <th className="p-4 font-semibold tracking-wider">SKU</th>
                <th className="p-4 font-semibold tracking-wider text-center">Available Stock</th>
                <th className="p-4 font-semibold tracking-wider text-right">Buying Price</th>
                <th className="p-4 font-semibold tracking-wider text-right">Selling Price</th>
                <th className="p-4 font-semibold tracking-wider text-right">Stock Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading product inventory stock...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No product stock records found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => {
                  const stockValue = Math.max(0, row.stock) * row.buyingPrice;

                  return (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      {/* Product Name & Code */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg border border-border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                            {row.image ? (
                              <img
                                src={row.image}
                                alt={row.productName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <p className="font-semibold text-xs text-foreground leading-tight">
                              {row.productName}
                            </p>
                            <p className="text-[11px] font-mono text-muted-foreground">
                              Code: {row.productCode}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Brand & Category */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-foreground">{row.brand}</p>
                          <p className="text-[11px] text-muted-foreground">{row.category}</p>
                        </div>
                      </td>

                      {/* Variant */}
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.color && (
                            <Badge variant="outline" className="text-[10px] bg-muted/20">
                              {row.color}
                            </Badge>
                          )}
                          {row.quality && (
                            <Badge variant="outline" className="text-[10px] bg-muted/20">
                              {row.quality}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="p-4 font-mono text-xs font-medium text-muted-foreground">
                        {row.sku}
                      </td>

                      {/* Available Stock */}
                      <td className="p-4 text-center">
                        {getStockBadge(row.stock)}
                      </td>

                      {/* Buying Price */}
                      <td className="p-4 text-right font-mono text-muted-foreground text-xs whitespace-nowrap">
                        ৳{Number(row.buyingPrice).toLocaleString()}
                      </td>

                      {/* Selling Price */}
                      <td className="p-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        ৳{Number(row.sellingPrice).toLocaleString()}
                      </td>

                      {/* Stock Valuation */}
                      <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ৳{Number(stockValue).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer Summary Row */}
            {!isLoading && data.length > 0 && (
              <tfoot className="bg-muted/40 border-t border-border font-semibold text-xs text-foreground">
                <tr>
                  <td colSpan={4} className="p-4 text-muted-foreground">
                    Total Inventory Summary ({data.length} Variants):
                  </td>
                  <td className="p-4 text-center font-mono font-bold text-foreground">
                    {summary.totalStockQty} Units
                  </td>
                  <td colSpan={2} className="p-4 text-right text-muted-foreground">
                    Total FIFO Valuation:
                  </td>
                  <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    ৳{Number(summary.totalStockValueFIFO).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            {data.length === 0
              ? "Showing 0 items"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, data.length)} of ${data.length.toLocaleString()} items`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium text-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
