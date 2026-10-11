"use client";

import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ChevronDown, ChevronUp, MoreVertical, SearchX } from "lucide-react";
import { TableAction, StatusVariant } from "@/types/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageSize?: number;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 10,
  isLoading = false,
  emptyState,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
      <div className="overflow-x-auto w-full">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead 
                      key={header.id} 
                      className="h-12 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : (
                        <div 
                          className={header.column.getCanSort() ? "cursor-pointer select-none flex items-center gap-1 hover:text-slate-800" : ""}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: <ChevronUp className="w-3.5 h-3.5" />,
                            desc: <ChevronDown className="w-3.5 h-3.5" />,
                          }[header.column.getIsSorted() as string] ?? 
                            (header.column.getCanSort() ? <ArrowUpDown className="w-3.5 h-3.5 opacity-40" /> : null)}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading State
              Array.from({ length: pageSize }).map((_, idx) => (
                <TableRow key={idx}>
                  {columns.map((_, colIdx) => (
                    <TableCell key={colIdx} className="px-4 py-4">
                      <Skeleton className="h-5 w-full max-w-[120px] rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              // Data Rows
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-slate-50/50 border-slate-100 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-4 text-sm text-slate-700">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              // Empty State
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-[400px] text-center"
                >
                  {emptyState || (
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <SearchX className="w-12 h-12 text-slate-300" />
                      <p className="text-lg font-medium text-slate-600">No records found</p>
                      <p className="text-sm">Try adjusting your filters or search query.</p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && table.getRowModel().rows?.length > 0 && (
        <div className="border-t border-slate-100 bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            {data.length === 0 ? (
              "Showing 0 results"
            ) : (
              <>
                Showing <span className="font-medium text-slate-800">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="font-medium text-slate-800">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length)}</span> of <span className="font-medium text-slate-800">{data.length}</span> results
              </>
            )}
          </div>
          <Pagination className="justify-end sm:justify-end">
            <PaginationContent>
              <PaginationItem>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="h-8 border-slate-200 text-slate-600 disabled:opacity-50"
                >
                  Previous
                </Button>
              </PaginationItem>
              <PaginationItem className="hidden sm:inline-block">
                <span className="text-sm text-slate-600 px-4">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="h-8 border-slate-200 text-slate-600 disabled:opacity-50"
                >
                  Next
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// HELPER COMPONENTS FOR COLUMNS
// ----------------------------------------------------------------------------

export function StatusBadge({ status, type = "success" }: { status: string, type?: StatusVariant }) {
  const styles: Record<StatusVariant, string> = {
    default: "bg-slate-50 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    notice: "bg-orange-50 text-orange-700 border-orange-200",
  };
  
  const dotStyles: Record<StatusVariant, string> = {
    default: "bg-slate-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-blue-500",
    notice: "bg-orange-500",
  };

  return (
    <Badge variant="outline" className={`px-2.5 py-0.5 border-none font-semibold ${styles[type]}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${dotStyles[type]}`}></span>
      {status}
    </Badge>
  );
}

export function ActionDropdown({ actions, rowData }: { actions: TableAction[], rowData: unknown }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-800 hover:bg-slate-100">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-lg border-slate-100">
        {actions.map((action, i) => (
          <DropdownMenuItem 
            key={i} 
            disabled={action.disabled}
            onClick={() => !action.disabled && action.onClick(rowData)}
            className={`flex items-center gap-2 cursor-pointer ${action.variant === 'destructive' ? 'text-red-600 focus:text-red-700 focus:bg-red-50' : 'text-slate-700 focus:bg-slate-50'}`}
          >
            {action.icon && <span className="w-4 h-4">{action.icon}</span>}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
