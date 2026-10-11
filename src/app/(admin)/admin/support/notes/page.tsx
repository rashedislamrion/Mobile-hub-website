"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiGet, apiDelete } from "@/lib/api-client";
import { format, formatDistanceToNow } from "date-fns";

export interface HelpNoteRecord {
  id: string;
  name: string;
  phone: string;
  subject: string;
  note?: string | null;
  createdAt: string;
}

export default function HelpNotesPage() {
  const { setTitle, setBadge } = useAdminPage();
  const [notes, setNotes] = useState<HelpNoteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number }>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  const fetchNotes = useCallback(async (currentPage: number) => {
    setIsLoading(true);
    try {
      const res = await apiGet<{ data: HelpNoteRecord[]; meta: any }>("/help-notes", {
        page: currentPage,
        limit: 20,
      });
      setNotes(res.data || []);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load help notes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTitle("Help Notes");
    setBadge("Support");
    fetchNotes(page);
  }, [setTitle, setBadge, fetchNotes, page]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this help note?")) return;
    try {
      await apiDelete(`/help-notes/${id}`);
      toast.success("Help note deleted");
      fetchNotes(page);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete note");
    }
  };

  const columns: ColumnDef<HelpNoteRecord>[] = [
    {
      accessorKey: "name",
      header: "NAME",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 text-sm">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: "PHONE NUMBER",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-700 font-medium">{row.original.phone}</span>
      ),
    },
    {
      accessorKey: "subject",
      header: "SUBJECT",
      cell: ({ row }) => (
        <span className="font-medium text-slate-800 text-xs">{row.original.subject}</span>
      ),
    },
    {
      accessorKey: "note",
      header: "MESSAGE",
      cell: ({ row }) => {
        const text = row.original.note || "—";
        return (
          <span
            className="text-xs text-slate-600 line-clamp-2 max-w-sm block"
            title={row.original.note || undefined}
          >
            {text}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "DATE",
      cell: ({ row }) => {
        try {
          const d = new Date(row.original.createdAt);
          return (
            <div>
              <span className="text-xs text-slate-700 font-medium">
                {format(d, "dd MMM yyyy, hh:mm a")}
              </span>
              <span className="text-[11px] text-slate-400 block">
                {formatDistanceToNow(d, { addSuffix: true })}
              </span>
            </div>
          );
        } catch {
          return <span className="text-xs text-slate-400">-</span>;
        }
      },
    },
    {
      id: "action",
      header: "ACTION",
      cell: ({ row }) => (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
          onClick={() => handleDelete(row.original.id)}
          title="Delete Note"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="space-y-6">
      {/* Header: Plain Title Only, no filter bar, no add button per reference */}
      <div className="bg-white p-5 rounded-xl border shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Help Notes</h1>
        <p className="text-xs text-slate-500 mt-0.5">Manage and review recorded customer inquiries and notes</p>
      </div>

      {/* Table without filter bar */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <DataTable columns={columns} data={notes} isLoading={isLoading} />

        {/* Pagination Footer matching reference */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-xs text-slate-500">
          <div>
            {meta.total === 0
              ? "Showing 0 results"
              : `Showing ${from} to ${to} of ${meta.total} results`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
            </Button>
            <span className="text-xs font-semibold px-2">
              Page {meta.page} of {Math.max(1, meta.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 text-xs font-medium"
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
