"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";

export default function CreateAdPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setPreviewUrl(URL.createObjectURL(dropped));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!file) {
      toast.error("Please select a thumbnail image (400 × 250 px)");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("isFeatured", String(isFeatured));
      formData.append("status", "ACTIVE");
      formData.append("image", file);

      await apiPost("/ads", formData, { authScope: "STAFF" });

      toast.success("Ad created successfully!");
      router.push("/admin/marketing/ads");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create ad");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/admin/marketing/ads">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Create New Ad</h1>
          <p className="text-xs text-slate-500">Configure promotional ad campaign banner</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Title <span className="text-rose-500">*</span>
          </label>
          <Input
            placeholder="e.g. Summer Mega Sale Ad"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="h-10 text-sm"
          />
        </div>

        {/* Is Featured Checkbox */}
        <div className="flex items-start space-x-3 rounded-lg border border-slate-200 p-4 bg-slate-50/50">
          <Checkbox
            id="isFeatured"
            checked={isFeatured}
            onCheckedChange={(checked) => setIsFeatured(Boolean(checked))}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <label htmlFor="isFeatured" className="text-sm font-semibold text-slate-800 cursor-pointer">
              Is Featured
            </label>
            <p className="text-xs text-slate-500">
              Check this box to feature this ad on the storefront home page.{" "}
              <span className="font-semibold text-amber-600">(max 2 ads show in home page)</span>
            </p>
          </div>
        </div>

        {/* 400 x 250 Informational Placeholder Box */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700">Recommended Dimensions</label>
          <div className="w-full max-w-sm h-36 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center bg-slate-50 text-slate-400">
            <ImageIcon className="w-8 h-8 mb-1.5 opacity-60" />
            <span className="text-base font-bold text-slate-600">400 × 250</span>
            <span className="text-xs text-slate-400">Target aspect ratio 16:10</span>
          </div>
        </div>

        {/* Thumbnail Ratio (400 x 250 px) * Upload Dropzone */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700">
            Thumbnail Ratio (400 × 250 px) <span className="text-rose-500">*</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-emerald-500 transition-colors rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 min-h-[220px]"
          >
            {previewUrl ? (
              <div className="relative max-w-sm rounded-lg overflow-hidden border shadow-sm group">
                <img
                  src={previewUrl}
                  alt="Thumbnail preview"
                  className="w-full h-44 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                  Click to replace image
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  Select <span className="text-xs text-slate-400 font-normal">or drop image here</span>
                </div>
                <p className="text-xs text-slate-400 max-w-xs">
                  Upload high quality JPG, PNG, or WebP image at 400 × 250 pixels
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Link href="/admin/marketing/ads">
            <Button variant="outline" type="button" className="h-10 text-xs font-semibold">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
