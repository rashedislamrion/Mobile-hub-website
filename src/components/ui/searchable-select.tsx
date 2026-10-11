"use client";

import React, { useState, useRef, useEffect, useMemo, useId } from "react";
import { ChevronDown, Check, X, Search, Loader2, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface SearchableOption {
  value: string;
  label: string;
  secondary?: string | null;
  disabled?: boolean;
  metadata?: any;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value?: string;
  onChange: (value: string, option?: SearchableOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  isLoading?: boolean;
  onSearchChange?: (query: string) => void;
  onQuickCreate?: () => void;
  quickCreateTitle?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  emptyText?: string;
  id?: string;
  name?: string;
}

export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to search...",
  disabled = false,
  required = false,
  allowClear = false,
  isLoading = false,
  onSearchChange,
  onQuickCreate,
  quickCreateTitle = "Add new",
  className = "",
  triggerClassName = "",
  dropdownClassName = "",
  emptyText = "No matching options found",
  id,
  name,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Selected Option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Filter & Rank options
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;

    const startsWithMatches: SearchableOption[] = [];
    const containsMatches: SearchableOption[] = [];

    for (const opt of options) {
      const lbl = (opt.label || "").toLowerCase();
      const sec = (opt.secondary || "").toLowerCase();

      if (lbl.startsWith(q)) {
        startsWithMatches.push(opt);
      } else if (lbl.includes(q) || sec.includes(q)) {
        containsMatches.push(opt);
      }
    }

    return [...startsWithMatches, ...containsMatches];
  }, [options, query]);

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
      if (onSearchChange) onSearchChange("");
    }
  }, [open, onSearchChange]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-select-item]");
      const current = items[highlightedIndex] as HTMLElement;
      if (current) {
        current.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, open]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIndex(0);
    if (onSearchChange) onSearchChange(val);
  };

  const handleSelect = (option: SearchableOption) => {
    if (option.disabled) return;
    onChange(option.value, option);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`relative flex items-center gap-1.5 w-full ${className}`}>
      {/* Hidden native input for required form validation */}
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, width: 0, height: 0, position: "absolute", pointerEvents: "none" }}
          value={value || ""}
          onChange={() => {}}
          required={required}
          name={name}
        />
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={selectId}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            aria-expanded={open}
            className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-left flex items-center justify-between gap-2 transition-all ${
              disabled
                ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                : "text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            } ${triggerClassName}`}
          >
            <span className="truncate flex-1">
              {selectedOption ? (
                <span className="font-medium text-slate-800">
                  {selectedOption.label}
                  {selectedOption.secondary && (
                    <span className="text-slate-400 font-normal ml-1.5 text-xs">
                      ({selectedOption.secondary})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-slate-400">{placeholder}</span>
              )}
            </span>

            <div className="flex items-center gap-1.5 flex-shrink-0 text-slate-400">
              {allowClear && value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleClear(e as any);
                    }
                  }}
                  className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Clear selection"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              )}
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180 text-emerald-600" : ""}`} />
              )}
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={4}
          className={`w-[var(--radix-popover-trigger-width)] min-w-[240px] max-w-[420px] p-0 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden ${dropdownClassName}`}
        >
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="h-8 text-xs bg-white border-slate-200 focus:ring-1 focus:ring-emerald-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-50 text-xs"
          >
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>Loading options...</span>
                  </div>
                ) : (
                  <span>{emptyText}</span>
                )}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    data-select-item
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between gap-2 transition-colors ${
                      opt.disabled
                        ? "opacity-50 cursor-not-allowed"
                        : isHighlighted
                        ? "bg-emerald-50 text-emerald-900"
                        : "hover:bg-slate-50 text-slate-700"
                    } ${isSelected ? "font-semibold text-emerald-700 bg-emerald-50/60" : ""}`}
                  >
                    <div className="truncate flex-1">
                      <div className="truncate text-xs font-medium">
                        {opt.label}
                      </div>
                      {opt.secondary && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {opt.secondary}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Add Button if provided */}
      {onQuickCreate && (
        <button
          type="button"
          onClick={onQuickCreate}
          title={quickCreateTitle}
          className="h-[42px] w-[42px] flex-shrink-0 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
