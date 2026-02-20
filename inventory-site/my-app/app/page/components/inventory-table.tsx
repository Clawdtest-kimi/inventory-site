"use client";

import { StockRow } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemo } from "react";

interface InventoryTableProps {
  data: StockRow[];
  totalRow: StockRow;
}

function formatNumber(num: number): string {
  return num > 0 ? num.toLocaleString() : "-";
}

export function InventoryTable({ data, totalRow }: InventoryTableProps) {
  const allMicronColumns = [
    { label: "6.35µ", reels: "reels635" as const, qty: "qty635" as const },
    { label: "7µ", reels: "reels7" as const, qty: "qty7" as const },
    { label: "8µ", reels: "reels8" as const, qty: "qty8" as const },
    { label: "9µ", reels: "reels9" as const, qty: "qty9" as const },
    { label: "12µ", reels: "reels12" as const, qty: "qty12" as const },
    { label: "37µ", reels: "reels37" as const, qty: "qty37" as const },
    { label: "40µ", reels: "reels40" as const, qty: "qty40" as const },
  ];

  // Determine which columns have actual data (not all zeros)
  const visibleColumns = useMemo(() => {
    return allMicronColumns.filter(col => {
      // Check if any row has data for this column
      return data.some(row => {
        const reels = row[col.reels] || 0;
        const qty = row[col.qty] || 0;
        return reels > 0 || qty > 0;
      });
    });
  }, [data]);

  // If no columns have data, show all (fallback)
  const micronColumns = visibleColumns.length > 0 ? visibleColumns : allMicronColumns;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead 
                rowSpan={2} 
                className="text-slate-900 font-bold border-r border-slate-200 text-center align-middle"
              >
                Width<br/>(mm)
              </TableHead>
              {micronColumns.map((col) => (
                <TableHead 
                  key={col.label}
                  colSpan={2}
                  className="text-center text-slate-900 font-bold border-r border-slate-200"
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead 
                colSpan={2}
                className="text-center text-slate-900 font-bold bg-slate-200"
              >
                Total
              </TableHead>
            </TableRow>
            <TableRow className="bg-slate-50">
              {micronColumns.map((col) => (
                <>
                  <TableHead 
                    key={`${col.label}-reels`}
                    className="text-xs text-slate-600 text-center border-r border-slate-100"
                  >
                    Reels
                  </TableHead>
                  <TableHead 
                    key={`${col.label}-qty`}
                    className="text-xs text-slate-600 text-center border-r border-slate-200"
                  >
                    Qty
                  </TableHead>
                </>
              ))}
              <TableHead className="text-xs text-slate-600 text-center bg-slate-100">
                Reels
              </TableHead>
              <TableHead className="text-xs text-slate-600 text-center bg-slate-100">
                Qty
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow 
                key={row.width} 
                className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
              >
                <TableCell className="font-medium text-slate-900 border-r border-slate-200 text-center">
                  {row.width}
                </TableCell>
                {micronColumns.map((col) => (
                  <>
                    <TableCell 
                      key={`${row.width}-${col.label}-reels`}
                      className="text-center text-slate-600 border-r border-slate-100 tabular-nums"
                    >
                      {formatNumber(row[col.reels] || 0)}
                    </TableCell>
                    <TableCell 
                      key={`${row.width}-${col.label}-qty`}
                      className="text-center text-slate-600 border-r border-slate-200 tabular-nums"
                    >
                      {formatNumber(row[col.qty] || 0)}
                    </TableCell>
                  </>
                ))}
                <TableCell className="text-center font-semibold text-slate-900 bg-slate-50 tabular-nums">
                  {formatNumber(row.totalReels)}
                </TableCell>
                <TableCell className="text-center font-semibold text-slate-900 bg-slate-50 tabular-nums">
                  {formatNumber(row.totalQty)}
                </TableCell>
              </TableRow>
            ))}
            {/* Total Row */}
            <TableRow className="bg-slate-200 font-bold border-t-2 border-slate-300">
              <TableCell className="text-slate-900 border-r border-slate-300 text-center">
                Total
              </TableCell>
              {micronColumns.map((col) => (
                <>
                  <TableCell 
                    key={`total-${col.label}-reels`}
                    className="text-center text-slate-900 border-r border-slate-200 tabular-nums"
                  >
                    {formatNumber((totalRow as any)[col.reels] || 0)}
                  </TableCell>
                  <TableCell 
                    key={`total-${col.label}-qty`}
                    className="text-center text-slate-900 border-r border-slate-300 tabular-nums"
                  >
                    {formatNumber((totalRow as any)[col.qty] || 0)}
                  </TableCell>
                </>
              ))}
              <TableCell className="text-center text-slate-900 bg-slate-300 tabular-nums">
                {formatNumber(totalRow.totalReels)}
              </TableCell>
              <TableCell className="text-center text-slate-900 bg-slate-300 tabular-nums">
                {formatNumber(totalRow.totalQty)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
