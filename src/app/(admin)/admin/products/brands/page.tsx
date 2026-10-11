"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { apiGet, apiPatch, apiDelete, BACKEND_URL, getStaffToken } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Award,
  Upload,
  Image as ImageIcon,
  Loader2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  Link2,
  Undo2,
  Redo2,
  RemoveFormatting,
  Globe,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AdminTableState } from "@/components/admin/AdminTableState";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";

interface BrandItem {
  id: string;
  name: string;
  slug?: string;
  logo?: string | null;
  description?: string | null;
  featured: boolean;
  status: "ACTIVE" | "INACTIVE";
  metaTitle?: string | null;
  metaDescription?: string | null;
  _count?: {
    products: number;
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function BrandsPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();

  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formFeatured, setFormFeatured] = useState(false);
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [formDescription, setFormDescription] = useState("");
  const [formMetaTitle, setFormMetaTitle] = useState("");
  const [formMetaDescription, setFormMetaDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("description");

  // Editor Ref
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle("Brands");
    setBadge("Products");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  // Fetch Brands
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGet<BrandItem[]>("/brands");
      setBrands(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || "Failed to load brands");
      toast.error(err.message || "Failed to load brands");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered
  const filteredBrands = useMemo(() => {
    return brands.filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.slug && b.slug.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        statusFilter === "ALL" || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [brands, searchQuery, statusFilter]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setEditingBrand(null);
    setFormName("");
    setFormSlug("");
    setFormFeatured(false);
    setFormStatus("ACTIVE");
    setFormDescription("");
    setFormMetaTitle("");
    setFormMetaDescription("");
    setLogoFile(null);
    setLogoPreview(null);
    setActiveTab("description");
    setIsModalOpen(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
    }, 50);
  };

  // Open Edit Dialog
  const handleOpenEdit = (brand: BrandItem) => {
    setEditingBrand(brand);
    setFormName(brand.name);
    setFormSlug(brand.slug || slugify(brand.name));
    setFormFeatured(Boolean(brand.featured));
    setFormStatus(brand.status || "ACTIVE");
    setFormDescription(brand.description || "");
    setFormMetaTitle(brand.metaTitle || "");
    setFormMetaDescription(brand.metaDescription || "");
    setLogoFile(null);
    setLogoPreview(
      brand.logo
        ? brand.logo.startsWith("http")
          ? brand.logo
          : `${BACKEND_URL}${brand.logo}`
        : null,
    );
    setActiveTab("description");
    setIsModalOpen(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = brand.description || "";
      }
    }, 50);
  };

  // Auto-slug on name change if not editing or slug matches old slugified name
  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingBrand || formSlug === slugify(formName)) {
      setFormSlug(slugify(val));
    }
  };

  // Instant Switch Toggle: Featured
  const handleToggleFeatured = async (brand: BrandItem) => {
    const nextFeatured = !brand.featured;
    setBrands((prev) =>
      prev.map((b) => (b.id === brand.id ? { ...b, featured: nextFeatured } : b)),
    );

    try {
      await apiPatch(`/brands/${brand.id}`, { featured: nextFeatured });
      toast.success(
        `Brand "${brand.name}" ${nextFeatured ? "marked as Featured" : "unmarked as Featured"}.`,
      );
    } catch (err: any) {
      // Revert
      setBrands((prev) =>
        prev.map((b) => (b.id === brand.id ? { ...b, featured: brand.featured } : b)),
      );
      toast.error(err.message || "Failed to update featured status");
    }
  };

  // Instant Switch Toggle: Status
  const handleToggleStatus = async (brand: BrandItem) => {
    const nextStatus = brand.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setBrands((prev) =>
      prev.map((b) => (b.id === brand.id ? { ...b, status: nextStatus } : b)),
    );

    try {
      await apiPatch(`/brands/${brand.id}`, { status: nextStatus });
      toast.success(
        `Brand "${brand.name}" is now ${nextStatus === "ACTIVE" ? "Active" : "Inactive"}.`,
      );
    } catch (err: any) {
      // Revert
      setBrands((prev) =>
        prev.map((b) => (b.id === brand.id ? { ...b, status: brand.status } : b)),
      );
      toast.error(err.message || "Failed to update brand status");
    }
  };

  // Logo file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Rich Text Editor Commands
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setFormDescription(editorRef.current.innerHTML);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setFormDescription(editorRef.current.innerHTML);
    }
  };

  // Submit Create / Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Please enter a brand name");
      return;
    }

    const currentDescription = editorRef.current ? editorRef.current.innerHTML : formDescription;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", formName.trim());
      formData.append("slug", formSlug.trim() || slugify(formName));
      formData.append("featured", String(formFeatured));
      formData.append("status", formStatus);
      if (currentDescription) formData.append("description", currentDescription);
      if (formMetaTitle) formData.append("metaTitle", formMetaTitle.trim());
      if (formMetaDescription) formData.append("metaDescription", formMetaDescription.trim());
      if (logoFile) formData.append("logo", logoFile);

      if (editingBrand) {
        await apiPatch(`/brands/${editingBrand.id}`, formData);
        toast.success(`Brand "${formName}" updated successfully!`);
      } else {
        const staffToken = getStaffToken() || "";
        const res = await fetch(`${BACKEND_URL}/api/v1/brands`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${staffToken}`,
          },
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to create brand");
        }
        toast.success(`Brand "${formName}" created successfully!`);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save brand");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete
  const handleDelete = async (brand: BrandItem) => {
    if (!confirm(`Are you sure you want to delete brand "${brand.name}"?`)) return;

    try {
      await apiDelete(`/brands/${brand.id}`);
      toast.success(`Brand "${brand.name}" deleted successfully.`);
      setBrands((prev) => prev.filter((b) => b.id !== brand.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete brand");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Brand Management</h1>
            <p className="text-xs text-slate-500">
              Manage product brands, logos, promotional feature tags, and SEO profiles
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create New</span>
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search brands by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-50/50 border-slate-200 rounded-xl text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={statusFilter === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("ALL")}
            className={`rounded-xl text-xs ${
              statusFilter === "ALL"
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "text-slate-600 border-slate-200"
            }`}
          >
            All ({brands.length})
          </Button>
          <Button
            variant={statusFilter === "ACTIVE" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`rounded-xl text-xs ${
              statusFilter === "ACTIVE"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "text-slate-600 border-slate-200"
            }`}
          >
            Active ({brands.filter((b) => b.status === "ACTIVE").length})
          </Button>
          <Button
            variant={statusFilter === "INACTIVE" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("INACTIVE")}
            className={`rounded-xl text-xs ${
              statusFilter === "INACTIVE"
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "text-slate-600 border-slate-200"
            }`}
          >
            Inactive ({brands.filter((b) => b.status === "INACTIVE").length})
          </Button>
        </div>
      </div>

      {/* Brands Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">SL</th>
                <th className="py-3.5 px-4 w-24 text-center">Logo</th>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4 text-center">Featured</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AdminTableState
                isLoading={isLoading}
                error={error}
                isEmpty={filteredBrands.length === 0}
                onRetry={fetchData}
                colSpan={6}
                loadingRows={5}
                emptyTitle="No brands found"
                emptyDescription="Try modifying your search or create a new brand."
                emptyActionLabel="Create Brand"
                onEmptyAction={handleOpenCreate}
              >
                {filteredBrands.map((brand, idx) => {
                  const logoUrl = brand.logo
                    ? brand.logo.startsWith("http")
                      ? brand.logo
                      : `${BACKEND_URL}${brand.logo}`
                    : null;

                  return (
                    <tr
                      key={brand.id}
                      className="hover:bg-slate-50/70 transition-colors duration-150"
                    >
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500 font-bold">
                        {idx + 1}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="w-12 h-9 mx-auto rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden relative shadow-xs">
                          {logoUrl ? (
                            <Image
                              src={logoUrl}
                              alt={brand.name}
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-900">{brand.name}</p>
                          {brand.slug && (
                            <p className="text-xs text-slate-400 font-mono">
                              /{brand.slug}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={brand.featured}
                            onCheckedChange={() => handleToggleFeatured(brand)}
                            className="data-[state=checked]:bg-amber-500"
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={brand.status === "ACTIVE"}
                            onCheckedChange={() => handleToggleStatus(brand)}
                            className="data-[state=checked]:bg-emerald-600"
                          />
                          <span
                            className={`text-xs font-semibold ${
                              brand.status === "ACTIVE"
                                ? "text-emerald-700"
                                : "text-slate-400"
                            }`}
                          >
                            {brand.status === "ACTIVE" ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(brand)}
                            title="Edit Brand"
                            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(brand)}
                            title="Delete Brand"
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </AdminTableState>
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              {editingBrand ? "Edit Brand" : "Create Brand"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            {/* Top Grid: Logo & Primary Details */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Logo Upload Box (400 x 250 format) */}
              <div className="md:col-span-5 flex flex-col">
                <Label className="text-xs font-bold text-slate-700 mb-1.5">
                  Brand Logo <span className="text-slate-400 font-normal">(400 x 250)</span>
                </Label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 min-h-[160px] border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl bg-slate-50/50 hover:bg-emerald-50/20 cursor-pointer flex flex-col items-center justify-center p-4 transition-all relative overflow-hidden group"
                >
                  {logoPreview ? (
                    <div className="relative w-full h-full min-h-[130px] flex items-center justify-center">
                      <Image
                        src={logoPreview}
                        alt="Logo preview"
                        fill
                        className="object-contain p-2 rounded-xl"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                        <Upload className="w-4 h-4" /> Change Logo
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">
                          Click to upload logo
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Recommended 400×250 px
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Name, Slug, Toggles */}
              <div className="md:col-span-7 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Apple, Samsung, Sony..."
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="bg-slate-50 border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Slug
                  </Label>
                  <Input
                    placeholder="e.g. apple, samsung..."
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="bg-slate-50 border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <Label className="text-xs font-bold text-slate-800">
                        Featured
                      </Label>
                      <p className="text-[10px] text-slate-500">Show on homepage</p>
                    </div>
                    <Switch
                      checked={formFeatured}
                      onCheckedChange={setFormFeatured}
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <Label className="text-xs font-bold text-slate-800">
                        Status
                      </Label>
                      <p className="text-[10px] text-slate-500">Active status</p>
                    </div>
                    <Switch
                      checked={formStatus === "ACTIVE"}
                      onCheckedChange={(c) => setFormStatus(c ? "ACTIVE" : "INACTIVE")}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Tabs: Description & SEO */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full bg-slate-100 p-1 rounded-xl">
                <TabsTrigger
                  value="description"
                  className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 shadow-none"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Description
                </TabsTrigger>
                <TabsTrigger
                  value="seo"
                  className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 shadow-none"
                >
                  <Globe className="w-3.5 h-3.5" />
                  SEO Settings
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Description Rich-Text Editor */}
              <TabsContent value="description" className="space-y-2 mt-3">
                {/* Rich Text Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border border-slate-200 rounded-t-xl text-slate-700">
                  <button
                    type="button"
                    onClick={() => executeCommand("bold")}
                    title="Bold"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("italic")}
                    title="Italic"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("underline")}
                    title="Underline"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("strikeThrough")}
                    title="Strikethrough"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Strikethrough className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-300 mx-1" />

                  <button
                    type="button"
                    onClick={() => executeCommand("formatBlock", "<h1>")}
                    title="Heading 1"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Heading1 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("formatBlock", "<h2>")}
                    title="Heading 2"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Heading2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("formatBlock", "<h3>")}
                    title="Heading 3"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Heading3 className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-300 mx-1" />

                  <button
                    type="button"
                    onClick={() => executeCommand("insertUnorderedList")}
                    title="Bullet List"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("insertOrderedList")}
                    title="Numbered List"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-300 mx-1" />

                  <button
                    type="button"
                    onClick={() => executeCommand("justifyLeft")}
                    title="Align Left"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("justifyCenter")}
                    title="Align Center"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("justifyRight")}
                    title="Align Right"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("justifyFull")}
                    title="Justify"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <AlignJustify className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-300 mx-1" />

                  <button
                    type="button"
                    onClick={() => executeCommand("formatBlock", "<blockquote>")}
                    title="Quote"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Quote className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = prompt("Enter link URL:");
                      if (url) executeCommand("createLink", url);
                    }}
                    title="Insert Link"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("removeFormat")}
                    title="Clear Formatting"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <RemoveFormatting className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-300 mx-1" />

                  <button
                    type="button"
                    onClick={() => executeCommand("undo")}
                    title="Undo"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCommand("redo")}
                    title="Redo"
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 hover:text-slate-900"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>

                {/* ContentEditable Div */}
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={handleEditorInput}
                  className="min-h-[140px] max-h-[220px] overflow-y-auto p-3.5 bg-white border border-t-0 border-slate-200 rounded-b-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 prose prose-sm max-w-none"
                  data-placeholder="Enter brand background, story, warranty coverage details..."
                />
              </TabsContent>

              {/* Tab 2: SEO Settings */}
              <TabsContent value="seo" className="space-y-3.5 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Meta Title
                  </Label>
                  <Input
                    placeholder="e.g. Official Apple Store Bangladesh — mobilehubbd"
                    value={formMetaTitle}
                    onChange={(e) => setFormMetaTitle(e.target.value)}
                    className="bg-slate-50 border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Meta Description
                  </Label>
                  <Textarea
                    placeholder="e.g. Explore original Apple iPhones, iPads, and accessories with official warranty and instant doorstep delivery."
                    value={formMetaDescription}
                    onChange={(e) => setFormMetaDescription(e.target.value)}
                    rows={3}
                    className="bg-slate-50 border-slate-200 rounded-xl text-sm resize-none"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl px-4 text-slate-600"
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 font-semibold"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingBrand ? (
                  "Update Brand"
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
