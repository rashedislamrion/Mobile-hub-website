"use client";

import React, { ReactNode } from "react";
import { AlertCircle, RotateCcw, Package, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface AdminTableStateProps {
  isLoading: boolean;
  error?: string | null;
  isEmpty: boolean;
  onRetry?: () => void;
  colSpan?: number;
  loadingRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  emptyIcon?: ReactNode;
  children: ReactNode;
}

/**
 * Loading skeleton rows for standard HTML <table> <tbody>
 */
export function TableLoadingSkeleton({
  colSpan,
  rows = 5,
}: {
  colSpan: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={`skeleton-row-${rIdx}`} className="border-b border-slate-100">
          <td colSpan={colSpan} className="py-4 px-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-12 rounded" />
              <Skeleton className="h-4 w-1/4 rounded" />
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-16 rounded ml-auto" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Error state with a Retry button inside a <table> <tbody>
 */
export function TableErrorState({
  colSpan,
  error = "Failed to load records from server.",
  onRetry,
}: {
  colSpan: number;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-14 text-center">
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Failed to load data
          </p>
          <p className="text-xs text-slate-500 mt-1 text-center">
            {error || "An unexpected network or server error occurred."}
          </p>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-4 gap-2 text-xs border-slate-200 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              Retry
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Empty state inside a <table> <tbody>
 */
export function TableEmptyState({
  colSpan,
  title = "No records found",
  description = "No items match your search or filter criteria.",
  actionLabel,
  onAction,
  icon,
}: {
  colSpan: number;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-14 text-center">
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
          <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-3">
            {icon || <SearchX className="w-5 h-5 text-slate-400" />}
          </div>
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          {description && (
            <p className="text-xs text-slate-400 mt-1 text-center">
              {description}
            </p>
          )}
          {actionLabel && onAction && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAction}
              className="mt-4 text-xs"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Standalone skeleton for lists/cards
 */
export function ListLoadingSkeleton({
  count = 4,
  className = "p-4 space-y-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`list-skel-${idx}`}
          className="p-4 rounded-xl border border-slate-100 bg-white space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Standalone error state for lists/cards
 */
export function ListErrorState({
  error = "Failed to load records from server.",
  onRetry,
}: {
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <p className="text-sm font-semibold text-slate-800">Failed to load data</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">
        {error || "An unexpected network or server error occurred."}
      </p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4 gap-2 text-xs border-slate-200 hover:bg-slate-50"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Standalone empty state for lists/cards
 */
export function ListEmptyState({
  title = "No records found",
  description = "No items match your search or filter criteria.",
  actionLabel,
  onAction,
  icon,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-3">
        {icon || <Package className="w-5 h-5 text-slate-400" />}
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAction}
          className="mt-4 text-xs"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * Unified helper wrapper for Table <tbody> or container
 */
export function AdminTableState({
  isLoading,
  error,
  isEmpty,
  onRetry,
  colSpan,
  loadingRows = 5,
  emptyTitle = "No records found",
  emptyDescription = "No records match your search or filters.",
  emptyActionLabel,
  onEmptyAction,
  emptyIcon,
  children,
}: AdminTableStateProps) {
  const isTable = typeof colSpan === "number";

  if (isLoading) {
    return isTable ? (
      <TableLoadingSkeleton colSpan={colSpan} rows={loadingRows} />
    ) : (
      <ListLoadingSkeleton count={loadingRows} />
    );
  }

  if (error) {
    return isTable ? (
      <TableErrorState colSpan={colSpan} error={error} onRetry={onRetry} />
    ) : (
      <ListErrorState error={error} onRetry={onRetry} />
    );
  }

  if (isEmpty) {
    return isTable ? (
      <TableEmptyState
        colSpan={colSpan}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        icon={emptyIcon}
      />
    ) : (
      <ListEmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        icon={emptyIcon}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Standard pagination bounds & text formatter
 * When total is 0: "Showing 0 results"
 * When total > 0: "Showing X to Y of Z results"
 */
export function formatPaginationText(
  page: number,
  limit: number,
  total: number,
  noun = "results"
): string {
  if (total <= 0) {
    return `Showing 0 ${noun}`;
  }
  const from = Math.max(1, (page - 1) * limit + 1);
  const to = Math.min(page * limit, total);
  return `Showing ${from} to ${to} of ${total.toLocaleString()} ${noun}`;
}

export function PaginationLabel({
  page,
  limit,
  total,
  noun = "results",
}: {
  page: number;
  limit: number;
  total: number;
  noun?: string;
}) {
  if (total <= 0) {
    return <span>Showing 0 {noun}</span>;
  }
  const from = Math.max(1, (page - 1) * limit + 1);
  const to = Math.min(page * limit, total);
  return (
    <span>
      Showing{" "}
      <span className="font-semibold text-slate-800">{from}</span> to{" "}
      <span className="font-semibold text-slate-800">{to}</span> of{" "}
      <span className="font-semibold text-slate-800">
        {total.toLocaleString()}
      </span>{" "}
      {noun}
    </span>
  );
}
