"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  User, 
  Phone, 
  Hash, 
  Wrench, 
  Smartphone, 
  Tag, 
  Layers, 
  Package, 
  ShieldCheck, 
  Receipt, 
  CreditCard, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Sparkles,
  ArrowRight,
  Store
} from "lucide-react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { useStaffAuth } from "@/context/AuthContext";
import { apiGet, apiPost } from "@/lib/api-client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PartTypeaheadInput } from "@/components/admin/PartTypeaheadInput";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface LookupItem {
  id: string;
  name: string;
  status?: string;
  days?: number;
  suggestedLaborPrice?: number | string;
}

interface BrandItem {
  id: string;
  name: string;
}

interface SupplierItem {
  id: string;
  name: string;
  companyName?: string;
  phone?: string;
}

interface ProductCatalogItem {
  id: string;
  name: string;
  code?: string;
  purchasePrice?: number | string;
  sellingPrice?: number | string;
}

interface CustomerMatch {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

interface TechnicianItem {
  id: string;
  name: string;
  phone?: string;
  employeeId?: string;
  isTechnician?: boolean;
}

interface MaterialRow {
  id: string;
  partName: string;
  productId?: string;
  sourceType: "OWN_STOCK" | "SUPPLIER" | "OTHER";
  supplierId: string;
  sourcedFromName?: string;
  sourceNote?: string;
  cost: number;
  quantity: number;
  total: number;
}

interface PaymentRow {
  method: string;
  amount: number;
}

const AVAILABLE_PAYMENT_METHODS = [
  { id: "CASH", label: "Cash" },
  { id: "BKASH", label: "bKash" },
  { id: "CARD", label: "Card" },
  { id: "BANK_TRANSFER", label: "Bank Transfer" },
  { id: "SSLCOMMERZ", label: "SSLCommerz" },
];

export default function CreateServicingJobPage() {
  const router = useRouter();
  const { setTitle, setBadge, selectedBranchId } = useAdminPage();
  const { user } = useStaffAuth();

  // Lookups & Options State
  const [deviceTypes, setDeviceTypes] = useState<LookupItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [problemTypes, setProblemTypes] = useState<LookupItem[]>([]);
  const [warrantyPeriods, setWarrantyPeriods] = useState<LookupItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogItem[]>([]);

  // Section 1: Customer Information
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [referralNumber, setReferralNumber] = useState("");
  const [matchedCustomer, setMatchedCustomer] = useState<CustomerMatch | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // Section 2: Employee & Invoice
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);

  // Section 3: Device Information
  const [selectedDeviceTypeId, setSelectedDeviceTypeId] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [deviceModel, setDeviceModel] = useState("");

  // Section 4: Problem Details
  const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);
  const [problemSearchQuery, setProblemSearchQuery] = useState("");

  // Section 5: Material History
  const [materials, setMaterials] = useState<MaterialRow[]>([
    {
      id: "mat-1",
      partName: "",
      productId: "",
      sourceType: "OWN_STOCK",
      supplierId: "",
      sourcedFromName: "",
      sourceNote: "",
      cost: 0,
      quantity: 1,
      total: 0,
    },
  ]);

  // Section 6: Warranty
  const [selectedWarrantyPeriod, setSelectedWarrantyPeriod] = useState("No Warranty");
  const [warrantyStartDate, setWarrantyStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [warrantyEndDate, setWarrantyEndDate] = useState("");

  // Section 7: Pricing
  const [laborPrice, setLaborPrice] = useState<number>(0);

  // Section 8: Billing & Payment
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>(["CASH"]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({ CASH: 0 });

  // Section 9: Service Summary
  const [discount, setDiscount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set Page Title
  useEffect(() => {
    setTitle("Create New Service Job");
    setBadge("Repair Intake");
  }, [setTitle, setBadge]);

  // Master lookup error and retry state
  const [lookupErrors, setLookupErrors] = useState<string[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);

  const loadServiceData = useCallback(async () => {
    try {
      setIsLoadingLookups(true);
      setLookupErrors([]);
      const errs: string[] = [];

      const results = await Promise.allSettled([
        apiGet<LookupItem[]>("/service-lookups/device-types"),
        apiGet<LookupItem[]>("/service-lookups/problem-types"),
        apiGet<LookupItem[]>("/service-lookups/warranty-periods"),
        apiGet<BrandItem[]>("/brands"),
        apiGet<any>("/suppliers"),
        apiGet<any>("/employees/technicians"),
        apiGet<any>("/products?limit=100"),
      ]);

      const [dtRes, ptRes, wpRes, brRes, supRes, techRes, prodRes] = results;

      if (dtRes.status === "fulfilled" && Array.isArray(dtRes.value)) {
        setDeviceTypes(dtRes.value);
      } else {
        errs.push("Device Types");
      }

      if (ptRes.status === "fulfilled" && Array.isArray(ptRes.value)) {
        setProblemTypes(ptRes.value);
      } else {
        errs.push("Problem Types");
      }

      if (wpRes.status === "fulfilled" && Array.isArray(wpRes.value)) {
        setWarrantyPeriods(wpRes.value);
      } else {
        errs.push("Warranty Periods");
      }

      if (brRes.status === "fulfilled" && Array.isArray(brRes.value)) {
        setBrands(brRes.value);
      } else {
        errs.push("Brands");
      }

      if (supRes.status === "fulfilled") {
        const list = Array.isArray(supRes.value) ? supRes.value : supRes.value?.data || [];
        setSuppliers(list);
      } else {
        errs.push("Suppliers");
      }

      if (techRes.status === "fulfilled") {
        const list = Array.isArray(techRes.value) ? techRes.value : techRes.value?.data || [];
        setTechnicians(list);
        if (user && list.some((t: any) => t.id === user.id)) {
          setSelectedTechnicianId(user.id);
        } else if (list.length > 0 && !selectedTechnicianId) {
          setSelectedTechnicianId(list[0].id);
        }
      } else {
        errs.push("Technicians");
      }

      if (prodRes.status === "fulfilled") {
        const list = Array.isArray(prodRes.value) ? prodRes.value : prodRes.value?.data || [];
        setCatalogProducts(list);
      } else {
        errs.push("Spare Parts/Products");
      }

      if (errs.length > 0) {
        setLookupErrors(errs);
        toast.error(`Failed to load ${errs.join(", ")}. Please click Retry.`);
      }

      fetchNextInvoice();
    } finally {
      setIsLoadingLookups(false);
    }
  }, [user, selectedTechnicianId]);

  useEffect(() => {
    loadServiceData();
  }, []);

  const fetchNextInvoice = async () => {
    try {
      setIsLoadingInvoice(true);
      const res = await apiGet<{ invoiceNo: string }>("/service-jobs/next-invoice-number");
      if (res?.invoiceNo) {
        setInvoiceNo(res.invoiceNo);
      }
    } catch {
      // Fallback if network blip
      if (!invoiceNo) setInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  // Inline Customer Search with debounce on phone
  useEffect(() => {
    const cleanPhone = customerPhone.trim();
    if (cleanPhone.length >= 10) {
      setIsSearchingCustomer(true);
      const timer = setTimeout(async () => {
        try {
          const res = await apiGet<CustomerMatch[]>("/orders/customers/search", { q: cleanPhone });
          if (Array.isArray(res) && res.length > 0) {
            const exactOrFirst = res.find((c) => c.phone.includes(cleanPhone)) || res[0];
            setMatchedCustomer(exactOrFirst);
            if (!customerName) {
              setCustomerName(exactOrFirst.name);
            }
          } else {
            setMatchedCustomer(null);
          }
        } catch {
          setMatchedCustomer(null);
        } finally {
          setIsSearchingCustomer(false);
        }
      }, 400);

      return () => clearTimeout(timer);
    } else {
      setMatchedCustomer(null);
    }
  }, [customerPhone]);

  // Warranty Period auto-calculate end date
  const handleWarrantyChange = (periodName: string) => {
    setSelectedWarrantyPeriod(periodName);
    const found = warrantyPeriods.find((w) => w.name === periodName);
    if (!found || found.days === 0 || periodName === "No Warranty") {
      setWarrantyEndDate("");
      return;
    }
    const start = new Date(warrantyStartDate || new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + (found.days || 30));
    setWarrantyEndDate(end.toISOString().split("T")[0]);
  };

  // Problems toggle and labor charge auto-suggestion
  const handleToggleProblem = (prob: LookupItem) => {
    setSelectedProblemIds((prev) => {
      const exists = prev.includes(prob.id);
      let updated: string[];
      if (exists) {
        updated = prev.filter((id) => id !== prob.id);
      } else {
        updated = [...prev, prob.id];
      }

      // Compute suggested labor price
      const totalSuggestedLabor = updated.reduce((sum, id) => {
        const p = problemTypes.find((item) => item.id === id);
        return sum + (Number(p?.suggestedLaborPrice) || 0);
      }, 0);

      if (totalSuggestedLabor > 0) {
        setLaborPrice(totalSuggestedLabor);
      }
      return updated;
    });
  };

  // Material History row operations
  const handleAddMaterialRow = () => {
    setMaterials((prev) => [
      ...prev,
      {
        id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        partName: "",
        productId: "",
        sourceType: "OWN_STOCK",
        supplierId: "",
        sourcedFromName: "",
        sourceNote: "",
        cost: 0,
        quantity: 1,
        total: 0,
      },
    ]);
  };

  const handleRemoveMaterialRow = (rowId: string) => {
    setMaterials((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== rowId) : prev));
  };

  const handleUpdateMaterialRow = (rowId: string, field: keyof MaterialRow, value: any) => {
    setMaterials((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, [field]: value };
        if (field === "productId" && value) {
          const prod = catalogProducts.find((p) => p.id === value);
          if (prod) {
            updated.partName = prod.name;
            const unitCost = Number(prod.purchasePrice) || Number(prod.sellingPrice) || 0;
            updated.cost = unitCost;
          }
        }
        if (field === "sourceType") {
          if (value === "SUPPLIER") {
            if (!updated.supplierId && suppliers.length > 0) {
              updated.supplierId = suppliers[0].id;
            }
            updated.sourcedFromName = "";
            updated.sourceNote = "";
          }
          if (value === "OWN_STOCK") {
            updated.supplierId = "";
            updated.sourcedFromName = "";
            updated.sourceNote = "";
          }
          if (value === "OTHER") {
            updated.supplierId = "";
          }
        }
        if (field === "cost" || field === "quantity" || field === "productId") {
          updated.total = Number(updated.cost || 0) * Number(updated.quantity || 1);
        }
        return updated;
      })
    );
  };

  // Calculations
  const totalMaterialCost = useMemo(() => {
    return materials.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
  }, [materials]);

  const totalBill = useMemo(() => {
    return Number(laborPrice || 0) + Number(totalMaterialCost || 0);
  }, [laborPrice, totalMaterialCost]);

  const finalAmount = useMemo(() => {
    const net = totalBill - Number(discount || 0);
    return Math.max(0, net);
  }, [totalBill, discount]);

  // Payment method toggling
  const handleTogglePaymentMethod = (methodId: string) => {
    setSelectedPaymentMethods((prev) => {
      const exists = prev.includes(methodId);
      if (exists) {
        if (prev.length === 1) {
          toast.warning("At least one payment method must remain selected.");
          return prev;
        }
        const filtered = prev.filter((m) => m !== methodId);
        setPaymentAmounts((amounts) => {
          const copy = { ...amounts };
          delete copy[methodId];
          return copy;
        });
        return filtered;
      } else {
        setPaymentAmounts((amounts) => ({
          ...amounts,
          [methodId]: 0,
        }));
        return [...prev, methodId];
      }
    });
  };

  const handlePaymentAmountChange = (methodId: string, value: number) => {
    setPaymentAmounts((prev) => ({
      ...prev,
      [methodId]: Number(value) || 0,
    }));
  };

  const totalPaidAmount = useMemo(() => {
    return selectedPaymentMethods.reduce((sum, method) => {
      return sum + (Number(paymentAmounts[method]) || 0);
    }, 0);
  }, [selectedPaymentMethods, paymentAmounts]);

  const dueAmount = useMemo(() => {
    return Math.max(0, finalAmount - totalPaidAmount);
  }, [finalAmount, totalPaidAmount]);

  const handleQuickFillFullPayment = () => {
    if (selectedPaymentMethods.length === 0) return;
    const primaryMethod = selectedPaymentMethods[0];
    const newAmounts: Record<string, number> = {};
    selectedPaymentMethods.forEach((m) => {
      newAmounts[m] = m === primaryMethod ? finalAmount : 0;
    });
    setPaymentAmounts(newAmounts);
  };

  // Filtered problems for search
  const filteredProblems = useMemo(() => {
    if (!problemSearchQuery.trim()) return problemTypes;
    return problemTypes.filter((p) =>
      p.name.toLowerCase().includes(problemSearchQuery.toLowerCase())
    );
  }, [problemTypes, problemSearchQuery]);

  // Selected device and brand labels
  const selectedDeviceTypeName = useMemo(() => {
    return deviceTypes.find((d) => d.id === selectedDeviceTypeId)?.name || "Device";
  }, [deviceTypes, selectedDeviceTypeId]);

  const selectedBrandName = useMemo(() => {
    return brands.find((b) => b.id === selectedBrandId)?.name || "";
  }, [brands, selectedBrandId]);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerPhone.trim()) {
      toast.error("Customer phone number is required.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    if (!selectedDeviceTypeId) {
      toast.error("Please select a device type.");
      return;
    }
    if (!selectedBrandId) {
      toast.error("Please select a brand.");
      return;
    }
    if (selectedProblemIds.length === 0) {
      toast.error("Please select at least one problem / issue.");
      return;
    }
    if (selectedPaymentMethods.length === 0) {
      toast.error("Please select at least one payment method.");
      return;
    }

    // Validate materials: each must have a part name, and conditional requirements based on sourceType
    for (let i = 0; i < materials.length; i++) {
      const mat = materials[i];
      if (mat.cost > 0 || mat.partName.trim()) {
        if (!mat.partName.trim()) {
          toast.error(`Part name is required for Material Row #${i + 1}.`);
          return;
        }
        if (mat.sourceType === "SUPPLIER" && !mat.supplierId) {
          toast.error(`Please select a registered supplier for Material Row #${i + 1} (${mat.partName}).`);
          return;
        }
        if (mat.sourceType === "OTHER" && !mat.sourcedFromName?.trim()) {
          toast.error(`Please provide the sourced vendor/person name for Material Row #${i + 1} (${mat.partName}).`);
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);

      const chosenProblems = problemTypes.filter((p) => selectedProblemIds.includes(p.id));
      const compositeDeviceString = `${selectedBrandName} ${deviceModel}`.trim() || selectedDeviceTypeName;
      const issuesString = chosenProblems.map((p) => p.name).join(", ");

      const paymentsPayload = selectedPaymentMethods
        .filter((m) => Number(paymentAmounts[m]) > 0)
        .map((m) => ({
          method: m,
          amount: Number(paymentAmounts[m]) || 0,
        }));

      const materialsPayload = materials
        .filter((m) => m.partName.trim().length > 0)
        .map((m) => ({
          partName: m.partName.trim(),
          productId: m.productId || undefined,
          sourceType: m.sourceType || "OWN_STOCK",
          supplierId: m.sourceType === "SUPPLIER" ? m.supplierId : undefined,
          sourcedFromName: m.sourceType === "OTHER" ? (m.sourcedFromName?.trim() || undefined) : undefined,
          sourceNote: m.sourceType === "OTHER" ? (m.sourceNote?.trim() || m.sourcedFromName?.trim() || undefined) : undefined,
          cost: Number(m.cost) || 0,
          quantity: Number(m.quantity) || 1,
          total: Number(m.total) || 0,
        }));

      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        referralNumber: referralNumber.trim() || undefined,
        customerId: matchedCustomer?.id || undefined,
        technicianId: selectedTechnicianId || undefined,
        invoiceNo: invoiceNo.trim() || undefined,
        deviceTypeId: selectedDeviceTypeId,
        deviceType: selectedDeviceTypeName,
        brandId: selectedBrandId,
        model: deviceModel.trim() || undefined,
        device: compositeDeviceString,
        issueDescription: issuesString || "Device repair diagnostic intake",
        problems: chosenProblems.map((p) => ({
          id: p.id,
          name: p.name,
          suggestedLaborPrice: Number(p.suggestedLaborPrice) || 0,
        })),
        warrantyPeriod: selectedWarrantyPeriod,
        warrantyStartDate: warrantyStartDate || undefined,
        warrantyEndDate: warrantyEndDate || undefined,
        laborCost: Number(laborPrice) || 0,
        materialCost: Number(totalMaterialCost) || 0,
        totalBill: Number(totalBill) || 0,
        discount: Number(discount) || 0,
        finalAmount: Number(finalAmount) || 0,
        paidAmount: Number(totalPaidAmount) || 0,
        dueAmount: Number(dueAmount) || 0,
        materials: materialsPayload,
        payments: paymentsPayload,
        status: "IN_PROGRESS",
      };

      const res = await apiPost<{ success: boolean; serviceJob: any }>("/service-jobs/repair", payload);
      toast.success(`Service Job ${res?.serviceJob?.invoiceNo || ""} created successfully!`);
      router.push("/admin/sales/service");
    } catch (err: any) {
      toast.error(err.message || "Failed to create service job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-800 rounded-xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
              Mobile Hub BD Servicing Workflow
            </span>
            <span className="text-xs text-emerald-200/80">IMEI-Free Repair Intake</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Repair Service</h1>
          <p className="text-emerald-100/90 text-sm mt-0.5">
            Full walk-in service intake, supplier-linked spare parts, and technician profit distribution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/sales/service")}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-6 shadow-md"
          >
            {isSubmitting ? "Creating Job..." : "Create Service (Submit)"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {lookupErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to load servicing lookup options</p>
              <p className="text-xs text-rose-600">
                Could not fetch: <span className="font-medium">{lookupErrors.join(", ")}</span>. Dropdowns or spare parts may be missing.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadServiceData}
            disabled={isLoadingLookups}
            className="border-rose-300 text-rose-700 bg-white hover:bg-rose-100 shrink-0 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingLookups ? "animate-spin" : ""}`} /> Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Intake Columns (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Customer Information */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Customer Information</CardTitle>
                    <CardDescription className="text-xs">Client identification & referral record</CardDescription>
                  </div>
                </div>
                {matchedCustomer && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-normal">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Linked to Existing Customer
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Phone Number <span className="text-rose-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pl-9 font-medium"
                    required
                  />
                  {isSearchingCustomer && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin absolute right-3 top-3 text-slate-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Type 11-digit mobile number</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Customer Name <span className="text-rose-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    placeholder="e.g. Rafiqul Islam"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pl-9 font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Referral Number <span className="text-slate-400 font-normal">(যে রেফার করেছেন)</span>
                </Label>
                <div className="relative mt-1">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    type="tel"
                    placeholder="Referrer Phone (Optional)"
                    value={referralNumber}
                    onChange={(e) => setReferralNumber(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Employee & Invoice */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">Employee & Invoice</CardTitle>
                  <CardDescription className="text-xs">Assigned servicing technician and unique job invoice</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Assigned Technician <span className="text-rose-500">*</span>
                </Label>
                <div className="mt-1">
                  <SearchableSelect
                    options={technicians.map((t) => ({
                      value: t.id,
                      label: t.name,
                      secondary: t.phone || t.employeeId || "Staff",
                    }))}
                    value={selectedTechnicianId}
                    onChange={(val) => setSelectedTechnicianId(val)}
                    placeholder="-- Select Technician --"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Defaults to logged-in technician</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Invoice Number <span className="text-rose-500">*</span>
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="relative flex-1">
                    <Hash className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="INV-0001"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      className="pl-9 font-mono font-bold"
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchNextInvoice}
                    disabled={isLoadingInvoice}
                    title="Auto-suggest next invoice"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInvoice ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Sequential identifier, editable if required</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Device Information */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">Device Information</CardTitle>
                  <CardDescription className="text-xs">Dependent lookup: Device Type → Brand → Model</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Device Type <span className="text-rose-500">*</span>
                </Label>
                <select
                  value={selectedDeviceTypeId}
                  onChange={(e) => {
                    setSelectedDeviceTypeId(e.target.value);
                    if (!e.target.value) {
                      setSelectedBrandId("");
                      setDeviceModel("");
                    }
                  }}
                  className="w-full mt-1 h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Select Device Type...</option>
                  {deviceTypes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Brand <span className="text-rose-500">*</span>
                </Label>
                <div className="mt-1">
                  <SearchableSelect
                    options={brands.map((b) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                    value={selectedBrandId}
                    disabled={!selectedDeviceTypeId}
                    onChange={(val) => {
                      setSelectedBrandId(val);
                      if (!val) setDeviceModel("");
                    }}
                    placeholder={selectedDeviceTypeId ? "Select Brand..." : "Select device type first..."}
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Device Model <span className="text-rose-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <Smartphone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    placeholder={selectedBrandId ? "e.g. 13 Pro Max, S23 Ultra" : "Select brand first..."}
                    value={deviceModel}
                    disabled={!selectedBrandId}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    className="pl-9 font-medium"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Problem Details */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">
                      Problem Details <span className="text-rose-500">*</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Multi-select checklist from database lookup with suggested labor rates
                    </CardDescription>
                  </div>
                </div>
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Filter issues..."
                    value={problemSearchQuery}
                    onChange={(e) => setProblemSearchQuery(e.target.value)}
                    className="h-7 pl-7 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {filteredProblems.map((prob) => {
                  const isChecked = selectedProblemIds.includes(prob.id);
                  return (
                    <div
                      key={prob.id}
                      onClick={() => handleToggleProblem(prob)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-emerald-50/80 border-emerald-400 text-emerald-900 shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-semibold truncate">{prob.name}</span>
                      </div>
                      {Number(prob.suggestedLaborPrice) > 0 && (
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0">
                          ৳{Number(prob.suggestedLaborPrice).toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedProblemIds.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Selected issues: <span className="font-semibold text-slate-800">{selectedProblemIds.length}</span>
                  </span>
                  <span className="text-emerald-700 font-medium">
                    Auto-suggested Labor Charge applied to pricing
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 5: Material History (Supplier Linked Spare Parts) */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    5
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">
                      Material History (Parts & Sourcing)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Supplier-linked parts with catalog search or free-text entry
                    </CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMaterialRow}
                  className="text-xs h-8 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Part / Material
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-3">
                {materials.map((row, idx) => (
                  <div
                    key={row.id}
                    className={`p-3 rounded-lg border transition-all ${
                      row.sourceType === "OTHER"
                        ? "bg-amber-50/20 border-amber-300 shadow-xs"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                      {/* Part Name / Catalog Picker (3 cols) */}
                      <div className="md:col-span-3">
                        <Label className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                          <span>Part / Material Name *</span>
                          <span className="text-[10px] text-emerald-600 font-normal">Live Catalog Search</span>
                        </Label>
                        <PartTypeaheadInput
                          value={row.partName}
                          onChange={(val) => handleUpdateMaterialRow(row.id, "partName", val)}
                          onSelectPart={(selected) => {
                            handleUpdateMaterialRow(row.id, "partName", selected.partName);
                            handleUpdateMaterialRow(row.id, "productId", selected.productId);
                            handleUpdateMaterialRow(row.id, "cost", selected.cost);
                            handleUpdateMaterialRow(row.id, "sourceType", "OWN_STOCK");
                          }}
                          branchId={selectedBranchId}
                          placeholder="Type part name (e.g. S23)"
                        />
                      </div>

                      {/* Source Type Selector (2 cols) */}
                      <div className="md:col-span-2">
                        <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                          Source Type *
                        </Label>
                        <select
                          value={row.sourceType}
                          onChange={(e) => handleUpdateMaterialRow(row.id, "sourceType", e.target.value)}
                          className={`w-full h-8 text-xs rounded-md border bg-white px-2 font-medium ${
                            row.sourceType === "OTHER"
                              ? "border-amber-400 focus:ring-amber-500 font-semibold text-amber-900"
                              : "border-slate-300 focus:ring-emerald-500 text-slate-800"
                          }`}
                        >
                          <option value="OWN_STOCK">From Own Stock</option>
                          <option value="SUPPLIER">From Supplier</option>
                          <option value="OTHER">Sourced From Outside</option>
                        </select>
                      </div>

                      {/* Sourcing Details (Supplier or Note or Own Stock Tag) (3 cols) */}
                      <div className="md:col-span-3">
                        {row.sourceType === "SUPPLIER" ? (
                          <div>
                            <Label className="text-[11px] font-semibold text-emerald-700 mb-1 flex items-center justify-between">
                              <span>Sourced Supplier *</span>
                              <span className="text-[10px] text-emerald-600 font-normal">Registered</span>
                            </Label>
                            <SearchableSelect
                              options={suppliers.map((s) => ({
                                value: s.id,
                                label: s.name || s.companyName || "Supplier",
                                secondary: s.phone,
                              }))}
                              value={row.supplierId}
                              onChange={(val) => handleUpdateMaterialRow(row.id, "supplierId", val)}
                              placeholder="Select Supplier..."
                              required
                            />
                          </div>
                        ) : row.sourceType === "OTHER" ? (
                          <div>
                            <Label className="text-[11px] font-semibold text-amber-800 mb-1 block">
                              Sourcing Source
                            </Label>
                            <div className="h-8 flex items-center px-2.5 rounded-md bg-amber-50 border border-amber-300 text-[11px] text-amber-900 font-medium">
                              <Store className="w-3.5 h-3.5 mr-1.5 text-amber-700 flex-shrink-0" />
                              <span className="truncate font-semibold">Outside / Ad-hoc Vendor</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <Label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                              Sourcing Source
                            </Label>
                            <div className="h-8 flex items-center px-2.5 rounded-md bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-800 font-medium">
                              <span className="truncate">In-House Inventory</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Unit Cost (2 cols) */}
                      <div className="md:col-span-2">
                        <Label className="text-[11px] font-semibold text-slate-600 mb-1">Unit Cost (৳) *</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={row.cost === 0 ? "" : row.cost}
                          onChange={(e) => handleUpdateMaterialRow(row.id, "cost", e.target.value)}
                          className="h-8 text-xs bg-white font-mono font-bold"
                        />
                      </div>

                      {/* Quantity (1 col) */}
                      <div className="md:col-span-1">
                        <Label className="text-[11px] font-semibold text-slate-600 mb-1">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => handleUpdateMaterialRow(row.id, "quantity", e.target.value)}
                          className="h-8 text-xs bg-white text-center font-bold"
                        />
                      </div>

                      {/* Total & Action (1 col) */}
                      <div className="md:col-span-1 flex items-center justify-between gap-1">
                        <div>
                          <Label className="text-[11px] font-semibold text-slate-600 mb-1">Total</Label>
                          <div className="text-xs font-mono font-bold text-slate-800 py-1">
                            ৳{Number(row.total || 0).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={materials.length <= 1}
                          onClick={() => handleRemoveMaterialRow(row.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                          title="Delete material row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Dedicated "Sourced From Outside" Box directly below this row */}
                    {row.sourceType === "OTHER" && (
                      <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 mt-2 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-amber-200/80">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                            <Store className="w-4 h-4 text-amber-700" />
                            <span>Sourced From Outside (Vendor & Sourcing Details)</span>
                          </div>
                          <span className="text-[10px] text-amber-800 bg-amber-200/60 border border-amber-300 px-2 py-0.5 rounded font-semibold">
                            Outside Sourcing Details
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          {/* Sourced From (Vendor/Person Name) - Required */}
                          <div className="md:col-span-5">
                            <Label className="text-xs font-bold text-amber-900 mb-1 flex items-center justify-between">
                              <span>Sourced From (Vendor/Person Name) *</span>
                              <span className="text-[10px] text-amber-700 font-semibold">(Required)</span>
                            </Label>
                            <Input
                              placeholder="e.g. Anwar Hardware, Elephant Road"
                              value={row.sourcedFromName || ""}
                              onChange={(e) => handleUpdateMaterialRow(row.id, "sourcedFromName", e.target.value)}
                              className="h-8 text-xs bg-white border-amber-300 text-slate-900 focus-visible:ring-amber-500 font-medium placeholder:text-slate-400"
                              required
                            />
                          </div>

                          {/* Note / Description - Optional */}
                          <div className="md:col-span-7">
                            <Label className="text-xs font-semibold text-amber-900 mb-1 flex items-center justify-between">
                              <span>Note / Description (Optional)</span>
                            </Label>
                            <Textarea
                              rows={2}
                              placeholder="e.g. Bought urgently, no warranty, cash payment"
                              value={row.sourceNote || ""}
                              onChange={(e) => handleUpdateMaterialRow(row.id, "sourceNote", e.target.value)}
                              className="min-h-[34px] h-[34px] text-xs bg-white border-amber-300 text-slate-900 focus-visible:ring-amber-500 font-medium resize-none py-1.5 placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Running Total Material Cost */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/60 border border-blue-100">
                <span className="text-xs font-semibold text-blue-900">Total Material Cost:</span>
                <span className="text-base font-bold font-mono text-blue-800">
                  ৳{totalMaterialCost.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sticky Sidebar (1 col): Warranty, Pricing, Payments, Summary */}
        <div className="space-y-6">
          {/* Section 6: Warranty */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                  6
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">Warranty Coverage</CardTitle>
                  <CardDescription className="text-xs">Post-repair warranty guarantee period</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Warranty Period *</Label>
                <select
                  value={selectedWarrantyPeriod}
                  onChange={(e) => handleWarrantyChange(e.target.value)}
                  className="w-full mt-1 h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 focus:ring-emerald-500"
                  required
                >
                  {warrantyPeriods.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedWarrantyPeriod !== "No Warranty" && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600">Start Date</Label>
                    <Input
                      type="date"
                      value={warrantyStartDate}
                      onChange={(e) => {
                        setWarrantyStartDate(e.target.value);
                        handleWarrantyChange(selectedWarrantyPeriod);
                      }}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600">End Date</Label>
                    <Input
                      type="date"
                      value={warrantyEndDate}
                      onChange={(e) => setWarrantyEndDate(e.target.value)}
                      className="h-8 text-xs mt-1 font-semibold text-purple-700"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 7 & 8: Pricing & Billing */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  7 & 8
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">Pricing & Billing</CardTitle>
                  <CardDescription className="text-xs">Labor charges & split payment breakdown</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Labor Price */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Service / Labor Price (৳) <span className="text-rose-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <Receipt className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={laborPrice === 0 ? "" : laborPrice}
                    onChange={(e) => setLaborPrice(Number(e.target.value) || 0)}
                    className="pl-9 font-mono font-bold text-slate-900"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Technician profit share is calculated exclusively on this labor margin.
                </p>
              </div>

              {/* Payment Methods Multi-select */}
              <div className="pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Select Payment Method(s) <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {AVAILABLE_PAYMENT_METHODS.map((method) => {
                    const isSelected = selectedPaymentMethods.includes(method.id);
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => handleTogglePaymentMethod(method.id)}
                        className={`py-1.5 px-2 rounded-md text-xs font-semibold border transition-all text-center ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {method.label}
                      </button>
                    );
                  })}
                </div>

                {selectedPaymentMethods.length === 0 && (
                  <p className="text-[11px] text-rose-500 mt-2">
                    Please select at least one payment method above to input details
                  </p>
                )}
              </div>

              {/* Payment Amount Inputs (Split Payment) */}
              {selectedPaymentMethods.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Collected Amounts:</span>
                    <button
                      type="button"
                      onClick={handleQuickFillFullPayment}
                      className="text-[11px] text-emerald-600 font-bold hover:underline"
                    >
                      Quick Fill Full (৳{finalAmount.toLocaleString()})
                    </button>
                  </div>
                  {selectedPaymentMethods.map((m) => {
                    const meta = AVAILABLE_PAYMENT_METHODS.find((pm) => pm.id === m);
                    return (
                      <div key={m} className="flex items-center gap-2">
                        <span className="w-28 text-xs font-medium text-slate-600 truncate">{meta?.label}:</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-mono">৳</span>
                          <Input
                            type="number"
                            min="0"
                            value={paymentAmounts[m] === 0 ? "" : paymentAmounts[m]}
                            onChange={(e) => handlePaymentAmountChange(m, Number(e.target.value))}
                            placeholder="0"
                            className="h-8 pl-6 text-xs font-mono font-bold"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 9: Service Summary */}
          <Card className="border-slate-300 shadow-md bg-white sticky top-4">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-900 text-white rounded-t-xl">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                  9
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Service Summary</CardTitle>
                  <CardDescription className="text-xs text-slate-300">Live recap & job finalization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Labor / Service Charge:</span>
                <span className="font-mono font-bold text-slate-800">৳{laborPrice.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Material Cost:</span>
                <span className="font-mono font-bold text-blue-700">৳{totalMaterialCost.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-800 font-semibold pt-1 border-t border-slate-100">
                <span>TOTAL BILL:</span>
                <span className="font-mono font-bold">৳{totalBill.toLocaleString()}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-rose-600 font-medium">DISCOUNT (-):</span>
                <div className="relative w-24">
                  <span className="absolute left-2 top-1.5 text-xs text-rose-500 font-mono">৳</span>
                  <Input
                    type="number"
                    min="0"
                    value={discount === 0 ? "" : discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="h-7 pl-5 text-xs font-mono font-bold text-rose-600 border-rose-200 focus:ring-rose-500 text-right"
                  />
                </div>
              </div>

              {/* Final Amount */}
              <div className="p-3 bg-slate-900 text-white rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">FINAL AMOUNT</div>
                  <div className="text-xl font-bold font-mono text-emerald-400">৳{finalAmount.toLocaleString()}</div>
                </div>
                <div className="text-right text-[11px] text-slate-300">
                  <div>Paid: <span className="font-mono font-bold text-white">৳{totalPaidAmount.toLocaleString()}</span></div>
                  {dueAmount > 0 ? (
                    <div className="text-amber-300 font-bold">Due: ৳{dueAmount.toLocaleString()}</div>
                  ) : (
                    <div className="text-emerald-300 font-semibold">Fully Paid</div>
                  )}
                </div>
              </div>

              {/* Create Service Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 text-base shadow-md mt-2"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Service Job...</span>
                  </div>
                ) : (
                  <span>Create Service (Submit)</span>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
