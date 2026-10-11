"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { apiGet, getImageUrl } from "@/lib/api-client";
import {
  Wallet,
  Package,
  Wrench,
  Banknote,
  Receipt,
  ShoppingBag,
  HandCoins,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  PackageCheck,
  Truck,
  Undo2,
  XCircle,
  Activity,
  CheckCircle,
  Eye,
  Store,
  Headphones,
  Layers
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import Image from "next/image";
import Link from "next/link";
import { ColoredStatCard } from "@/components/admin/ColoredStatCard";

interface DashboardData {
  kpi: {
    // 8 Core Fix Pass 24 Cards
    totalSales: number;
    totalPhoneSales: number;
    totalDisplaySales: number;
    totalGadgetSales: number;
    totalServices: number;
    totalProfit: number;
    totalPurchase: number;
    totalSupplierDue: number;

    // Operational & Preserved Cards
    totalRevenue: number;
    netProductSales: number;
    netServiceRevenue: number;
    liquidSales: number;
    totalExpensePayroll: number;
    totalSupplierPayment: number;
    totalDueSales?: number;
    totalExpense?: number;
    payrollSalary?: number;
  };
  orderStatuses: {
    pending: number;
    confirmed: number;
    parcelBooked: number;
    delivered: number;
    returned: number;
    cancelled: number;
    diagnosing: number;
    completed: number;
  };
  chartData: Array<{ name: string; income: number; expense: number; order: number }>;
  topProducts: Array<{ id: string; name: string; category: string; price: number; unitsSold: number; image: string | null }>;
  recentOrders: Array<{ id: string; orderCode: string; customerName: string; branchName: string; totalAmount: number; status: string; createdAt: string }>;
  topCustomers: Array<{ id: string; name: string; phone: string; ordersCount: number; totalSpend: number }>;
}

const getIconForKpi = (id: string) => {
  switch (id) {
    case "tsales": return <Wallet className="w-5 h-5 text-emerald-600" />;
    case "psales": return <Package className="w-5 h-5 text-blue-600" />;
    case "dsales": return <Layers className="w-5 h-5 text-indigo-600" />;
    case "gsales": return <Headphones className="w-5 h-5 text-amber-600" />;
    case "serv": return <Wrench className="w-5 h-5 text-teal-600" />;
    case "profit": return <TrendingUp className="w-5 h-5 text-emerald-600" />;
    case "pur": return <ShoppingBag className="w-5 h-5 text-cyan-600" />;
    case "sdue": return <AlertCircle className="w-5 h-5 text-rose-600" />;
    case "rev": return <Wallet className="w-5 h-5 text-emerald-600" />;
    case "prod": return <Package className="w-5 h-5 text-blue-600" />;
    case "liq": return <Banknote className="w-5 h-5 text-purple-600" />;
    case "exp": return <Receipt className="w-5 h-5 text-amber-600" />;
    case "spay": return <HandCoins className="w-5 h-5 text-teal-600" />;
    default: return <Wallet className="w-5 h-5" />;
  }
};

const getBgForKpi = (id: string) => {
  switch (id) {
    case "tsales": return "bg-emerald-100";
    case "psales": return "bg-blue-100";
    case "dsales": return "bg-indigo-100";
    case "gsales": return "bg-amber-100";
    case "serv": return "bg-teal-100";
    case "profit": return "bg-emerald-100";
    case "pur": return "bg-cyan-100";
    case "sdue": return "bg-rose-100";
    case "rev": return "bg-emerald-100";
    case "prod": return "bg-blue-100";
    case "liq": return "bg-purple-100";
    case "exp": return "bg-amber-100";
    case "spay": return "bg-teal-100";
    default: return "bg-gray-100";
  }
};

export default function AdminDashboardPage() {
  const { setTitle, setBadge, dateFilter, selectedBranchId, selectedBranchName } = useAdminPage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setTitle("Dashboard");
    setBadge("Website");
  }, [setTitle, setBadge]);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedBranchId) params.branch = selectedBranchId;
      if (dateFilter) params.period = dateFilter;

      const res = await apiGet<DashboardData>("/reports/dashboard", params);
      if (res && res.kpi) {
        setData(res);
      }
    } catch {
      // Fallback gracefully
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, dateFilter]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const kpi = data?.kpi || {
    totalSales: 0,
    totalPhoneSales: 0,
    totalDisplaySales: 0,
    totalGadgetSales: 0,
    totalServices: 0,
    totalProfit: 0,
    totalPurchase: 0,
    totalSupplierDue: 0,
    totalRevenue: 0,
    netProductSales: 0,
    netServiceRevenue: 0,
    liquidSales: 0,
    totalExpensePayroll: 0,
    totalSupplierPayment: 0,
    totalDueSales: 0,
    totalExpense: 0,
    payrollSalary: 0,
  };

  const orderStatuses = [
    { label: "Pending", count: data?.orderStatuses?.pending ?? 0, bg: "bg-amber-50", icon: <Clock className="w-5 h-5 text-amber-500" /> },
    { label: "Confirmed", count: data?.orderStatuses?.confirmed ?? 0, bg: "bg-blue-50", icon: <CheckCircle2 className="w-5 h-5 text-blue-500" /> },
    { label: "Parcel Booked", count: data?.orderStatuses?.parcelBooked ?? 0, bg: "bg-indigo-50", icon: <PackageCheck className="w-5 h-5 text-indigo-500" /> },
    { label: "Delivered", count: data?.orderStatuses?.delivered ?? 0, bg: "bg-emerald-50", icon: <Truck className="w-5 h-5 text-emerald-500" /> },
    { label: "Returned", count: data?.orderStatuses?.returned ?? 0, bg: "bg-orange-50", icon: <Undo2 className="w-5 h-5 text-orange-500" /> },
    { label: "Cancelled", count: data?.orderStatuses?.cancelled ?? 0, bg: "bg-red-50", icon: <XCircle className="w-5 h-5 text-red-500" /> },
    { label: "Diagnosing", count: data?.orderStatuses?.diagnosing ?? 0, bg: "bg-purple-50", icon: <Activity className="w-5 h-5 text-purple-500" /> },
    { label: "Completed", count: data?.orderStatuses?.completed ?? 0, bg: "bg-teal-50", icon: <CheckCircle className="w-5 h-5 text-teal-500" /> },
  ];

  const chartData = (data?.chartData && data.chartData.length > 0)
    ? data.chartData
    : [
        { name: "Mon", income: 0, expense: 0, order: 0 },
        { name: "Tue", income: 0, expense: 0, order: 0 },
        { name: "Wed", income: 0, expense: 0, order: 0 },
        { name: "Thu", income: 0, expense: 0, order: 0 },
        { name: "Fri", income: 0, expense: 0, order: 0 },
        { name: "Sat", income: 0, expense: 0, order: 0 },
        { name: "Sun", income: 0, expense: 0, order: 0 },
      ];

  const topProducts = data?.topProducts || [];
  const recentOrders = data?.recentOrders || [];
  const topCustomers = data?.topCustomers || [];

  return (
    <div className="space-y-6">
      
      {/* Active Branch Scope Indicator */}
      {selectedBranchId && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-sm font-medium">
          <Store className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Showing data filtered for: <strong>{selectedBranchName}</strong></span>
        </div>
      )}

      {/* CORE BUSINESS PERFORMANCE (FIX PASS 24) */}
      <div className="space-y-4">
        {/* ROW 1: REVENUE BREAKDOWN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl border-none shadow-sm bg-gradient-to-br from-emerald-50/50 to-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getBgForKpi("tsales")}`}>
                  {getIconForKpi("tsales")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Total Sales</p>
                  <h3 className="text-2xl font-extrabold text-slate-800">৳ {kpi.totalSales.toLocaleString()}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-semibold text-emerald-600">Headline</span>
                <span>• Phone + Display + Gadget + Services</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getBgForKpi("psales")}`}>
                  {getIconForKpi("psales")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Total Phone Sales</p>
                  <h3 className="text-2xl font-bold text-slate-800">৳ {kpi.totalPhoneSales.toLocaleString()}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-semibold text-blue-600">Smartphones</span>
                <span>• IMEI & Phone units sold</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getBgForKpi("dsales")}`}>
                  {getIconForKpi("dsales")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Total Display Sales</p>
                  <h3 className="text-2xl font-bold text-slate-800">৳ {kpi.totalDisplaySales.toLocaleString()}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-semibold text-indigo-600">Spare Parts</span>
                <span>• Displays, OLEDs & parts</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getBgForKpi("gsales")}`}>
                  {getIconForKpi("gsales")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Total Gadget Sales</p>
                  <h3 className="text-2xl font-bold text-slate-800">৳ {kpi.totalGadgetSales.toLocaleString()}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-semibold text-amber-600">Accessories</span>
                <span>• Audio, gadgets & wearables</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ROW 2: SERVICES, PROFIT, PURCHASES & SUPPLIER DUES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getBgForKpi("serv")}`}>
                  {getIconForKpi("serv")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Total Services</p>
                  <h3 className="text-2xl font-bold text-slate-800">৳ {kpi.totalServices.toLocaleString()}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-semibold text-teal-600">Servicing</span>
                <span>• Realized repair jobs</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getBgForKpi("profit")}`}>
                  {getIconForKpi("profit")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Total Profit</p>
                  <h3 className="text-2xl font-bold text-emerald-700">৳ {kpi.totalProfit.toLocaleString()}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-semibold text-emerald-600">Live Margin</span>
                <span>• Sales − COGS − Service materials</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getBgForKpi("pur")}`}>
                  {getIconForKpi("pur")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Total Purchase</p>
                  <h3 className="text-2xl font-bold text-slate-800">৳ {kpi.totalPurchase.toLocaleString()}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-semibold text-cyan-600">Procurement</span>
                <span>• Inward inventory intake</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getBgForKpi("sdue")}`}>
                  {getIconForKpi("sdue")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Total Supplier Due</p>
                  <h3 className="text-2xl font-bold text-slate-800">৳ {kpi.totalSupplierDue.toLocaleString()}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-semibold text-rose-600">Payables</span>
                <span>• Outstanding balance as of now</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ORDER STATUS OVERVIEW */}
      <Card className="rounded-xl border-none shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-white p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-800">Order Status Overview</CardTitle>
          <span className="text-xs text-slate-500">{selectedBranchName}</span>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {orderStatuses.map((status) => (
            <div key={status.label} className="flex flex-col items-center justify-center text-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${status.bg}`}>
                {status.icon}
              </div>
              <p className="text-xl font-bold text-slate-800 leading-tight">{status.count}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">{status.label}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* OPERATIONAL CASH FLOW & FINANCIAL AUDIT CARDS (PRESERVED FROM PRIOR PASSES) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Operational & Cash Flow Audit Metrics</h4>
          <span className="text-xs text-slate-400">Preserved for reconciliation</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ColoredStatCard
            icon={<Wallet className="w-5 h-5" />}
            label="Total Revenue"
            value={`৳ ${kpi.totalRevenue.toLocaleString()}`}
            colorTint="green"
          />
          <ColoredStatCard
            icon={<Banknote className="w-5 h-5" />}
            label="Liquid Sales (Cash In)"
            value={`৳ ${kpi.liquidSales.toLocaleString()}`}
            colorTint="purple"
          />
          <ColoredStatCard
            icon={<Package className="w-5 h-5" />}
            label="Net Product Sales"
            value={`৳ ${kpi.netProductSales.toLocaleString()}`}
            colorTint="blue"
          />
          <ColoredStatCard
            icon={<Wrench className="w-5 h-5" />}
            label="Net Service Revenue"
            value={`৳ ${kpi.netServiceRevenue.toLocaleString()}`}
            colorTint="teal"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ColoredStatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Total Due Sales"
            value={`৳ ${(kpi.totalDueSales ?? 0).toLocaleString()}`}
            colorTint="orange"
          />
          <ColoredStatCard
            icon={<HandCoins className="w-5 h-5" />}
            label="Total Supplier Payment"
            value={`৳ ${(kpi.totalSupplierPayment ?? 0).toLocaleString()}`}
            colorTint="teal"
          />
          <ColoredStatCard
            icon={<Receipt className="w-5 h-5" />}
            label="Total Expense + Payroll"
            value={`৳ ${(kpi.totalExpensePayroll ?? 0).toLocaleString()}`}
            colorTint="red"
          />
          <ColoredStatCard
            icon={<Banknote className="w-5 h-5" />}
            label="Payroll + Salary"
            value={`৳ ${(kpi.payrollSalary ?? 0).toLocaleString()}`}
            colorTint="purple"
            subtitle={dateFilter ? `Period: ${dateFilter}` : "Gross Liability"}
          />
        </div>
      </div>

      {/* SUMMARY CHART */}
      <Card className="rounded-xl border-none shadow-sm">
        <CardHeader className="border-b bg-white p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-800">Summary (Last 7 Days)</CardTitle>
          <span className="text-xs text-slate-500">{selectedBranchName}</span>
        </CardHeader>
        <CardContent className="p-4 h-[350px]">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOrder" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `৳${value >= 1000 ? `${value / 1000}k` : value}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: unknown) => [`৳ ${Number(value).toLocaleString()}`, undefined]}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }} />
                <Area type="monotone" dataKey="order" name="Order Count" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOrder)" />
                <Area type="monotone" dataKey="income" name="Income (৳)" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" name="Expense (৳)" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
              Loading summary chart...
            </div>
          )}
        </CardContent>
      </Card>

      {/* TWO COLUMNS: TOP PRODUCTS & TOP CUSTOMERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Selling Products */}
        <Card className="rounded-xl border-none shadow-sm">
          <CardHeader className="border-b bg-white p-4 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-800">Most Selling Products</CardTitle>
            <Link href="/admin/products" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View All</Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {topProducts.length > 0 ? (
                topProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className="relative w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                      {product.image ? (
                        <Image src={getImageUrl(product.image)} alt={product.name} fill className="object-cover" />
                      ) : (
                        <Package className="w-6 h-6 m-3 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{product.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{product.category} • ৳{Number(product.price).toLocaleString()}</p>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none shrink-0">
                      {product.unitsSold} Sold
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 p-6 text-center">No sales recorded for this branch yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Top Customers */}
        <Card className="rounded-xl border-none shadow-sm">
          <CardHeader className="border-b bg-white p-4 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-800">Weekly Top Customers</CardTitle>
            <Link href="/admin/reports/customer-due" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View All</Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {topCustomers.length > 0 ? (
                topCustomers.map((customer) => (
                  <div key={customer.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold bg-emerald-100 text-emerald-700">
                      {customer.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{customer.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{customer.ordersCount} Orders • ৳{Number(customer.totalSpend).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600">
                      ৳{Number(customer.totalSpend).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 p-6 text-center">No customer data for this branch yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RECENT ORDERS TABLE */}
      <Card className="rounded-xl border-none shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-white p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-800">Recent Orders</CardTitle>
          <Link href="/admin/orders" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View All</Link>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[120px] whitespace-nowrap text-slate-500 font-medium">Order Code</TableHead>
                <TableHead className="whitespace-nowrap text-slate-500 font-medium">Customer</TableHead>
                <TableHead className="whitespace-nowrap text-slate-500 font-medium">Branch</TableHead>
                <TableHead className="whitespace-nowrap text-slate-500 font-medium">Total Amount</TableHead>
                <TableHead className="whitespace-nowrap text-slate-500 font-medium">Date</TableHead>
                <TableHead className="whitespace-nowrap text-slate-500 font-medium">Status</TableHead>
                <TableHead className="text-right whitespace-nowrap text-slate-500 font-medium">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-semibold text-slate-800">{order.orderCode}</TableCell>
                    <TableCell className="text-slate-600">{order.customerName}</TableCell>
                    <TableCell className="text-slate-600">{order.branchName}</TableCell>
                    <TableCell className="font-bold text-slate-900">৳ {Number(order.totalAmount).toLocaleString()}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{new Date(order.createdAt).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`
                          border-none font-semibold px-2 py-0.5
                          ${order.status === 'DELIVERED' || order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : ''}
                          ${order.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : ''}
                          ${order.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-600' : ''}
                          ${order.status === 'PARCEL_BOOKED' ? 'bg-indigo-50 text-indigo-600' : ''}
                          ${order.status === 'RETURNED' ? 'bg-orange-50 text-orange-600' : ''}
                          ${order.status === 'CANCELLED' ? 'bg-red-50 text-red-600' : ''}
                        `}
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/orders/${order.id}`} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-flex">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-slate-400">
                    No orders found for this branch
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
    </div>
  );
}
