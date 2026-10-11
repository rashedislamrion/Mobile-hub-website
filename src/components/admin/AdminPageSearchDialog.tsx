"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CornerDownLeft, ArrowRight, FileText } from "lucide-react";
import { useStaffAuth } from "@/context/AuthContext";
import {
  getFlatSearchablePages,
  searchAdminPages,
  AdminSearchablePage,
} from "@/lib/admin-nav-service";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface AdminPageSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminPageSearchDialog({
  open,
  onOpenChange,
}: AdminPageSearchDialogProps) {
  const router = useRouter();
  const { user, hasPermission } = useStaffAuth();
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // All accessible pages for current user
  const allPages = useMemo(() => {
    return getFlatSearchablePages(user, hasPermission);
  }, [user, hasPermission]);

  // Filtered & ranked results
  const results = useMemo(() => {
    return searchAdminPages(allPages, query);
  }, [allPages, query]);

  // Reset query & focus when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Reset highlight on query change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Keep highlighted item visible
  useEffect(() => {
    if (open && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-search-item]");
      const current = items[highlightedIndex] as HTMLElement;
      if (current) {
        current.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, open]);

  const handleSelectPage = (page: AdminSearchablePage) => {
    onOpenChange(false);
    router.push(page.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : results.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlightedIndex]) {
        handleSelectPage(results[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-xl max-w-[95vw] rounded-xl border border-slate-200 shadow-2xl bg-white gap-0">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-slate-200 bg-slate-50/50">
          <Search className="w-5 h-5 text-emerald-600 flex-shrink-0 mr-3" />
          <Input
            ref={inputRef}
            placeholder="Search admin pages (e.g. Purchase, Reports, HRM)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-14 border-0 bg-transparent text-sm md:text-base focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none font-medium placeholder:text-slate-400"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="hidden sm:inline-block text-[11px] font-mono bg-slate-200/70 text-slate-500 px-2 py-0.5 rounded font-semibold">
              ESC to close
            </span>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-100"
        >
          {results.length > 0 ? (
            results.map((page, idx) => {
              const Icon = page.icon || FileText;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={page.id}
                  data-search-item
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelectPage(page)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isHighlighted
                      ? "bg-emerald-50 text-emerald-950 font-medium"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isHighlighted
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {page.label}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                        {page.groupLabel && (
                          <span className="uppercase tracking-wider font-medium text-[10px] text-slate-500">
                            {page.groupLabel}
                          </span>
                        )}
                        {page.parentLabel && (
                          <>
                            <span>›</span>
                            <span>{page.parentLabel}</span>
                          </>
                        )}
                        <span>›</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {page.href}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {isHighlighted && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded">
                        <span>Go</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <Search className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-sm font-medium text-slate-600">No matching pages found</p>
              <p className="text-xs text-slate-400">
                No pages match &quot;{query}&quot;. Try searching for &quot;Purchase&quot;, &quot;Report&quot;, or &quot;HRM&quot;.
              </p>
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-mono text-[10px]">↑</kbd>{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-mono text-[10px]">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-mono text-[10px]">↵</kbd> to select
            </span>
          </div>
          <span className="hidden sm:inline font-medium text-slate-500">
            {results.length} accessible page{results.length === 1 ? "" : "s"}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
