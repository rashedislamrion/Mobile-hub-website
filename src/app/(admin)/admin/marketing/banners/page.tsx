"use client";

import { useEffect, useState } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { Plus, Edit2, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiGet, apiPatch, apiDelete, getImageUrl } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminTableState } from "@/components/admin/AdminTableState";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface BannerRecord {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  sortOrder: number;
  status: "ACTIVE" | "INACTIVE";
}

export default function BannersPage() {
  const router = useRouter();
  const { setTitle, setBadge, setDateFilter } = useAdminPage();
  const [banners, setBanners] = useState<BannerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editingBanner, setEditingBanner] = useState<BannerRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchBanners = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<BannerRecord[]>("/banners");
      setBanners(data || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load banners");
      toast.error(e.message || "Failed to load banners");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setTitle("Promotional Banners");
    setBadge("Marketing");
    setDateFilter("");
    fetchBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleStatus = async (banner: BannerRecord) => {
    const nextStatus = banner.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await apiPatch(`/banners/${banner.id}`, { status: nextStatus });
      fetch("/api/revalidate?path=/").catch(() => {});
      toast.success(`Banner status updated`);
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, status: nextStatus } : b))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleOpenEdit = (banner: BannerRecord) => {
    setEditingBanner(banner);
    setEditTitle(banner.title || "");
    setEditImageUrl(banner.imageUrl || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;

    setIsUpdating(true);
    try {
      await apiPatch(`/banners/${editingBanner.id}`, {
        title: editTitle.trim(),
        imageUrl: editImageUrl.trim(),
      });
      fetch("/api/revalidate?path=/").catch(() => {});
      toast.success("Banner updated successfully");
      setEditingBanner(null);
      fetchBanners();
    } catch (err: any) {
      toast.error(err.message || "Failed to update banner");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    try {
      await apiDelete(`/banners/${bannerId}`);
      fetch("/api/revalidate?path=/").catch(() => {});
      toast.success("Banner deleted");
      if (editingBanner?.id === bannerId) setEditingBanner(null);
      fetchBanners();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete banner");
    }
  };

  const handleDeleteInEdit = async () => {
    if (!editingBanner) return;
    handleDeleteBanner(editingBanner.id);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Promotional Banners</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage carousel banners shown on homepage</p>
        </div>
        <Link href="/admin/marketing/banners/create">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 h-10 px-4">
            <Plus className="w-4 h-4" /> Create New
          </Button>
        </Link>
      </div>

      {/* Simplified Plain Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <th className="py-3.5 px-4 w-12 text-center">SL</th>
              <th className="py-3.5 px-4 w-44">Thumbnail</th>
              <th className="py-3.5 px-4">Title</th>
              <th className="py-3.5 px-4 w-28 text-center">Status</th>
              <th className="py-3.5 px-4 w-20 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <AdminTableState
              isLoading={isLoading}
              error={error}
              isEmpty={banners.length === 0}
              onRetry={fetchBanners}
              colSpan={5}
              loadingRows={4}
              emptyTitle="No promotional banners found"
              emptyDescription="Click '+ Create New' above to add your first banner."
              emptyActionLabel="Create Banner"
              onEmptyAction={() => router.push("/admin/marketing/banners/create")}
            >
              {banners.map((banner, index) => (
                <tr key={banner.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* SL */}
                  <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                    {index + 1}
                  </td>

                  {/* THUMBNAIL */}
                  <td className="py-3.5 px-4">
                    <div className="w-36 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                      <img
                        src={getImageUrl(banner.imageUrl)}
                        alt={banner.title || "Banner"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  </td>

                  {/* TITLE */}
                  <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                    {banner.title || "Untitled Banner"}
                  </td>

                  {/* STATUS */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center justify-center">
                      <Switch
                        checked={banner.status === "ACTIVE"}
                        onCheckedChange={() => handleToggleStatus(banner)}
                        className="data-[state=checked]:bg-emerald-600"
                      />
                    </div>
                  </td>

                  {/* ACTION */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(banner)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-emerald-700 transition-colors"
                        title="Edit Banner"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBanner(banner.id)}
                        className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors"
                        title="Delete Banner"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTableState>
          </tbody>
        </table>
      </div>

      {/* Edit Banner Dialog */}
      <Dialog open={Boolean(editingBanner)} onOpenChange={(open) => !open && setEditingBanner(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Edit Promotional Banner</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Banner Title
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-10 rounded-xl text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Image URL / Path
              </label>
              <Input
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                className="h-10 rounded-xl text-xs font-mono"
                required
              />
              {editImageUrl && (
                <div className="mt-2 w-full h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={getImageUrl(editImageUrl)}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleDeleteInEdit}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
              >
                Delete Banner
              </button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingBanner(null)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
