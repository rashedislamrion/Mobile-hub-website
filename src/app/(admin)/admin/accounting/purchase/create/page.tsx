"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Upload,
  CheckCircle2,
  FileText,
  Building2,
  DollarSign,
  AlertCircle,
  HelpCircle,
  X,
  CreditCard,
  Wallet,
  Smartphone,
  Headphones,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiGet, apiPost, getImageUrl, getStaffToken, API_BASE_URL } from "@/lib/api-client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useStaffAuth } from "@/context/AuthContext";
import Image from "next/image";

interface SupplierItem {
  id: string;
  name: string;
  companyName?: string | null;
  contactPerson?: string | null;
  phone: string;
  email?: string | null;
  address: string;
  productsCategory?: string | null;
  advanceBalance?: number | string | null;
  totalDue?: number | string | null;
}

interface WalletItem {
  id: string;
  name: string;
  currentBalance: number | string;
}

interface ProductVariantItem {
  id: string;
  sku: string;
  color?: string | null;
  quality?: string | null;
  price: number | string;
  buyingPrice?: number | string | null;
  wholesalePrice?: number | string | null;
  discountedPrice?: number | string | null;
  offerPrice?: number | string | null;
  stock: number;
  attributes?: any;
}

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  productType?: string | null;
  condition?: string | null;
  regularPrice: number | string;
  salePrice?: number | string | null;
  costPrice?: number | string | null;
  buyingPrice?: number | string | null;
  wholesalePrice?: number | string | null;
  category?: { id: string; name: string; slug: string } | null;
  brand?: { id: string; name: string } | null;
  images?: { url: string }[];
  variants: ProductVariantItem[];
}

export interface PhoneUnitIntake {
  imei1: string;
  imei2?: string;
  serialNumber?: string;
  condition?: string;
  warrantyType?: string;
  warrantyPeriod?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  buyingPrice?: number;
  sellingPrice?: number;
  imei1Status?: "idle" | "checking" | "valid" | "duplicate";
  imei2Status?: "idle" | "checking" | "valid" | "duplicate";
}

interface ShipmentLineItem {
  key: string;
  productId: string;
  productName: string;
  productImage?: string;
  variantId?: string;
  variantSku?: string;
  color?: string | null;
  quality?: string | null;
  quantityOrdered: number;
  unitCost: number; // Buying price
  sellingPrice?: number;
  wholesalePrice?: number;
  offerPrice?: number;
  lineTotal: number;
  isPhone?: boolean;
  phoneUnits?: PhoneUnitIntake[];
}

interface WalletPaymentRow {
  id: string;
  walletTypeId: string;
  amount: number;
}

export default function CreatePurchaseOrderPage() {
  const { setTitle, setBadge, setDateFilter, selectedBranchId, branches } = useAdminPage();
  const { user } = useStaffAuth();
  const router = useRouter();

  const isGlobalAdmin = Boolean(
    user?.isGlobal ||
    user?.role?.scope === "GLOBAL" ||
    user?.role?.name?.toLowerCase().includes("super admin") ||
    user?.role?.name?.toLowerCase() === "admin"
  );

  const userBranches = useMemo(() => {
    if (isGlobalAdmin) return branches;
    if (user?.allowedBranches && user.allowedBranches.length > 0) {
      return branches.filter((b) => user.allowedBranches?.some((ab) => ab.id === b.id));
    }
    if (user?.branchId) {
      return branches.filter((b) => b.id === user.branchId);
    }
    return branches;
  }, [isGlobalAdmin, branches, user]);

  const isSingleBranchLocked = !isGlobalAdmin && userBranches.length === 1;

  // Master Data
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [masterDataErrors, setMasterDataErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State: Purchase Details
  const [purchaseType, setPurchaseType] = useState<string>("ALL");
  const [purchaseBranchId, setPurchaseBranchId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>("");
  const [purchaseDocument, setPurchaseDocument] = useState<File | null>(null);
  const [documentPreviewName, setDocumentPreviewName] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");

  // Quick Add Supplier Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    companyName: "",
    phone: "",
    address: "",
    productsCategory: "",
    advanceBalance: 0,
  });

  // Catalog Grid State
  const [productSearch, setProductSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("all");

  // Product Selection Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<ProductItem | null>(null);
  const [modalVariantId, setModalVariantId] = useState<string>("");
  const [modalColors, setModalColors] = useState<string[]>([]);
  const [modalQualities, setModalQualities] = useState<string[]>([]);
  const [modalSelectedColor, setModalSelectedColor] = useState<string>("");
  const [modalSelectedQuality, setModalSelectedQuality] = useState<string>("");
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalBuyingPrice, setModalBuyingPrice] = useState<number>(0);
  const [modalSellingPrice, setModalSellingPrice] = useState<string>("");
  const [modalWholesalePrice, setModalWholesalePrice] = useState<string>("");
  const [modalOfferPrice, setModalOfferPrice] = useState<string>("");
  const [modalPhoneUnits, setModalPhoneUnits] = useState<PhoneUnitIntake[]>([]);

  const isPhoneProduct = (p: ProductItem | null) => {
    if (!p) return false;
    return (
      p.productType === "PHONE" ||
      (p as any).productCategory === "PHONE" ||
      p.category?.name?.toLowerCase().includes("phone") ||
      p.category?.slug?.toLowerCase().includes("phone")
    );
  };

  const updateModalPhoneUnit = (index: number, field: keyof PhoneUnitIntake, value: any) => {
    setModalPhoneUnits((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const checkImeiDebounced = useCallback((unitIndex: number, field: "imei1" | "imei2", val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setModalPhoneUnits((prev) =>
        prev.map((u, i) => (i === unitIndex ? { ...u, [`${field}Status`]: "idle" } : u))
      );
      return;
    }

    setModalPhoneUnits((prev) =>
      prev.map((u, i) => (i === unitIndex ? { ...u, [`${field}Status`]: "checking" } : u))
    );

    apiGet<{ isAvailable: boolean; message?: string }>(`/phone-units/check-imei?imei=${encodeURIComponent(trimmed)}`)
      .then((res) => {
        setModalPhoneUnits((prev) => {
          const isDuplicateInModal = prev.some((u, i) => {
            if (i === unitIndex) return false;
            return u.imei1 === trimmed || u.imei2 === trimmed;
          });

          const isDuplicate = !res.isAvailable || isDuplicateInModal;
          return prev.map((u, i) =>
            i === unitIndex ? { ...u, [`${field}Status`]: isDuplicate ? "duplicate" : "valid" } : u
          );
        });
      })
      .catch(() => {
        setModalPhoneUnits((prev) =>
          prev.map((u, i) => (i === unitIndex ? { ...u, [`${field}Status`]: "idle" } : u))
        );
      });
  }, []);

  const handleModalQuantityChange = (newQty: number) => {
    const safeQty = Math.max(1, newQty);
    setModalQuantity(safeQty);
    if (isPhoneProduct(modalProduct)) {
      setModalPhoneUnits((prev) => {
        if (prev.length === safeQty) return prev;
        if (prev.length < safeQty) {
          const added: PhoneUnitIntake[] = [];
          for (let i = prev.length; i < safeQty; i++) {
            added.push({
              imei1: "",
              imei2: "",
              serialNumber: "",
              condition: modalProduct?.condition || "NEW",
              warrantyType: "1 Year Official Warranty",
              warrantyPeriod: "365 Days / 1 Year",
              warrantyStartDate: purchaseDate,
              warrantyEndDate: (() => {
                const d = new Date(purchaseDate || Date.now());
                d.setDate(d.getDate() + 365);
                return d.toISOString().split("T")[0];
              })(),
              imei1Status: "idle",
              imei2Status: "idle",
            });
          }
          return [...prev, ...added];
        } else {
          return prev.slice(0, safeQty);
        }
      });
    }
  };

  // Branch Selection Sync - Enforces Task 2c Rules
  useEffect(() => {
    if (isSingleBranchLocked && userBranches[0]) {
      setPurchaseBranchId(userBranches[0].id);
    } else if (isGlobalAdmin) {
      if (selectedBranchId && selectedBranchId !== "all") {
        setPurchaseBranchId(selectedBranchId);
      } else {
        // Super Admin with "All Branches" -> empty placeholder, required
        setPurchaseBranchId("");
      }
    } else if (userBranches.length > 1) {
      if (selectedBranchId && selectedBranchId !== "all" && userBranches.some((b) => b.id === selectedBranchId)) {
        setPurchaseBranchId(selectedBranchId);
      } else {
        setPurchaseBranchId("");
      }
    }
  }, [isGlobalAdmin, isSingleBranchLocked, userBranches, selectedBranchId]);

  // Shipment Line Items
  const [lineItems, setLineItems] = useState<ShipmentLineItem[]>([]);

  // Payment Details State
  const [useAdvance, setUseAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [walletPayments, setWalletPayments] = useState<WalletPaymentRow[]>([]);
  const [paymentNote, setPaymentNote] = useState<string>("");

  // Summary Modifiers
  const [discount, setDiscount] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);

  useEffect(() => {
    setTitle("New Purchase");
    setBadge("Accounting");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  // Initial Data Fetching - Resilient via Promise.allSettled with visible error state
  const loadMasterData = useCallback(async () => {
    try {
      setIsLoading(true);
      setMasterDataErrors([]);
      const [supRes, walletRes, catRes, prodRes] = await Promise.allSettled([
        apiGet<{ data: SupplierItem[] }>("/suppliers", { limit: 100 }),
        apiGet<WalletItem[]>("/wallet-types"),
        apiGet<any[]>("/categories/tree"),
        apiGet<{ data: ProductItem[] }>("/products", { limit: 150 }),
      ]);

      const errors: string[] = [];

      if (supRes.status === "fulfilled" && supRes.value?.data) {
        setSuppliers(supRes.value.data);
      } else {
        errors.push("Suppliers");
      }

      if (walletRes.status === "fulfilled" && Array.isArray(walletRes.value)) {
        setWallets(walletRes.value);
      } else {
        errors.push("Wallets");
      }

      if (catRes.status === "fulfilled" && Array.isArray(catRes.value)) {
        const flat: { id: string; name: string; slug: string }[] = [];
        const traverse = (items: any[]) => {
          items.forEach((item) => {
            flat.push({ id: item.id, name: item.name, slug: item.slug });
            if (item.children?.length) traverse(item.children);
          });
        };
        traverse(catRes.value);
        setCategories(flat);
      } else {
        errors.push("Categories");
      }

      if (prodRes.status === "fulfilled" && prodRes.value?.data) {
        setProducts(prodRes.value.data);
      } else {
        errors.push("Products");
      }

      if (errors.length > 0) {
        setMasterDataErrors(errors);
        toast.error(`Failed to load ${errors.join(", ")}. Please click Retry.`);
      }
    } catch (err: any) {
      setMasterDataErrors(["Purchase configuration data"]);
      toast.error(err.message || "Failed to load purchase configuration data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Selected Supplier object
  const currentSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  const availableAdvanceBalance = useMemo(() => {
    return Number(currentSupplier?.advanceBalance || 0);
  }, [currentSupplier]);

  // Filtered Products Catalog with Token Matching
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Purchase Type Filter
      if (purchaseType === "PHONE") {
        if (!isPhoneProduct(p)) return false;
      } else if (purchaseType === "SPARE_PART") {
        if (isPhoneProduct(p)) return false;
        const catName = p.category?.name?.toLowerCase() || "";
        const isPart =
          (p as any).productCategory === "SPARE_PART" ||
          catName.includes("display") ||
          catName.includes("battery") ||
          catName.includes("part") ||
          catName.includes("housing") ||
          catName.includes("camera") ||
          catName.includes("port") ||
          catName.includes("glass") ||
          catName.includes("panel");
        if (!isPart && (p as any).productCategory && (p as any).productCategory !== "SPARE_PART") return false;
      } else if (purchaseType === "GADGET") {
        if (isPhoneProduct(p)) return false;
        const catName = p.category?.name?.toLowerCase() || "";
        const isGadget =
          (p as any).productCategory === "GADGET" ||
          catName.includes("gadget") ||
          catName.includes("airpod") ||
          catName.includes("headphone") ||
          catName.includes("speaker") ||
          catName.includes("watch");
        if (!isGadget && (p as any).productCategory && (p as any).productCategory !== "GADGET") return false;
      } else if (purchaseType === "ACCESSORY") {
        if (isPhoneProduct(p)) return false;
        const catName = p.category?.name?.toLowerCase() || "";
        const isAccessory =
          (p as any).productCategory === "ACCESSORY" ||
          catName.includes("accessor") ||
          catName.includes("case") ||
          catName.includes("cover") ||
          catName.includes("power") ||
          catName.includes("charger") ||
          catName.includes("cable");
        if (!isAccessory && (p as any).productCategory && (p as any).productCategory !== "ACCESSORY") return false;
      }

      // Token-based matching on productSearch
      const searchTokens = productSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
      const matchSearch =
        searchTokens.length === 0 ||
        searchTokens.every((token) => {
          const inName = p.name.toLowerCase().includes(token);
          const inCode = ((p as any).code || "").toLowerCase().includes(token);
          const inSlug = (p.slug || "").toLowerCase().includes(token);
          const inBrand = (p.brand?.name || "").toLowerCase().includes(token);
          const inCategory = (p.category?.name || "").toLowerCase().includes(token);
          const inVariants = (p.variants || []).some(
            (v: any) =>
              (v.sku || "").toLowerCase().includes(token) ||
              (v.color || "").toLowerCase().includes(token) ||
              (v.quality || "").toLowerCase().includes(token)
          );
          return inName || inCode || inSlug || inBrand || inCategory || inVariants;
        });

      const matchCategory =
        selectedCategorySlug === "all" || p.category?.slug === selectedCategorySlug;

      const matchBrand =
        !brandFilter.trim() ||
        (p.brand?.name && p.brand.name.toLowerCase().includes(brandFilter.toLowerCase()));

      return matchSearch && matchCategory && matchBrand;
    });
  }, [products, productSearch, selectedCategorySlug, brandFilter, purchaseType]);

  // Calculations
  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [lineItems]);

  const totalQuantity = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.quantityOrdered, 0);
  }, [lineItems]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0) + (Number(shippingCost) || 0) + (Number(tax) || 0));
  }, [subtotal, discount, shippingCost, tax]);

  const walletPaymentsSum = useMemo(() => {
    return walletPayments.reduce((sum, wp) => sum + (Number(wp.amount) || 0), 0);
  }, [walletPayments]);

  const effectiveAdvanceUsed = useMemo(() => {
    if (!useAdvance) return 0;
    return Math.min(Number(advanceAmount) || 0, availableAdvanceBalance);
  }, [useAdvance, advanceAmount, availableAdvanceBalance]);

  const totalPaid = useMemo(() => {
    return walletPaymentsSum + effectiveAdvanceUsed;
  }, [walletPaymentsSum, effectiveAdvanceUsed]);

  const unpaidAmount = useMemo(() => {
    return Math.max(0, grandTotal - totalPaid);
  }, [grandTotal, totalPaid]);

  // Quick Add Supplier Handler
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim() || !newSupplier.phone.trim() || !newSupplier.address.trim()) {
      toast.error("Please fill in Supplier Name, Contact Number, and Address");
      return;
    }

    try {
      const created = await apiPost<SupplierItem>("/suppliers", {
        name: newSupplier.name.trim(),
        companyName: newSupplier.companyName?.trim() || null,
        phone: newSupplier.phone.trim(),
        address: newSupplier.address.trim(),
        productsCategory: newSupplier.productsCategory?.trim() || null,
        advanceBalance: Number(newSupplier.advanceBalance) || 0,
      });

      toast.success(`Supplier "${created.name}" created successfully`);
      setSuppliers((prev) => [created, ...prev]);
      setSelectedSupplierId(created.id);
      setIsSupplierModalOpen(false);
      setNewSupplier({
        name: "",
        companyName: "",
        phone: "",
        address: "",
        productsCategory: "",
        advanceBalance: 0,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to create supplier");
    }
  };

  // Variant Attribute Helpers
  const getVariantColor = (v: ProductVariantItem): string => {
    if (v.color) return v.color;
    if (v.attributes && typeof v.attributes === "object") {
      return (v.attributes as any).Color || (v.attributes as any).color || "";
    }
    return "";
  };

  const getVariantQuality = (v: ProductVariantItem): string => {
    if (v.quality) return v.quality;
    if (v.attributes && typeof v.attributes === "object") {
      return (v.attributes as any).Quality || (v.attributes as any).quality || "";
    }
    return "";
  };

  const findMatchingVariant = (product: ProductItem, color: string, quality: string) => {
    const variants = product.variants || [];
    if (variants.length === 0) return null;

    if (color && quality) {
      const exact = variants.find(
        (v) => getVariantColor(v) === color && getVariantQuality(v) === quality
      );
      if (exact) return exact;
    }
    if (color) {
      const colorMatch = variants.find((v) => getVariantColor(v) === color);
      if (colorMatch) return colorMatch;
    }
    if (quality) {
      const qualityMatch = variants.find((v) => getVariantQuality(v) === quality);
      if (qualityMatch) return qualityMatch;
    }
    return variants[0];
  };

  // Open Product Modal
  const handleOpenProductModal = (product: ProductItem) => {
    setModalProduct(product);
    const variants = product.variants || [];
    const colors = Array.from(new Set(variants.map(getVariantColor).filter(Boolean)));
    const qualities = Array.from(new Set(variants.map(getVariantQuality).filter(Boolean)));

    setModalColors(colors);
    setModalQualities(qualities);

    const initialColor = colors[0] || "";
    const initialQuality = qualities[0] || "";
    setModalSelectedColor(initialColor);
    setModalSelectedQuality(initialQuality);

    const matched = findMatchingVariant(product, initialColor, initialQuality);
    const variantId = matched?.id || variants[0]?.id || "";
    setModalVariantId(variantId);
    setModalQuantity(1);

    const initialCost = Number(
      matched?.buyingPrice ??
      product.buyingPrice ??
      product.costPrice ??
      matched?.price ??
      product.regularPrice ??
      0
    );
    setModalBuyingPrice(initialCost);
    setModalSellingPrice(
      matched?.price
        ? String(matched.price)
        : product.regularPrice
        ? String(product.regularPrice)
        : ""
    );
    setModalWholesalePrice(
      matched?.wholesalePrice
        ? String(matched.wholesalePrice)
        : product.wholesalePrice
        ? String(product.wholesalePrice)
        : ""
    );
    setModalOfferPrice(
      matched?.offerPrice
        ? String(matched.offerPrice)
        : matched?.discountedPrice
        ? String(matched.discountedPrice)
        : product.salePrice
        ? String(product.salePrice)
        : ""
    );

    const isPhone = isPhoneProduct(product);
    if (isPhone) {
      setModalPhoneUnits([
        {
          imei1: "",
          imei2: "",
          serialNumber: "",
          condition: product.condition || "NEW",
          warrantyType: "1 Year Official Warranty",
          warrantyPeriod: "365 Days / 1 Year",
          warrantyStartDate: purchaseDate,
          warrantyEndDate: (() => {
            const d = new Date(purchaseDate || Date.now());
            d.setDate(d.getDate() + 365);
            return d.toISOString().split("T")[0];
          })(),
          imei1Status: "idle",
          imei2Status: "idle",
        },
      ]);
    } else {
      setModalPhoneUnits([]);
    }

    setIsProductModalOpen(true);
  };

  const handleSelectColorPill = (color: string) => {
    setModalSelectedColor(color);
    if (!modalProduct) return;
    const matched = findMatchingVariant(modalProduct, color, modalSelectedQuality);
    if (matched) {
      setModalVariantId(matched.id);
      if (matched.buyingPrice !== undefined && matched.buyingPrice !== null) {
        setModalBuyingPrice(Number(matched.buyingPrice));
      }
      if (matched.price) setModalSellingPrice(String(matched.price));
      if (matched.wholesalePrice) setModalWholesalePrice(String(matched.wholesalePrice));
      if (matched.offerPrice || matched.discountedPrice) {
        setModalOfferPrice(String(matched.offerPrice || matched.discountedPrice));
      }
    }
  };

  const handleSelectQualityPill = (quality: string) => {
    setModalSelectedQuality(quality);
    if (!modalProduct) return;
    const matched = findMatchingVariant(modalProduct, modalSelectedColor, quality);
    if (matched) {
      setModalVariantId(matched.id);
      if (matched.buyingPrice !== undefined && matched.buyingPrice !== null) {
        setModalBuyingPrice(Number(matched.buyingPrice));
      }
      if (matched.price) setModalSellingPrice(String(matched.price));
      if (matched.wholesalePrice) setModalWholesalePrice(String(matched.wholesalePrice));
      if (matched.offerPrice || matched.discountedPrice) {
        setModalOfferPrice(String(matched.offerPrice || matched.discountedPrice));
      }
    }
  };

  // Add Item to Line Items
  const handleAddLineItem = () => {
    if (!modalProduct) return;
    const qty = Number(modalQuantity);
    const cost = Number(modalBuyingPrice);
    if (qty <= 0) {
      toast.error("Quantity must be at least 1");
      return;
    }
    if (cost < 0) {
      toast.error("Buying price cannot be negative");
      return;
    }

    const isPhone = isPhoneProduct(modalProduct);
    if (isPhone) {
      if (modalPhoneUnits.length === 0) {
        toast.error("Please configure at least one phone unit.");
        return;
      }
      for (let i = 0; i < modalPhoneUnits.length; i++) {
        const u = modalPhoneUnits[i];
        if (!u.imei1.trim()) {
          toast.error(`Phone unit #${i + 1} requires IMEI 1.`);
          return;
        }
        if (u.imei1Status === "duplicate") {
          toast.error(`IMEI 1 "${u.imei1}" for Unit #${i + 1} already exists. Duplicate IMEIs are rejected.`);
          return;
        }
        if (u.imei2?.trim() && u.imei2Status === "duplicate") {
          toast.error(`IMEI 2 "${u.imei2}" for Unit #${i + 1} already exists. Duplicate IMEIs are rejected.`);
          return;
        }
      }
    }

    const variant = modalProduct.variants?.find((v) => v.id === modalVariantId);
    const key = `${modalProduct.id}-${variant?.id || "base"}`;

    const existingIndex = lineItems.findIndex((item) => item.key === key);
    const effectiveQty = isPhone ? modalPhoneUnits.length : qty;
    const lineTotal = effectiveQty * cost;

    const chosenColor = modalSelectedColor || variant?.color || (variant?.attributes as any)?.Color || null;
    const chosenQuality = modalSelectedQuality || variant?.quality || (variant?.attributes as any)?.Quality || null;

    const newItem: ShipmentLineItem = {
      key,
      productId: modalProduct.id,
      productName: modalProduct.name,
      productImage: modalProduct.images?.[0]?.url,
      variantId: variant?.id,
      variantSku: variant?.sku,
      color: chosenColor,
      quality: chosenQuality,
      quantityOrdered: effectiveQty,
      unitCost: cost,
      sellingPrice: modalSellingPrice ? Number(modalSellingPrice) : undefined,
      wholesalePrice: modalWholesalePrice ? Number(modalWholesalePrice) : undefined,
      offerPrice: modalOfferPrice ? Number(modalOfferPrice) : undefined,
      lineTotal,
      isPhone,
      phoneUnits: isPhone
        ? modalPhoneUnits.map((u) => ({
            ...u,
            buyingPrice: cost,
            sellingPrice: modalSellingPrice ? Number(modalSellingPrice) : undefined,
          }))
        : undefined,
    };

    if (existingIndex > -1) {
      const updated = [...lineItems];
      updated[existingIndex] = newItem;
      setLineItems(updated);
      toast.info(`Updated "${modalProduct.name}" in line items`);
    } else {
      setLineItems((prev) => [...prev, newItem]);
      toast.success(`Added "${modalProduct.name}" to shipment`);
    }

    setIsProductModalOpen(false);
  };

  // Line Item Update
  const updateLineItem = (index: number, field: keyof ShipmentLineItem, value: number) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };
    item.lineTotal = Number(item.quantityOrdered) * Number(item.unitCost);
    updated[index] = item;
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Wallet Payments Row Handlers
  const handleAddWalletRow = () => {
    const defaultWallet = wallets[0]?.id || "";
    setWalletPayments((prev) => [
      ...prev,
      { id: `w-${Date.now()}-${Math.random()}`, walletTypeId: defaultWallet, amount: 0 },
    ]);
  };

  const handleRemoveWalletRow = (id: string) => {
    setWalletPayments((prev) => prev.filter((w) => w.id !== id));
  };

  const handleWalletChange = (id: string, field: "walletTypeId" | "amount", value: any) => {
    setWalletPayments((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    );
  };

  // Submit Purchase Order
  const handleSubmitPurchase = async (status: "ORDERED" | "DRAFT" | "RECEIVED") => {
    if (!purchaseBranchId) {
      toast.error("Please select a Receiving Branch");
      return;
    }
    if (!selectedSupplierId) {
      toast.error("Please select a Supplier");
      return;
    }
    if (status !== "DRAFT" && !invoiceNumber.trim()) {
      toast.error("Please enter an Invoice Number");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Please add at least one product line item");
      return;
    }

    // Validate Advance balance
    if (useAdvance && advanceAmount > availableAdvanceBalance) {
      toast.error(`Advance amount exceeds available balance of ৳${availableAdvanceBalance.toLocaleString()}`);
      return;
    }

    // Validate Wallets
    if (walletPayments.length > 0) {
      for (const wp of walletPayments) {
        if (!wp.walletTypeId) {
          toast.error("Please select a valid wallet for all payment rows");
          return;
        }
        if (wp.amount <= 0) {
          toast.error("Payment amount must be greater than 0");
          return;
        }
        const wallet = wallets.find((w) => w.id === wp.walletTypeId);
        if (status !== "DRAFT" && wallet && Number(wallet.currentBalance) < wp.amount) {
          toast.error(`Insufficient balance in ${wallet.name} (Available: ৳${Number(wallet.currentBalance).toLocaleString()})`);
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);

      for (const item of lineItems) {
        if (item.isPhone && item.phoneUnits) {
          for (let i = 0; i < item.phoneUnits.length; i++) {
            const u = item.phoneUnits[i];
            if (!u.imei1?.trim()) {
              toast.error(`Phone "${item.productName}" unit #${i + 1} is missing IMEI 1.`);
              setIsSubmitting(false);
              return;
            }
            if (u.imei1Status === "duplicate" || u.imei2Status === "duplicate") {
              toast.error(`Duplicate IMEI detected on "${item.productName}". Purchase cannot be completed.`);
              setIsSubmitting(false);
              return;
            }
          }
        }
      }

      const itemsPayload = lineItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantityOrdered: Number(item.quantityOrdered),
        unitCost: Number(item.unitCost),
        sellingPrice: item.sellingPrice,
        wholesalePrice: item.wholesalePrice,
        offerPrice: item.offerPrice,
        phoneUnits: item.phoneUnits?.map((u) => ({
          imei1: u.imei1.trim(),
          imei2: u.imei2?.trim() || undefined,
          serialNumber: u.serialNumber?.trim() || undefined,
          condition: u.condition || "NEW",
          warrantyType: u.warrantyType || undefined,
          warrantyPeriod: u.warrantyPeriod || undefined,
          warrantyStartDate: u.warrantyStartDate || undefined,
          warrantyEndDate: u.warrantyEndDate || undefined,
          buyingPrice: Number(item.unitCost),
          sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : undefined,
        })),
      }));

      const walletPayload = walletPayments
        .filter((w) => w.walletTypeId && w.amount > 0)
        .map((w) => ({
          walletTypeId: w.walletTypeId,
          amount: Number(w.amount),
        }));

      const targetBranch = purchaseBranchId;

      const payload = {
        branchId: targetBranch,
        supplierId: selectedSupplierId,
        invoiceNumber: invoiceNumber.trim() || undefined,
        orderDate: purchaseDate,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        status,
        discount: Number(discount) || 0,
        shippingCost: Number(shippingCost) || 0,
        tax: Number(tax) || 0,
        advanceUsed: useAdvance ? Number(advanceAmount) || 0 : 0,
        walletPayments: walletPayload.length > 0 ? walletPayload : undefined,
        internalNotes: internalNotes.trim() || paymentNote.trim() || undefined,
        items: itemsPayload,
      };

      const res = await apiPost<any>("/purchase-orders", payload);

      // If purchase document was selected, attach it
      if (purchaseDocument && res?.id) {
        try {
          const docFormData = new FormData();
          docFormData.append("document", purchaseDocument);
          await apiPost(`/purchase-orders/${res.id}/document`, docFormData, { authScope: "STAFF" });
        } catch (docErr) {
          console.warn("Document upload failed:", docErr);
        }
      }

      toast.success(
        status === "DRAFT"
          ? `Purchase Order ${res.poNumber || ""} saved as Draft!`
          : `Purchase Order ${res.poNumber || ""} completed successfully!`
      );
      router.push("/admin/accounting/purchase");
    } catch (err: any) {
      toast.error(err.message || "Failed to create purchase order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1550px] mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/accounting/purchase")}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">New Purchase Intake</h1>
            <p className="text-xs text-slate-500">Record supplier shipments, document invoices, and manage multi-wallet allocations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (lineItems.length > 0 && !confirm("Discard current purchase line items?")) return;
              router.push("/admin/accounting/purchase");
            }}
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4 mr-1.5" /> Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleSubmitPurchase("DRAFT")}
            className="rounded-xl border-amber-300 bg-amber-50/50 text-amber-800 hover:bg-amber-100"
          >
            Save Draft
          </Button>

          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmitPurchase("RECEIVED")}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Complete Purchase
          </Button>
        </div>
      </div>

      {masterDataErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Incomplete Master Data</p>
              <p className="text-xs text-rose-600">
                Could not load: <span className="font-medium">{masterDataErrors.join(", ")}</span>. Dropdowns or catalog may be missing items.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadMasterData}
            disabled={isLoading}
            className="border-rose-300 text-rose-700 bg-white hover:bg-rose-100 shrink-0 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Retry Loading
          </Button>
        </div>
      )}

      {/* CARD 1: PURCHASE DETAILS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Building2 className="w-5 h-5 text-emerald-600" />
          <h2 className="font-semibold text-slate-900">Purchase Details</h2>
        </div>

        {/* Client-Requested Feature: Explicit Purchase Type Selector */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Purchase Item Type <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Filter catalog and activate specific intake workflow: IMEI-serialized phones vs variant parts & accessories
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Active: {purchaseType === "PHONE" ? "Phone (IMEI Tracking)" : purchaseType === "SPARE_PART" ? "Display / Spare Part" : purchaseType === "GADGET" ? "Gadget" : purchaseType === "ACCESSORY" ? "Accessory" : "All Types"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {[
              { id: "ALL", label: "All Items", icon: Package, desc: "All catalog items" },
              { id: "PHONE", label: "Phone", icon: Smartphone, desc: "IMEI serialized flow" },
              { id: "SPARE_PART", label: "Display / Spare Part", icon: Layers, desc: "Panels, batteries, flex" },
              { id: "GADGET", label: "Gadget", icon: Headphones, desc: "AirPods, audio, watches" },
              { id: "ACCESSORY", label: "Accessory", icon: Sparkles, desc: "Cables, chargers, cases" },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = purchaseType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPurchaseType(t.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                    isSelected
                      ? "bg-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20 text-emerald-900"
                      : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-600" : "text-slate-400"}`} />
                    <span>{t.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight truncate">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Supplier Selection + Quick Add Button */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Supplier <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <SearchableSelect
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                  secondaryText: `${s.companyName ? `(${s.companyName}) ` : ""}${s.phone || ""}`.trim(),
                }))}
                value={selectedSupplierId}
                onChange={(val) => setSelectedSupplierId(val)}
                placeholder="Select Supplier..."
                searchPlaceholder="Search supplier name, company, or phone..."
                required
                className="flex-1"
              />

              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(true)}
                title="Quick Add Supplier"
                className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {currentSupplier && (
              <div className="mt-2 text-xs flex items-center justify-between text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="truncate">Address: {currentSupplier.address || "N/A"}</span>
                <span className="font-semibold text-emerald-700 whitespace-nowrap ml-1">
                  Advance: ৳{availableAdvanceBalance.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Receiving Branch */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Receiving Branch <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={userBranches.map((b) => ({
                value: b.id,
                label: `${b.name}${b.code ? ` (${b.code})` : ""}${b.isHeadquarters ? " ★ HQ" : ""}`,
              }))}
              value={purchaseBranchId}
              onChange={(val) => setPurchaseBranchId(val)}
              placeholder={isSingleBranchLocked ? (userBranches[0]?.name || "Receiving Branch") : "Select Receiving Branch..."}
              disabled={isSingleBranchLocked}
              required
              className="w-full"
            />
          </div>

          {/* Invoice Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Invoice Number <span className="text-red-500">*</span>
            </label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2026-0891"
              className="h-11 rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Purchase Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Purchase Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="h-11 rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Row 2: Document Upload & Internal Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Purchase Document Drop Zone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Purchase Document (JPG, PNG, PDF — Max 5MB)
            </label>
            <label
              htmlFor="purchase-doc-upload"
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50/80 hover:border-emerald-400 transition-all text-center group"
            >
              <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 mb-1 transition-colors" />
              <p className="text-xs font-medium text-slate-700">
                {documentPreviewName ? (
                  <span className="text-emerald-600 font-semibold">{documentPreviewName}</span>
                ) : (
                  <>
                    <span className="text-emerald-600 underline">Drop file here</span> or Browse
                  </>
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Attach physical receipt or invoice copy</p>
              <input
                id="purchase-doc-upload"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("File exceeds 5MB maximum limit");
                      return;
                    }
                    setPurchaseDocument(file);
                    setDocumentPreviewName(file.name);
                  }
                }}
              />
            </label>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Internal Notes
            </label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Any specific remarks about this purchase, intake location, or supplier terms..."
              rows={3}
              className="rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none text-xs"
            />
          </div>
        </div>
      </div>

      {/* CARD 2: BRANCH CATALOG (SHARED PRODUCT CATALOG GRID PATTERN) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">Branch Catalog</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">
              Click item to configure buying & selling price
            </span>
          </div>

          {/* Search + Brand Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search product or SKU..."
                className="pl-9 h-10 rounded-xl border-slate-200 text-xs"
              />
            </div>
            <Input
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              placeholder="Filter brand..."
              className="w-36 h-10 rounded-xl border-slate-200 text-xs hidden md:block"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedCategorySlug("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategorySlug === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategorySlug(c.slug)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategorySlug === c.slug
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 pt-1">
          {filteredProducts.slice(0, 18).map((product) => {
            const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
            const hasVariants = product.variants && product.variants.length > 0;
            const mainImg = product.images?.[0]?.url;

            return (
              <div
                key={product.id}
                onClick={() => handleOpenProductModal(product)}
                className="group relative border border-slate-200/80 hover:border-emerald-500 rounded-xl p-3 bg-white hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-full h-24 bg-slate-50 rounded-lg relative overflow-hidden mb-2.5 border border-slate-100">
                    {mainImg ? (
                      <Image
                        src={getImageUrl(mainImg)}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-contain p-1 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    <span
                      className={`absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        totalStock > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      Stock: {totalStock}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 mb-1 group-hover:text-emerald-600 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-2">
                    {product.category?.name || "General"}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    ৳{Number(product.regularPrice || 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium group-hover:underline">
                    + Intake
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs">
            No products match the selected criteria.
          </div>
        )}
      </div>

      {/* CARD 3: SHIPMENT LINE ITEMS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">Shipment Line Items</h2>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="px-3 py-1 bg-slate-100 rounded-lg font-medium text-slate-700">
              Total Items: <strong className="text-slate-900">{lineItems.length}</strong>
            </span>
            <span className="px-3 py-1 bg-slate-100 rounded-lg font-medium text-slate-700">
              Total Qty: <strong className="text-slate-900">{totalQuantity}</strong>
            </span>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-semibold border border-emerald-200">
              Total Cost: ৳{subtotal.toLocaleString()}
            </span>
          </div>
        </div>

        {lineItems.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-2">
            <Package className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No items added to this shipment yet</p>
            <p className="text-xs text-slate-400">Click any product card above to configure buying price and quantity</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-3.5">Specification</th>
                  <th className="py-3 px-3 w-24">Qnty</th>
                  <th className="py-3 px-3 w-28">Buying (Cost)</th>
                  <th className="py-3 px-3 w-28">Selling</th>
                  <th className="py-3 px-3 w-28">Wholesale</th>
                  <th className="py-3 px-3 w-28">Offer</th>
                  <th className="py-3 px-3 w-32 text-right">Total Cost</th>
                  <th className="py-3 px-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineItems.map((item, idx) => (
                  <tr key={item.key} className="hover:bg-slate-50/60 transition-colors">
                    {/* Specification */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 relative overflow-hidden flex-shrink-0 border border-slate-200">
                          {item.productImage ? (
                            <Image
                              src={getImageUrl(item.productImage)}
                              alt={item.productName}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 m-auto text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{item.productName}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.variantSku || "Base"} {item.color ? `• ${item.color}` : ""} {item.quality ? `• ${item.quality}` : ""}
                          </p>
                          {item.isPhone && item.phoneUnits && item.phoneUnits.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.phoneUnits.map((u, uIdx) => (
                                <span
                                  key={uIdx}
                                  className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-mono font-semibold"
                                >
                                  IMEI: {u.imei1} {u.imei2 ? `/ ${u.imei2}` : ""} ({u.condition || "NEW"})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3">
                      {item.isPhone ? (
                        <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold whitespace-nowrap">
                          {item.quantityOrdered} Units
                        </span>
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          value={item.quantityOrdered}
                          onChange={(e) => updateLineItem(idx, "quantityOrdered", Math.max(1, Number(e.target.value)))}
                          className="h-8 w-20 rounded-lg border-slate-200 text-xs text-center font-bold"
                        />
                      )}
                    </td>

                    {/* Buying */}
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        min={0}
                        value={item.unitCost}
                        onChange={(e) => updateLineItem(idx, "unitCost", Math.max(0, Number(e.target.value)))}
                        className="h-8 rounded-lg border-slate-200 text-xs font-semibold"
                      />
                    </td>

                    {/* Selling */}
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        min={0}
                        value={item.sellingPrice ?? ""}
                        placeholder="Optional"
                        onChange={(e) => updateLineItem(idx, "sellingPrice", Number(e.target.value) || 0)}
                        className="h-8 rounded-lg border-slate-200 text-xs"
                      />
                    </td>

                    {/* Wholesale */}
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        min={0}
                        value={item.wholesalePrice ?? ""}
                        placeholder="Optional"
                        onChange={(e) => updateLineItem(idx, "wholesalePrice", Number(e.target.value) || 0)}
                        className="h-8 rounded-lg border-slate-200 text-xs"
                      />
                    </td>

                    {/* Offer */}
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        min={0}
                        value={item.offerPrice ?? ""}
                        placeholder="Optional"
                        onChange={(e) => updateLineItem(idx, "offerPrice", Number(e.target.value) || 0)}
                        className="h-8 rounded-lg border-slate-200 text-xs"
                      />
                    </td>

                    {/* Total Cost */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      ৳{item.lineTotal.toLocaleString()}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: PAYMENT DETAILS (LEFT) & PURCHASE SUMMARY (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CARD 4: PAYMENT DETAILS (LEFT 7 COLS) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">Payment Details</h2>
          </div>

          {/* Supplier Advance Option */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="use-advance-checkbox"
                  checked={useAdvance}
                  onChange={(e) => {
                    setUseAdvance(e.target.checked);
                    if (e.target.checked && availableAdvanceBalance > 0) {
                      setAdvanceAmount(Math.min(availableAdvanceBalance, grandTotal));
                    }
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <label htmlFor="use-advance-checkbox" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Use Supplier Advance Balance
                </label>
              </div>

              <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                Available: ৳{availableAdvanceBalance.toLocaleString()}
              </span>
            </div>

            {useAdvance && (
              <div className="pt-2 border-t border-slate-200/60 flex items-center gap-3">
                <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Apply Advance:</span>
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">৳</span>
                  <Input
                    type="number"
                    min={0}
                    max={availableAdvanceBalance}
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(Math.max(0, Number(e.target.value)))}
                    className="h-9 pl-7 rounded-xl border-slate-200 text-xs font-bold text-emerald-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Multi-Wallet Payments Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Wallet Payments
              </label>
              <button
                type="button"
                onClick={handleAddWalletRow}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Payment Row
              </button>
            </div>

            {walletPayments.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                No wallet payment allocated. You can complete this intake as fully due or add wallet payments above.
              </div>
            ) : (
              <div className="space-y-2.5">
                {walletPayments.map((wp) => {
                  const selectedW = wallets.find((w) => w.id === wp.walletTypeId);
                  return (
                    <div
                      key={wp.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50"
                    >
                      {/* Wallet Select */}
                      <div className="flex-1">
                        <select
                          value={wp.walletTypeId}
                          onChange={(e) => handleWalletChange(wp.id, "walletTypeId", e.target.value)}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                          {wallets.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} (Bal: ৳{Number(w.currentBalance).toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Amount Input */}
                      <div className="w-40 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">৳</span>
                        <Input
                          type="number"
                          min={0}
                          value={wp.amount || ""}
                          placeholder="Amount"
                          onChange={(e) =>
                            handleWalletChange(wp.id, "amount", Math.max(0, Number(e.target.value)))
                          }
                          className="h-9 pl-6 rounded-lg border-slate-200 text-xs font-bold"
                        />
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveWalletRow(wp.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Payment Remarks
            </label>
            <Input
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="e.g. Check / Transaction reference numbers..."
              className="h-10 rounded-xl border-slate-200 text-xs"
            />
          </div>
        </div>

        {/* CARD 5: PURCHASE SUMMARY (RIGHT 5 COLS) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-slate-900">Purchase Summary</h2>
            </div>

            {/* Subtotal */}
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal ({totalQuantity} units)</span>
              <span className="font-semibold text-slate-900">৳{subtotal.toLocaleString()}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Discount</span>
              <div className="w-28 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">৳</span>
                <Input
                  type="number"
                  min={0}
                  value={discount || ""}
                  placeholder="0"
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="h-8 pl-6 rounded-lg border-slate-200 text-xs text-right font-medium"
                />
              </div>
            </div>

            {/* Shipping & Tax */}
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Shipping Cost</span>
              <div className="w-28 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">৳</span>
                <Input
                  type="number"
                  min={0}
                  value={shippingCost || ""}
                  placeholder="0"
                  onChange={(e) => setShippingCost(Math.max(0, Number(e.target.value)))}
                  className="h-8 pl-6 rounded-lg border-slate-200 text-xs text-right font-medium"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-bold text-slate-900">
              <span>Grand Total</span>
              <span className="text-base text-emerald-700">৳{grandTotal.toLocaleString()}</span>
            </div>

            {/* Breakdown of Payments */}
            <div className="pt-2 space-y-1.5 text-xs text-slate-600 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Wallet Payments:</span>
                <span className="font-medium text-slate-900">৳{walletPaymentsSum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Advance Used:</span>
                <span className="font-medium text-emerald-700">৳{effectiveAdvanceUsed.toLocaleString()}</span>
              </div>
            </div>

            {/* Highlighted Unpaid Amount (Balance Due) */}
            <div className="p-4 rounded-xl bg-red-50/80 border border-red-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-900 uppercase tracking-wider">Unpaid Amount</span>
                <span className="text-lg font-black text-red-600">৳{unpaidAmount.toLocaleString()}</span>
              </div>
              <p className="text-[11px] text-red-500 font-medium">Balance due for this intake</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-4">
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmitPurchase("RECEIVED")}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Purchase
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleSubmitPurchase("DRAFT")}
              className="w-full h-10 rounded-xl border-amber-300 bg-amber-50/50 text-amber-800 hover:bg-amber-100 font-medium"
            >
              ⬇ Save Draft
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL 1: QUICK ADD SUPPLIER DIALOG */}
      <Dialog open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Quick Add Supplier
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSupplier} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="e.g. Eastern Gadget Distribution"
                className="h-10 rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
                <Input
                  value={newSupplier.companyName}
                  onChange={(e) => setNewSupplier({ ...newSupplier, companyName: e.target.value })}
                  placeholder="e.g. Eastern Corp"
                  className="h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  placeholder="017xxxxxxxx"
                  className="h-10 rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location / Address <span className="text-red-500">*</span>
              </label>
              <Input
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                placeholder="e.g. Motijheel C/A, Dhaka"
                className="h-10 rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Products Category</label>
                <Input
                  value={newSupplier.productsCategory}
                  onChange={(e) => setNewSupplier({ ...newSupplier, productsCategory: e.target.value })}
                  placeholder="e.g. Displays, Motherboards"
                  className="h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Credit / Advance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">৳</span>
                  <Input
                    type="number"
                    min={0}
                    value={newSupplier.advanceBalance || ""}
                    placeholder="0"
                    onChange={(e) => setNewSupplier({ ...newSupplier, advanceBalance: Number(e.target.value) })}
                    className="h-10 pl-7 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSupplierModalOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Save Supplier
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CONFIGURE PRODUCT PRICING & INTAKE MODAL */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent
          className={`rounded-2xl p-6 transition-all ${
            isPhoneProduct(modalProduct) ? "sm:max-w-3xl max-h-[88vh] overflow-y-auto" : "sm:max-w-md"
          }`}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              {isPhoneProduct(modalProduct) ? "Configure Phone Intake (IMEI Serialized)" : "Configure Product Intake"}
            </DialogTitle>
          </DialogHeader>

          {modalProduct && (
            <div className="space-y-4 pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white relative overflow-hidden flex-shrink-0 border border-slate-200">
                  {modalProduct.images?.[0]?.url ? (
                    <Image
                      src={getImageUrl(modalProduct.images[0].url)}
                      alt={modalProduct.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 m-auto text-slate-300" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{modalProduct.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    Category: {modalProduct.category?.name || "General"}
                    {isPhoneProduct(modalProduct) && (
                      <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-bold text-[10px]">
                        Phone Unit Mode
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Color Pill Buttons */}
              {modalColors.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Color <span className="text-slate-400 font-normal">({modalColors.length} options)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {modalColors.map((color) => {
                      const isSelected = modalSelectedColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleSelectColorPill(color)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-500 font-semibold shadow-sm ring-1 ring-emerald-500/20"
                              : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quality Pill Buttons */}
              {modalQualities.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Quality <span className="text-slate-400 font-normal">({modalQualities.length} options)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {modalQualities.map((quality) => {
                      const isSelected = modalSelectedQuality === quality;
                      return (
                        <button
                          key={quality}
                          type="button"
                          onClick={() => handleSelectQualityPill(quality)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-500 font-semibold shadow-sm ring-1 ring-emerald-500/20"
                              : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {quality}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fallback Variant Selector if no explicit color/quality pills */}
              {modalColors.length === 0 && modalQualities.length === 0 && modalProduct.variants && modalProduct.variants.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Variant</label>
                  <select
                    value={modalVariantId}
                    onChange={(e) => {
                      const vid = e.target.value;
                      setModalVariantId(vid);
                      const v = modalProduct.variants.find((item) => item.id === vid);
                      if (v) {
                        if (v.buyingPrice !== undefined && v.buyingPrice !== null) {
                          setModalBuyingPrice(Number(v.buyingPrice));
                        }
                        setModalSellingPrice(String(v.price || modalProduct.regularPrice || ""));
                        setModalWholesalePrice(v.wholesalePrice ? String(v.wholesalePrice) : "");
                        if (v.offerPrice || v.discountedPrice) {
                          setModalOfferPrice(String(v.offerPrice || v.discountedPrice));
                        }
                      }
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800"
                  >
                    {modalProduct.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sku} {v.color ? `• ${v.color}` : ""} {v.quality ? `• ${v.quality}` : ""} (Current Stock: {v.stock})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* PHONE INTAKE SECTION (Serialized Unit-by-Unit with Real-Time IMEI Check) */}
              {isPhoneProduct(modalProduct) ? (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                        Phone Units & IMEI Configuration
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Every phone is tracked by a unique IMEI. Real-time system check verifies uniqueness.
                      </p>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                      <span className="text-[11px] font-bold text-slate-600 px-2">Units:</span>
                      <button
                        type="button"
                        onClick={() => handleModalQuantityChange(Math.max(1, modalQuantity - 1))}
                        disabled={modalQuantity <= 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-800">{modalQuantity}</span>
                      <button
                        type="button"
                        onClick={() => handleModalQuantityChange(modalQuantity + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Units List */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {modalPhoneUnits.map((unit, uIdx) => (
                      <div
                        key={uIdx}
                        className="p-3 bg-purple-50/40 border border-purple-200/80 rounded-xl space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between pb-1 border-b border-purple-100">
                          <span className="font-bold text-purple-900 text-xs flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-purple-700 text-white flex items-center justify-center text-[10px]">
                              {uIdx + 1}
                            </span>
                            Device #{uIdx + 1}
                          </span>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-semibold">Condition:</span>
                            <select
                              value={unit.condition || "NEW"}
                              onChange={(e) => updateModalPhoneUnit(uIdx, "condition", e.target.value)}
                              className="h-7 px-2 bg-white border border-purple-200 rounded-md text-[11px] font-bold text-slate-700"
                            >
                              <option value="NEW">NEW</option>
                              <option value="USED">USED</option>
                            </select>
                          </div>
                        </div>

                        {/* IMEI 1 & IMEI 2 with Real-Time Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-bold text-slate-700">
                                IMEI 1 <span className="text-red-500">*</span>
                              </label>
                              {unit.imei1Status === "checking" && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  ⏳ Checking...
                                </span>
                              )}
                              {unit.imei1Status === "duplicate" && (
                                <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-300 font-bold">
                                  ❌ Already Exists
                                </span>
                              )}
                              {unit.imei1Status === "valid" && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">
                                  ✅ New IMEI
                                </span>
                              )}
                            </div>
                            <Input
                              placeholder="15-digit IMEI 1..."
                              value={unit.imei1}
                              onChange={(e) => {
                                updateModalPhoneUnit(uIdx, "imei1", e.target.value);
                                checkImeiDebounced(uIdx, "imei1", e.target.value);
                              }}
                              className={`h-9 text-xs font-mono bg-white ${
                                unit.imei1Status === "duplicate"
                                  ? "border-rose-500 ring-1 ring-rose-500"
                                  : unit.imei1Status === "valid"
                                  ? "border-emerald-500 ring-1 ring-emerald-500"
                                  : ""
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-semibold text-slate-700">
                                IMEI 2 <span className="text-slate-400 font-normal">(Optional)</span>
                              </label>
                              {unit.imei2Status === "checking" && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  ⏳ Checking...
                                </span>
                              )}
                              {unit.imei2Status === "duplicate" && (
                                <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-300 font-bold">
                                  ❌ Already Exists
                                </span>
                              )}
                              {unit.imei2Status === "valid" && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">
                                  ✅ New IMEI
                                </span>
                              )}
                            </div>
                            <Input
                              placeholder="15-digit IMEI 2..."
                              value={unit.imei2 || ""}
                              onChange={(e) => {
                                updateModalPhoneUnit(uIdx, "imei2", e.target.value);
                                checkImeiDebounced(uIdx, "imei2", e.target.value);
                              }}
                              className={`h-9 text-xs font-mono bg-white ${
                                unit.imei2Status === "duplicate"
                                  ? "border-rose-500 ring-1 ring-rose-500"
                                  : unit.imei2Status === "valid"
                                  ? "border-emerald-500 ring-1 ring-emerald-500"
                                  : ""
                              }`}
                            />
                          </div>
                        </div>

                        {/* Serial Number & Warranty Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Serial Number</label>
                            <Input
                              placeholder="Optional S/N"
                              value={unit.serialNumber || ""}
                              onChange={(e) => updateModalPhoneUnit(uIdx, "serialNumber", e.target.value)}
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Warranty Type</label>
                            <select
                              value={unit.warrantyType || "1 Year Official Warranty"}
                              onChange={(e) => updateModalPhoneUnit(uIdx, "warrantyType", e.target.value)}
                              className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs"
                            >
                              <option value="1 Year Official Warranty">1 Year Official Warranty</option>
                              <option value="6 Months Warranty">6 Months Warranty</option>
                              <option value="1 Month Shop Warranty">1 Month Shop Warranty</option>
                              <option value="7 Days Replacement">7 Days Replacement</option>
                              <option value="No Warranty">No Warranty</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Warranty Period</label>
                            <select
                              value={unit.warrantyPeriod || "365 Days / 1 Year"}
                              onChange={(e) => updateModalPhoneUnit(uIdx, "warrantyPeriod", e.target.value)}
                              className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs"
                            >
                              <option value="365 Days / 1 Year">365 Days / 1 Year</option>
                              <option value="180 Days / 6 Months">180 Days / 6 Months</option>
                              <option value="30 Days / 1 Month">30 Days / 1 Month</option>
                              <option value="7 Days">7 Days</option>
                              <option value="None">None</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Warning banner if any duplicate exists */}
                  {modalPhoneUnits.some(
                    (u) => u.imei1Status === "duplicate" || u.imei2Status === "duplicate"
                  ) && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <p className="font-bold">
                        Duplicate IMEI Detected: Two phones cannot share an IMEI in the system. Please resolve red fields to proceed.
                      </p>
                    </div>
                  )}

                  {/* Pricing Inputs for Phone */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Buying (Cost) Price per Unit <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">৳</span>
                        <Input
                          type="number"
                          min={0}
                          value={modalBuyingPrice}
                          onChange={(e) => setModalBuyingPrice(Math.max(0, Number(e.target.value)))}
                          className="h-10 pl-7 rounded-xl font-bold text-emerald-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price per Unit</label>
                      <Input
                        type="number"
                        min={0}
                        value={modalSellingPrice}
                        placeholder="Expected retail"
                        onChange={(e) => setModalSellingPrice(e.target.value)}
                        className="h-10 rounded-xl font-semibold text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD QUANTITY & PRICING FOR SPARE PARTS/ACCESSORIES */
                <>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Intake Quantity <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => setModalQuantity((prev) => Math.max(1, prev - 1))}
                          disabled={modalQuantity <= 1}
                          className="w-10 h-10 flex items-center justify-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-bold transition-colors"
                        >
                          −
                        </button>
                        <Input
                          type="number"
                          min={1}
                          value={modalQuantity}
                          onChange={(e) => setModalQuantity(Math.max(1, Number(e.target.value)))}
                          className="h-10 w-20 rounded-none border-slate-200 font-bold text-center focus:ring-0 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setModalQuantity((prev) => prev + 1)}
                          className="w-10 h-10 flex items-center justify-center rounded-r-xl border border-l-0 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-lg font-bold transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Buying (Cost) Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">৳</span>
                        <Input
                          type="number"
                          min={0}
                          value={modalBuyingPrice}
                          onChange={(e) => setModalBuyingPrice(Math.max(0, Number(e.target.value)))}
                          className="h-10 pl-7 rounded-xl font-bold text-emerald-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Optional Future Prices */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Selling Price</label>
                      <Input
                        type="number"
                        value={modalSellingPrice}
                        placeholder="Regular"
                        onChange={(e) => setModalSellingPrice(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Wholesale</label>
                      <Input
                        type="number"
                        value={modalWholesalePrice}
                        placeholder="Wholesale"
                        onChange={(e) => setModalWholesalePrice(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Offer Price</label>
                      <Input
                        type="number"
                        value={modalOfferPrice}
                        placeholder="Sale"
                        onChange={(e) => setModalOfferPrice(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Live Preview of Total */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                <span className="text-emerald-900 font-medium">Estimated Line Total:</span>
                <span className="text-base font-bold text-emerald-800">
                  ৳{(modalQuantity * modalBuyingPrice).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    isPhoneProduct(modalProduct) &&
                    (modalPhoneUnits.length === 0 ||
                      modalPhoneUnits.some(
                        (u) => !u.imei1.trim() || u.imei1Status === "duplicate" || u.imei2Status === "duplicate"
                      ))
                  }
                  onClick={handleAddLineItem}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium shadow-sm shadow-emerald-600/20"
                >
                  🛒 Add to Purchase
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
