"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { ArrowLeft, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiPost, getStaffToken, API_BASE_URL } from "@/lib/api-client";
import Link from "next/link";

export default function CreateBannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter banner title");
      return;
    }

    if (!selectedFile && !previewUrl) {
      toast.error("Please select a banner image");
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("image", selectedFile);
        formData.append("linkUrl", "#");

        await apiPost("/banners", formData, { authScope: "STAFF" });
      } else {
        await apiPost("/banners", {
          title: title.trim(),
          imageUrl: previewUrl,
          linkUrl: "#",
        }, { authScope: "STAFF" });
      }

      // Revalidate storefront homepage to display the newly created banner immediately
      fetch("/api/revalidate?path=/").catch(() => {});

      toast.success("Promotional banner created successfully!");
      router.push("/admin/marketing/banners");
    } catch (err: any) {
      toast.error(err.message || "Failed to create banner");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/marketing/banners"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create Promotional Banner</h1>
            <p className="text-xs text-slate-500">Configure promotional hero slide for storefront</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Title <span className="text-rose-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter banner title..."
            className="h-11 rounded-xl text-sm"
            required
          />
        </div>

        {/* Banner Image Upload Dropzone */}
        <div className="space-y-2">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Banner Image <span className="text-rose-500">*</span>
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload promotional banner image in any dimension or aspect ratio (PNG, JPG, WebP)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              previewUrl
                ? "border-emerald-400 bg-emerald-50/20"
                : "border-slate-300 hover:border-emerald-500 hover:bg-slate-50/60"
            }`}
          >
            {previewUrl ? (
              <div className="space-y-3">
                <div className="w-full h-36 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                  <img src={previewUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{selectedFile?.name || "Image Selected"}</span>
                  <span className="text-slate-400 underline ml-2">Click to change</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-slate-500 space-y-2">
                <div className="p-3 bg-slate-100 rounded-full text-slate-600">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Select
                </p>
                <p className="text-xs text-slate-400">
                  Click to browse and upload image (PNG, JPG, WEBP)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            href="/admin/marketing/banners"
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
}
