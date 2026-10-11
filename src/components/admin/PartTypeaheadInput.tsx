"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Package, Tag, Layers } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { Input } from "@/components/ui/input";

export interface PartOption {
  id: string; // variant id
  productId: string;
  productName: string;
  sku?: string;
  color?: string | null;
  quality?: string | null;
  attributes?: Record<string, any> | null;
  stock: number;
  price: number;
  buyingPrice?: number | null;
  brandName?: string | null;
  categoryName?: string;
}

interface PartTypeaheadInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectPart: (selected: {
    partName: string;
    productId: string;
    variantId?: string;
    cost: number;
    stock: number;
    sku?: string;
  }) => void;
  branchId?: string;
  placeholder?: string;
  className?: string;
}

export function PartTypeaheadInput({
  value,
  onChange,
  onSelectPart,
  branchId,
  placeholder = "e.g. S23 Ultra Display Panel",
  className = "",
}: PartTypeaheadInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<PartOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const params: any = { search: trimmed, limit: 20 };
        if (branchId && branchId !== "all") {
          params.branchId = branchId;
        }
        const data = await apiGet<PartOption[]>("/pos/products", params);
        if (Array.isArray(data)) {
          setResults(data);
          setHighlightedIndex(0);
          setIsOpen(data.length > 0);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("Part typeahead search error:", err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [value, branchId]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatVariantSpec = (opt: PartOption) => {
    const parts: string[] = [];
    if (opt.color) parts.push(opt.color);
    if (opt.quality) parts.push(opt.quality);
    if (opt.attributes && typeof opt.attributes === "object") {
      Object.entries(opt.attributes).forEach(([k, v]) => {
        if (v && k !== "color" && k !== "quality") parts.push(String(v));
      });
    }
    return parts.join(" • ");
  };

  const handleSelect = (item: PartOption) => {
    const spec = formatVariantSpec(item);
    const fullName = spec ? `${item.productName} (${spec})` : item.productName;
    const unitCost =
      item.buyingPrice !== null && item.buyingPrice !== undefined && Number(item.buyingPrice) > 0
        ? Number(item.buyingPrice)
        : Number(item.price || 0);

    onSelectPart({
      partName: fullName,
      productId: item.productId,
      variantId: item.id.startsWith("pv-") ? undefined : item.id,
      cost: unitCost,
      stock: item.stock || 0,
      sku: item.sku,
    });
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "ArrowDown" && results.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      if (results[highlightedIndex]) {
        e.preventDefault();
        handleSelect(results[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen && e.target.value.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`h-8 text-xs bg-white font-medium pr-7 ${className}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[320px] max-w-[420px] bg-white rounded-lg border border-slate-200 shadow-xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100">
          <div className="px-2.5 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Catalogue Parts Match ({results.length})</span>
            <span className="text-[9px] text-slate-400">↑↓ to navigate, Enter to select</span>
          </div>
          {results.map((item, idx) => {
            const spec = formatVariantSpec(item);
            const isHighlighted = idx === highlightedIndex;
            const cost =
              item.buyingPrice !== null && item.buyingPrice !== undefined && Number(item.buyingPrice) > 0
                ? Number(item.buyingPrice)
                : Number(item.price || 0);

            return (
              <div
                key={item.id}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelect(item)}
                className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                  isHighlighted ? "bg-emerald-50/80 text-emerald-950" : "hover:bg-slate-50 text-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-900 leading-tight">
                    {item.productName}
                    {spec && (
                      <span className="ml-1.5 inline-block text-[11px] font-normal text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded">
                        {spec}
                      </span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-bold text-slate-900">৳{cost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                  {item.sku && (
                    <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">
                      {item.sku}
                    </span>
                  )}
                  <span
                    className={`px-1.5 py-0.2 rounded font-medium ${
                      item.stock > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    Stock: {item.stock}
                  </span>
                  {item.brandName && (
                    <span className="text-slate-400">• {item.brandName}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
