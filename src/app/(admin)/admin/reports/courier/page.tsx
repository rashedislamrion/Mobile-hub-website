"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Truck,
  DollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { ReportKpiCard } from "@/components/admin/ReportKpiCard";
import { ReportFilterBar } from "@/components/admin/ReportFilterBar";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-utils";

interface CourierRecord {
  sl: number;
  id: string;
  orderCode: string;
  orderDate: string;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  courierPartner: string;
  trackingNumber: string;
  totalAmount: number;
  deliveryCharge: number;
  paymentStatus: string;
  orderStatus: string;
}

export default function CourierReportPage() {
  const { setTitle, setBadge } = useAdminPage();

  const [data, setData] = useState<CourierRecord[]>([]);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalAmount: 0,
    totalDeliveryCharges: 0,
    totalPaid: 0,
    totalUnpaid: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setTitle("Courier Details Report");
    setBadge("Reports");
  }, [setTitle, setBadge]);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedStatus !== "all") params.status = selectedStatus;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        summary: typeof summary;
        data: CourierRecord[];
      }>("/reports/courier", params);

      setData(res?.data || []);
      if (res?.summary) setSummary(res.summary);
    } catch (err: any) {
      toast.error(err.message || "Failed to load courier details report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedStatus("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [
      "SL",
      "Order Code",
      "Order Date",
      "Customer Name",
      "Phone",
      "Delivery Address",
      "Courier Partner",
      "Tracking Number",
      "Parcel Value (BDT)",
      "Delivery Charge (BDT)",
      "Payment Status",
      "Order Status",
    ];

    const rows = data.map((row, idx) => [
      idx + 1,
      row.orderCode,
      new Date(row.createdAt).toLocaleString("en-GB"),
      row.customer.name,
      row.customer.phone,
      row.customer.address,
      row.courierPartner,
      row.trackingNumber,
      row.totalAmount,
      row.deliveryCharge,
      row.paymentStatus,
      row.orderStatus,
    ]);

    exportToCsv("courier-details-report", headers, rows);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
      case "COMPLETED":
        return <Badge className="bg-emerald-500 text-white text-[11px]">{status}</Badge>;
      case "PARCEL_BOOKED":
      case "CONFIRMED":
        return <Badge className="bg-blue-500 text-white text-[11px]">{status}</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-500 text-white text-[11px]">{status}</Badge>;
      case "RETURNED":
      case "CANCELLED":
        return <Badge className="bg-red-500 text-white text-[11px]">{status}</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
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
            <Truck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            Courier Details Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Third-party delivery shipments, tracking numbers, shipping fee revenues, and delivery statuses
          </p>
        </div>
      </div>

      {/* Top 5 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <ReportKpiCard
          label="Total Shipments"
          value={summary.totalOrders}
          icon={Truck}
          colorTint="blue"
        />
        <ReportKpiCard
          label="Parcel Value"
          value={`৳${Number(summary.totalAmount).toLocaleString()}`}
          icon={DollarSign}
          colorTint="emerald"
        />
        <ReportKpiCard
          label="Delivery Charges"
          value={`৳${Number(summary.totalDeliveryCharges).toLocaleString()}`}
          icon={Package}
          colorTint="purple"
        />
        <ReportKpiCard
          label="Collected / Paid"
          value={`৳${Number(summary.totalPaid).toLocaleString()}`}
          icon={CheckCircle2}
          colorTint="green"
        />
        <ReportKpiCard
          label="Outstanding / Due"
          value={`৳${Number(summary.totalUnpaid).toLocaleString()}`}
          icon={AlertCircle}
          colorTint="red"
        />
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search Order Code, Tracking No, Customer, Phone..."
        statusOptions={[
          { label: "Delivered / Completed", value: "DELIVERED" },
          { label: "Parcel Booked", value: "PARCEL_BOOKED" },
          { label: "Confirmed", value: "CONFIRMED" },
          { label: "Pending", value: "PENDING" },
          { label: "Returned", value: "RETURNED" },
          { label: "Cancelled", value: "CANCELLED" },
        ]}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onReset={handleReset}
        onExport={handleExport}
        exportLabel="Export Excel"
      />

      {/* Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="p-4 font-semibold tracking-wider text-center">SL</th>
                <th className="p-4 font-semibold tracking-wider">Order ID</th>
                <th className="p-4 font-semibold tracking-wider">Date & Time</th>
                <th className="p-4 font-semibold tracking-wider">Customer & Delivery Address</th>
                <th className="p-4 font-semibold tracking-wider">Courier Partner & Tracking</th>
                <th className="p-4 font-semibold tracking-wider text-right">Parcel Value</th>
                <th className="p-4 font-semibold tracking-wider text-right">Delivery Charge</th>
                <th className="p-4 font-semibold tracking-wider text-center">Payment</th>
                <th className="p-4 font-semibold tracking-wider text-center">Order Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading courier shipment reports...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No courier delivery records found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const formattedDate = new Date(row.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      {/* SL */}
                      <td className="p-4 text-center font-mono text-xs text-muted-foreground">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Order Code */}
                      <td className="p-4">
                        <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs">
                          {row.orderCode}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="p-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Customer & Address */}
                      <td className="p-4 max-w-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs text-foreground">{row.customer.name}</p>
                          <p className="text-[11px] font-mono text-muted-foreground">{row.customer.phone}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate" title={row.customer.address}>
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{row.customer.address}</span>
                          </p>
                        </div>
                      </td>

                      {/* Courier Partner & Tracking */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-medium text-xs text-foreground">{row.courierPartner}</p>
                          <span className="font-mono text-[11px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-sm">
                            {row.trackingNumber}
                          </span>
                        </div>
                      </td>

                      {/* Parcel Value */}
                      <td className="p-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        ৳{Number(row.totalAmount).toLocaleString()}
                      </td>

                      {/* Delivery Charge */}
                      <td className="p-4 text-right font-mono text-purple-600 dark:text-purple-400 font-semibold whitespace-nowrap">
                        ৳{Number(row.deliveryCharge).toLocaleString()}
                      </td>

                      {/* Payment Status */}
                      <td className="p-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase ${
                            row.paymentStatus === "PAID"
                              ? "border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                              : "border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                          }`}
                        >
                          {row.paymentStatus}
                        </Badge>
                      </td>

                      {/* Order Status */}
                      <td className="p-4 text-center">
                        {getStatusBadge(row.orderStatus)}
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
                  <td colSpan={5} className="p-4 text-muted-foreground">
                    Courier Shipments Total ({data.length} Parcels):
                  </td>
                  <td className="p-4 text-right font-mono text-foreground font-bold">
                    ৳{Number(summary.totalAmount).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-purple-600 dark:text-purple-400 font-bold">
                    ৳{Number(summary.totalDeliveryCharges).toLocaleString()}
                  </td>
                  <td colSpan={2} className="p-4 text-center text-muted-foreground">
                    Delivered & Tracked
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
              ? "Showing 0 shipments"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, data.length)} of ${data.length.toLocaleString()} shipments`}
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
