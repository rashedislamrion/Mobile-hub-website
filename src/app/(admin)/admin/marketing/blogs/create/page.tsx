"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Upload, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { toast } from "sonner";
import { apiGet, apiPost, getAuthToken, getImageUrl, API_BASE_URL } from "@/lib/api-client";

interface BlogCategory {
  id: string;
  name: string;
}

export default function CreateBlogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");

  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Form states
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick-add category dialog
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [isCreatingCat, setIsCreatingCat] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const res = await apiGet<BlogCategory[]>("/blog-categories");
      setCategories(res || []);
      if (res && res.length > 0 && !categoryId) {
        setCategoryId(res[0].id);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load blog categories");
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick-create category
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    setIsCreatingCat(true);
    try {
      const created = await apiPost<BlogCategory>("/blog-categories", {
        name: newCatName.trim(),
      });
      toast.success(`Category "${created.name}" created!`);
      setCategories((prev) => [...prev, created]);
      setCategoryId(created.id);
      setNewCatName("");
      setIsCatDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create category");
    } finally {
      setIsCreatingCat(false);
    }
  };

  // Tag chip handlers
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput("");
      }
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  // Thumbnail file handling
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

  const handleReset = () => {
    setTitle("");
    setTagInput("");
    setTags([]);
    setContent("");
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!categoryId) {
      toast.error("Category is required");
      return;
    }
    if (!content.trim() || content === "<p></p>" || content === "<br>") {
      toast.error("Description is required");
      return;
    }
    if (!file && !previewUrl) {
      toast.error("Thumbnail image (880 × 440) is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("categoryId", categoryId);
      formData.append("content", content);
      tags.forEach((tag) => formData.append("tags", tag));
      formData.append("status", "PUBLISHED");
      if (file) {
        formData.append("image", file);
      }

      if (editId) {
        // If edit, use PATCH or POST
        await apiPost(`/blogs`, formData, { authScope: "STAFF" });
      } else {
        await apiPost(`/blogs`, formData, { authScope: "STAFF" });
      }

      toast.success("Blog article published successfully!");
      router.push("/admin/marketing/blogs");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save blog post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <Link href="/admin/marketing/blogs">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Write New Blog Article</h1>
          <p className="text-xs text-slate-500">Publish repair guides, news, and mobile announcements</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column (2/3) */}
          <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6 space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Title <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="Write blog title here..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-10 text-sm"
              />
            </div>

            {/* Category with Inline Quick Add */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Select Category <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCatDialogOpen(true)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Category
                </button>
              </div>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags with Press-Enter-to-Add Chip Pattern */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Tags</label>
              <div className="border rounded-lg p-2 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 bg-white">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {tags.map((tag, idx) => (
                    <Badge
                      key={idx}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2 py-0.5 text-xs flex items-center gap-1 border-slate-200"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(idx)}
                        className="text-slate-400 hover:text-rose-500 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Write tag and Press enter to add tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  className="w-full text-xs text-slate-700 outline-none placeholder:text-slate-400 bg-transparent"
                />
              </div>
              <p className="text-[11px] text-slate-400">Write tag and Press enter to add tags</p>
            </div>

            {/* Description using RichTextEditor */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Description <span className="text-rose-500">*</span>
              </label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write rich description content here..."
                minHeight="min-h-[220px]"
                maxHeight="max-h-[400px]"
              />
            </div>
          </div>

          {/* Right Column (1/3) — Thumbnail */}
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4 h-fit">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Thumbnail (880 × 440) <span className="text-rose-500">*</span>
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
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 transition-colors rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 min-h-[240px]"
              >
                {previewUrl ? (
                  <div className="relative w-full rounded-lg overflow-hidden border shadow-sm group">
                    <img
                      src={previewUrl}
                      alt="Thumbnail preview"
                      className="w-full h-44 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                      Click to replace thumbnail
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-semibold text-slate-700">
                      Select <span className="text-xs text-slate-400 font-normal">or drop image</span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-xs">
                      Ratio 2:1 (880 × 440 px). JPG, PNG, or WebP.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions: Reset / Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 bg-white p-4 rounded-xl border shadow-sm">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="h-10 text-xs font-semibold text-slate-600"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Publishing...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </form>

      {/* Quick Add Category Dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Blog Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Category Name *</label>
              <Input
                placeholder="e.g. Tips &amp; Tricks, Smartphone News"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCatDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={isCreatingCat}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
            >
              {isCreatingCat ? "Adding..." : "Save Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
