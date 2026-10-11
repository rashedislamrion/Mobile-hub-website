"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Check, Folder, FolderOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api-client";

export interface CategoryNode {
  id: string;
  name: string;
  slug?: string;
  parentId?: string | null;
  children?: CategoryNode[];
  _count?: { products: number };
}

interface CategoryCheckboxTreeProps {
  selectedCategoryIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}

export function CategoryCheckboxTree({
  selectedCategoryIds = [],
  onChange,
  error,
}: CategoryCheckboxTreeProps) {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadTree = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      // Try /categories/tree first, fallback to /products/categories
      let data: any = null;
      try {
        data = await apiGet<CategoryNode[]>("/categories/tree");
      } catch {
        data = await apiGet<CategoryNode[]>("/products/categories");
      }
      if (Array.isArray(data)) {
        setTree(data);
        // Auto-expand all top-level parents with selected children
        const initialExpanded = new Set<string>();
        data.forEach((node) => {
          if (node.children && node.children.length > 0) {
            initialExpanded.add(node.id);
          }
        });
        setExpandedIds(initialExpanded);
      } else {
        setFetchError("Invalid category data received");
      }
    } catch (err: any) {
      console.error("Failed to load category tree:", err);
      setFetchError(err.message || "Failed to load category tree");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    const isSelected = selectedCategoryIds.includes(id);
    let newSelected: string[];
    if (isSelected) {
      newSelected = selectedCategoryIds.filter((item) => item !== id);
    } else {
      newSelected = [...selectedCategoryIds, id];
    }
    onChange(newSelected);
  };

  const filterTree = (nodes: CategoryNode[]): CategoryNode[] => {
    if (!searchTerm.trim()) return nodes;
    const term = searchTerm.toLowerCase();

    return nodes
      .map((node) => {
        const matchesSelf = node.name.toLowerCase().includes(term);
        const filteredChildren = node.children ? filterTree(node.children) : [];
        const matchesChildren = filteredChildren.length > 0;

        if (matchesSelf || matchesChildren) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
        return null;
      })
      .filter(Boolean) as CategoryNode[];
  };

  const renderNode = (node: CategoryNode, depth = 0) => {
    const isExpanded = expandedIds.has(node.id) || searchTerm.trim().length > 0;
    const isChecked = selectedCategoryIds.includes(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => toggleSelect(node.id)}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
          className={`flex items-center justify-between py-1.5 pr-2 rounded-md cursor-pointer transition-colors text-sm ${
            isChecked
              ? "bg-emerald-50 text-emerald-900 font-medium"
              : "hover:bg-slate-100 text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5 inline-block" />
            )}

            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                isChecked
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
            </div>

            <span className="truncate">{node.name}</span>
          </div>

          {node._count?.products !== undefined && (
            <span className="text-[11px] text-slate-400 font-normal px-1.5 py-0.5 rounded bg-slate-100">
              {node._count.products}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-slate-100 ml-4 pl-1">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filtered = filterTree(tree);

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <label className="text-sm font-semibold text-slate-800">
          Categories <span className="text-rose-500">*</span>
        </label>
        <span className="text-xs text-slate-400">
          {selectedCategoryIds.length} selected
        </span>
      </div>

      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          placeholder="Filter categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
        />
      </div>

      <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 space-y-0.5">
        {loading ? (
          <div className="p-4 text-center text-xs text-slate-400">
            Loading categories tree...
          </div>
        ) : fetchError ? (
          <div className="p-4 text-center text-xs text-rose-500 space-y-2 bg-rose-50/50 rounded-lg border border-rose-100 my-1">
            <p className="font-medium">Failed to load category tree</p>
            <p className="text-[11px] text-rose-400">{fetchError}</p>
            <button
              type="button"
              onClick={loadTree}
              className="inline-block px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded text-xs font-semibold hover:bg-rose-50"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            No categories found matching &ldquo;{searchTerm}&rdquo;
          </div>
        ) : (
          filtered.map((node) => renderNode(node, 0))
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-500 font-medium mt-1">{error}</p>
      )}
    </div>
  );
}
