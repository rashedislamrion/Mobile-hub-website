"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import {
  Save,
  RotateCcw,
  Plus,
  Trash2,
  UploadCloud,
  X,
  Info,
  Layers,
  Sparkles,
  Package,
  Search,
  CheckCircle2,
  Tag,
  Eye,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost, apiPatch, getImageUrl } from "@/lib/api-client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useStaffAuth } from "@/context/AuthContext";
import { CategoryCheckboxTree } from "./CategoryCheckboxTree";
import { VariationsGenerator, GeneratedVariant } from "./VariationsGenerator";

const formSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  slug: z.string().optional(),
  code: z.string().optional(),
  brandId: z.string().optional(),
  seriesId: z.string().optional(),
  unitId: z.string().optional(),
  productType: z.string().default("Spare Parts"),
  condition: z.enum(["NEW", "USED"]).optional().nullable(),
  buyingPrice: z.coerce.number().min(0).default(0),
  regularPrice: z.coerce.number().min(0, "Selling price is required").default(0),
  salePrice: z.coerce.number().optional().nullable(),
  wholesalePrice: z.coerce.number().min(0).default(0),
  minOrderQty: z.coerce.number().min(1).default(1),
  isHomepage: z.boolean().default(false),
  isNewest: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isBestDeal: z.boolean().default(false),
  status: z.enum(["DRAFT", "ACTIVE", "OUT_OF_STOCK"]).default("ACTIVE"),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  warranty: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional(),
  ogImageUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface ExistingProductData {
  id: string;
  code?: string | null;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  regularPrice: number | string;
  salePrice?: number | string | null;
  costPrice?: number | string | null;
  buyingPrice?: number | string | null;
  wholesalePrice?: number | string | null;
  minOrderQty?: number | null;
  warranty?: string | null;
  productType?: string | null;
  condition?: string | null;
  isHomepage?: boolean;
  isNewest?: boolean;
  isFeatured?: boolean;
  isBestDeal?: boolean;
  status: "DRAFT" | "ACTIVE" | "OUT_OF_STOCK";
  categoryId: string;
  brandId?: string | null;
  seriesId?: string | null;
  unitId?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  ogImageUrl?: string | null;
  images?: Array<{ id: string; url: string; sortOrder?: number }>;
  variants?: Array<{
    id?: string;
    color?: string | null;
    quality?: string | null;
    price: number | string;
    stock: number;
    sku?: string;
    buyingPrice?: number | string | null;
    wholesalePrice?: number | string | null;
    offerPrice?: number | string | null;
    attributes?: any;
  }>;
  specifications?: Array<{ id?: string; label: string; value: string }>;
}

interface ProductFormProps {
  initialData?: ExistingProductData | null;
  isEdit?: boolean;
  productId?: string;
}

type TabKey = "product-info" | "general-info" | "variations" | "add-ons" | "seo";

export function ProductForm({ initialData, isEdit, productId }: ProductFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("product-info");

  // Metadata dropdowns
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [seriesList, setSeriesList] = useState<Array<{ id: string; name: string; brandId?: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; name: string; shortCode?: string }>>([]);

  // Category selection
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    Array.isArray((initialData as any)?.categoryIds) && (initialData as any).categoryIds.length > 0
      ? (initialData as any).categoryIds
      : initialData?.categoryId
        ? [initialData.categoryId]
        : []
  );

  // Variations
  const [variants, setVariants] = useState<GeneratedVariant[]>(
    initialData?.variants?.map((v) => ({
      id: v.id,
      sku: v.sku || "",
      color: v.color || null,
      quality: v.quality || null,
      attributes: typeof v.attributes === "object" && v.attributes !== null ? v.attributes : {},
      buyingPrice: Number(v.buyingPrice || initialData.buyingPrice || 0),
      price: Number(v.price || initialData.regularPrice || 0),
      wholesalePrice: Number(v.wholesalePrice || initialData.wholesalePrice || 0),
      offerPrice: v.offerPrice ? Number(v.offerPrice) : null,
      stock: Number(v.stock || 0),
    })) || []
  );

  // Specifications
  const [specifications, setSpecifications] = useState<Array<{ label: string; value: string }>>(
    initialData?.specifications?.map((s) => ({ label: s.label, value: s.value })) || []
  );

  // Optional Add-ons
  const [addOns, setAddOns] = useState<Array<{ title: string; price: number; note: string }>>([]);

  // Images state
  const [existingImages, setExistingImages] = useState<Array<{ id: string; url: string }>>(
    initialData?.images || []
  );
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useStaffAuth();
  const draftKey = `novamobile_draft_product_${user?.id || "staff"}_${isEdit ? initialData?.id || "edit" : "new"}`;
  const [savedDraft, setSavedDraft] = useState<any | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  // Check for unsaved draft on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.savedAt && (Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000)) {
          setSavedDraft(parsed);
          setShowDraftPrompt(true);
        }
      }
    } catch {
      // ignore
    }
  }, [draftKey]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: initialData?.name || "",
      slug: initialData?.slug || "",
      code: initialData?.code || "",
      brandId: initialData?.brandId || "",
      seriesId: initialData?.seriesId || "",
      unitId: initialData?.unitId || "",
      productType: initialData?.productType || "Spare Parts",
      condition: (initialData?.condition as "NEW" | "USED") || "NEW",
      buyingPrice: Number(initialData?.buyingPrice || 0),
      regularPrice: Number(initialData?.regularPrice || 0),
      salePrice: initialData?.salePrice ? Number(initialData.salePrice) : null,
      wholesalePrice: Number(initialData?.wholesalePrice || 0),
      minOrderQty: Number(initialData?.minOrderQty || 1),
      isHomepage: initialData?.isHomepage ?? false,
      isNewest: initialData?.isNewest ?? false,
      isFeatured: initialData?.isFeatured ?? false,
      isBestDeal: initialData?.isBestDeal ?? false,
      status: initialData?.status || "ACTIVE",
      shortDescription: initialData?.shortDescription || "",
      description: initialData?.description || "",
      warranty: initialData?.warranty || "",
      metaTitle: initialData?.metaTitle || "",
      metaDescription: initialData?.metaDescription || "",
      metaKeywords: initialData?.metaKeywords || "",
      ogImageUrl: initialData?.ogImageUrl || "",
    },
  });

  // Restore Draft
  const handleRestoreDraft = () => {
    if (!savedDraft) return;
    if (savedDraft.values) {
      form.reset(savedDraft.values);
    }
    if (Array.isArray(savedDraft.variants)) {
      setVariants(savedDraft.variants);
    }
    if (Array.isArray(savedDraft.specifications)) {
      setSpecifications(savedDraft.specifications);
    }
    if (Array.isArray(savedDraft.addOns)) {
      setAddOns(savedDraft.addOns);
    }
    if (Array.isArray(savedDraft.selectedCategoryIds)) {
      setSelectedCategoryIds(savedDraft.selectedCategoryIds);
    }
    setShowDraftPrompt(false);
    toast.success("Unsaved draft restored successfully");
  };

  const handleDiscardDraft = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(draftKey);
    }
    setSavedDraft(null);
    setShowDraftPrompt(false);
    toast.info("Draft discarded");
  };

  // Auto-save in-progress draft (excluding files)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      const values = form.getValues();
      const isDirty = form.formState.isDirty || variants.length > 0 || addOns.length > 0;
      if (isDirty) {
        const payload = {
          savedAt: Date.now(),
          values,
          variants,
          specifications,
          addOns,
          selectedCategoryIds,
        };
        sessionStorage.setItem(draftKey, JSON.stringify(payload));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [form.watch(), variants, specifications, addOns, selectedCategoryIds, draftKey]);

  // beforeunload safeguard when dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty || variants.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.formState.isDirty, variants.length]);

  const handleResetForm = () => {
    form.reset();
    setVariants([]);
    setSpecifications([]);
    setAddOns([]);
    if (!isEdit) {
      setSelectedCategoryIds([]);
    }
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(draftKey);
    }
    toast.info("Form reset to default state");
  };

  const selectedBrandId = form.watch("brandId");
  const watchName = form.watch("name");
  const watchBuyingPrice = form.watch("buyingPrice");
  const watchSellingPrice = form.watch("regularPrice");
  const watchWholesalePrice = form.watch("wholesalePrice");
  const watchCode = form.watch("code");
  const watchProductType = form.watch("productType");
  const watchCondition = form.watch("condition") || "NEW";
  const selectedBrandName = brands.find((b) => b.id === selectedBrandId)?.name || "";

  // Load brands, series, units
  useEffect(() => {
    (async () => {
      try {
        const [brs, srs, uns] = await Promise.all([
          apiGet<any[]>("/products/brands").catch(() => apiGet<any[]>("/brands")),
          apiGet<any[]>("/series").catch(() => []),
          apiGet<any[]>("/products/units").catch(() => apiGet<any[]>("/units")),
        ]);
        if (Array.isArray(brs)) setBrands(brs);
        if (Array.isArray(srs)) setSeriesList(srs);
        if (Array.isArray(uns)) setUnits(uns);
      } catch (err) {
        console.error("Failed to load metadata:", err);
      }
    })();
  }, []);

  // Filter series by brand
  const filteredSeries = selectedBrandId
    ? seriesList.filter((s) => s.brandId === selectedBrandId)
    : seriesList;

  // Auto-fill slug if empty
  const handleNameBlur = () => {
    const currentSlug = form.getValues("slug");
    if (!currentSlug && watchName) {
      const generated = watchName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      form.setValue("slug", generated);
    }
  };

  // Generate random SKU code
  const handleGenerateCode = (e: React.MouseEvent) => {
    e.preventDefault();
    const random = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
    form.setValue("code", random);
  };

  // Image handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setNewImageFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeExistingImage = (id: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== id));
    setRemovedImageIds((prev) => [...prev, id]);
  };

  const removeNewFile = (index: number) => {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Form submit handler
  const onSubmit = async (values: FormValues) => {
    if (selectedCategoryIds.length === 0) {
      setActiveTab("product-info");
      toast.error("Please select at least one Category from the tree.");
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();

      formData.append("name", values.name);
      formData.append("slug", values.slug || values.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
      if (values.code) formData.append("code", values.code);
      formData.append("categoryId", selectedCategoryIds[0]);
      formData.append("categoryIds", JSON.stringify(selectedCategoryIds));

      if (values.brandId) formData.append("brandId", values.brandId);
      if (values.seriesId) formData.append("seriesId", values.seriesId);
      if (values.unitId) formData.append("unitId", values.unitId);
      formData.append("productType", values.productType);
      if (values.condition) formData.append("condition", values.condition);

      formData.append("buyingPrice", String(values.buyingPrice || 0));
      formData.append("regularPrice", String(values.regularPrice || 0));
      if (values.salePrice) formData.append("salePrice", String(values.salePrice));
      formData.append("wholesalePrice", String(values.wholesalePrice || 0));
      formData.append("minOrderQty", String(values.minOrderQty || 1));

      formData.append("isHomepage", String(values.isHomepage));
      formData.append("isNewest", String(values.isNewest));
      formData.append("isFeatured", String(values.isFeatured));
      formData.append("isBestDeal", String(values.isBestDeal));
      formData.append("status", values.status);

      if (values.shortDescription) formData.append("shortDescription", values.shortDescription);
      if (values.description) formData.append("description", values.description);
      if (values.warranty) formData.append("warranty", values.warranty);

      if (values.metaTitle) formData.append("metaTitle", values.metaTitle);
      if (values.metaDescription) formData.append("metaDescription", values.metaDescription);
      if (values.metaKeywords) formData.append("metaKeywords", values.metaKeywords);
      if (values.ogImageUrl) formData.append("ogImageUrl", values.ogImageUrl);

      // Add variants
      formData.append("variants", JSON.stringify(variants));

      // Add specifications
      formData.append("specifications", JSON.stringify(specifications));

      // Add new image files
      newImageFiles.forEach((file) => {
        formData.append("images", file);
      });

      // Add removed image IDs if edit
      if (isEdit && removedImageIds.length > 0) {
        formData.append("removedImageIds", JSON.stringify(removedImageIds));
      }

      if (isEdit && productId) {
        await apiPatch(`/products/${productId}`, formData);
        toast.success("Product updated successfully!");
      } else {
        await apiPost("/products", formData);
        toast.success("Product created successfully!");
      }

      // Clear draft on successful save
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(draftKey);
        fetch("/api/revalidate?path=/").catch(() => {});
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err: any) {
      console.error("Save product error:", err);
      toast.error(err.message || "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "product-info", label: "Product Info" },
    { key: "general-info", label: "General Information" },
    { key: "variations", label: "Variations" },
    { key: "add-ons", label: "Optional Add-ons" },
    { key: "seo", label: "SEO Information" },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24">
        {/* Unsaved Draft Restore Banner */}
        {showDraftPrompt && savedDraft && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">Restore unsaved draft?</h4>
                <p className="text-xs text-amber-700">
                  You have an unsaved draft from {new Date(savedDraft.savedAt).toLocaleTimeString()}. Would you like to restore your progress?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleRestoreDraft}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 cursor-pointer"
              >
                Restore Draft
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDiscardDraft}
                className="border-slate-300 text-slate-700 text-xs h-8 cursor-pointer"
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        {/* Pill-style Tab Bar */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl max-w-fit border border-slate-200 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Product Info */}
        <div className={activeTab === "product-info" ? "block" : "hidden"}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left / Main Column */}
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  Basic Product Information
                </h3>

                {/* Product Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-700">
                        Product Name <span className="text-rose-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Samsung Galaxy S23 Ultra OLED Display with Frame"
                          className="h-10 text-sm"
                          {...field}
                          onBlur={handleNameBlur}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* Product Slug */}
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-700">
                        Product Slug
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="auto-generated-from-product-name"
                          className="h-10 text-sm font-mono text-slate-600"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* Brand & Series */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brandId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Select Brand
                        </FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={brands.map((b) => ({ value: b.id, label: b.name }))}
                            value={field.value || ""}
                            onChange={(val) => {
                              field.onChange(val);
                              form.setValue("seriesId", "");
                            }}
                            placeholder="Select Brand..."
                            searchPlaceholder="Search brand (e.g. Oppo, Apple)..."
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="seriesId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Select Series
                        </FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={filteredSeries.map((s) => ({ value: s.id, label: s.name }))}
                            value={field.value || ""}
                            onChange={field.onChange}
                            disabled={!selectedBrandId || filteredSeries.length === 0}
                            placeholder={
                              !selectedBrandId
                                ? "Select brand first"
                                : filteredSeries.length === 0
                                ? "No series available"
                                : "Select Series..."
                            }
                            searchPlaceholder="Search series..."
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Unit & Product SKU / Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="unitId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Select Unit
                        </FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={units.map((u) => ({
                              value: u.id,
                              label: u.name,
                              secondaryText: u.shortCode ? `(${u.shortCode})` : undefined,
                            }))}
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="Select Unit (Pcs, Box, Set)..."
                            searchPlaceholder="Search unit..."
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-xs font-semibold text-slate-700">
                            Product SKU / Code <span className="text-rose-500">*</span>
                          </FormLabel>
                          <button
                            type="button"
                            onClick={handleGenerateCode}
                            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                          >
                            Generate Code
                          </button>
                        </div>
                        <FormControl>
                          <Input
                            placeholder="e.g. SKU-847291"
                            className="h-10 text-sm font-mono"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Buying Price & Selling Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <FormField
                    control={form.control}
                    name="buyingPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Buying Price (৳)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="h-10 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="regularPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Selling Price (৳) <span className="text-rose-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="h-10 text-sm font-medium text-emerald-700"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Discounted / Sale Price & Wholesale Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="salePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Discounted / Offer Price (৳)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Optional discounted price"
                            className="h-10 text-sm"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="wholesalePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Wholesale Price (৳)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="h-10 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Min Order Qty / Homepage toggle / Product Type */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-2">
                  <FormField
                    control={form.control}
                    name="minOrderQty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Min Order Qty
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            className="h-10 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="productType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Product Type
                        </FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-sm">
                              <SelectValue placeholder="Type..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Phone">Mobile Phone (IMEI Tracked)</SelectItem>
                            <SelectItem value="Spare Parts">Spare Parts</SelectItem>
                            <SelectItem value="Gadgets">Gadgets</SelectItem>
                            <SelectItem value="Accessories">Accessories</SelectItem>
                            <SelectItem value="Tools">Repair Tools</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {watchProductType === "Phone" && (
                    <FormField
                      control={form.control}
                      name="condition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-slate-700">
                            Phone Condition <span className="text-rose-500">*</span>
                          </FormLabel>
                          <Select value={field.value || "NEW"} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="h-10 text-sm">
                                <SelectValue placeholder="Condition..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="NEW">New (Brand New / Sealed)</SelectItem>
                              <SelectItem value="USED">Used / Second-hand</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Catalog Status
                        </FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-sm">
                              <SelectValue placeholder="Status..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Active (Live on Storefront)</SelectItem>
                            <SelectItem value="DRAFT">Draft (Admin Only)</SelectItem>
                            <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isHomepage"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50 mt-5">
                        <div className="space-y-0.5">
                          <FormLabel className="text-xs font-semibold text-slate-700">
                            Show on Homepage
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Product Media Gallery */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  Product Images
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Existing Images */}
                  {existingImages.map((img) => (
                    <div key={img.id} className="relative group aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getImageUrl(img.url)} alt="Product" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(img.id)}
                        className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* New Uploads Preview */}
                  {newImageFiles.map((file, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg border border-emerald-300 overflow-hidden bg-emerald-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeNewFile(idx)}
                        className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Upload Box */}
                  <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-lg aspect-square flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/20">
                    <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-[11px] font-semibold text-slate-600">Upload Image</span>
                    <span className="text-[10px] text-slate-400">PNG, JPG up to 5MB</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Right Column: Category Checkbox Tree */}
            <div className="lg:col-span-4">
              <CategoryCheckboxTree
                selectedCategoryIds={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
              />
            </div>
          </div>
        </div>

        {/* Tab 2: General Information */}
        <div className={activeTab === "general-info" ? "block" : "hidden"}>
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              General Details & Description
            </h3>

            <FormField
              control={form.control}
              name="shortDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700">
                    Short Summary / Teaser
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Brief one-line product summary..."
                      className="h-10 text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700">
                    Full Description / Technical Specifications
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Write full product specs, compatible models, repair guide notes..."
                      className="text-sm leading-relaxed"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="warranty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700">
                    Warranty Policy / Coverage
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 7 Days Replacement / 6 Months Service Warranty"
                      className="h-10 text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Tab 3: Variations */}
        <div className={activeTab === "variations" ? "block" : "hidden"}>
          <VariationsGenerator
            baseSku={watchCode || "PROD"}
            defaultBuyingPrice={watchBuyingPrice}
            defaultSellingPrice={watchSellingPrice}
            defaultWholesalePrice={watchWholesalePrice}
            variants={variants}
            onChange={setVariants}
            productType={watchProductType}
            brandName={selectedBrandName}
            condition={watchCondition}
          />
        </div>

        {/* Tab 4: Optional Add-ons */}
        <div className={activeTab === "add-ons" ? "block" : "hidden"}>
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Optional Add-ons & Service Bundles
                </h3>
                <p className="text-xs text-slate-500">
                  Configure complementary accessories (e.g. Tempered Glass, Screwdriver Kit, Installation Service)
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setAddOns((prev) => [...prev, { title: "", price: 0, note: "" }])
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Add-on Line
              </Button>
            </div>

            {addOns.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">
                  No optional add-ons configured. Click &ldquo;Add Add-on Line&rdquo; to attach upsell items.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {addOns.map((ao, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <Input
                      placeholder="Add-on Title (e.g. Installation Service)"
                      value={ao.title}
                      onChange={(e) => {
                        const updated = [...addOns];
                        updated[idx].title = e.target.value;
                        setAddOns(updated);
                      }}
                      className="h-8 text-xs bg-white flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Extra Price (৳)"
                      value={ao.price || ""}
                      onChange={(e) => {
                        const updated = [...addOns];
                        updated[idx].price = Number(e.target.value) || 0;
                        setAddOns(updated);
                      }}
                      className="h-8 text-xs bg-white w-32"
                    />
                    <Input
                      placeholder="Note / Description"
                      value={ao.note}
                      onChange={(e) => {
                        const updated = [...addOns];
                        updated[idx].note = e.target.value;
                        setAddOns(updated);
                      }}
                      className="h-8 text-xs bg-white flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setAddOns((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab 5: SEO Information */}
        <div className={activeTab === "seo" ? "block" : "hidden"}>
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600" />
              Search Engine Optimization (SEO)
            </h3>

            <FormField
              control={form.control}
              name="metaTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700">
                    Meta Title
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="SEO Title tag for Google..." className="h-10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="metaDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700">
                    Meta Description
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="SEO description snippet (160 characters)..." className="text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="metaKeywords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700">
                    Meta Keywords
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="oled, display, samsung, spare parts..." className="h-10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ogImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700">
                    OpenGraph Image URL
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." className="h-10 text-sm font-mono" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 py-3 px-6 shadow-lg flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {isEdit ? "Editing existing product" : "Creating new product intake"} • {selectedCategoryIds.length} categories • {variants.length} variations
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetForm}
              className="text-xs h-9 border-slate-300 text-slate-700 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Form
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 gap-1.5 shadow-sm px-5"
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting ? "Saving Product..." : "Save Product"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
