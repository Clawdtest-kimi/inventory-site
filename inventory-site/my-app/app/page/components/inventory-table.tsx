import { StockRow } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InventoryTableProps {
  data: StockRow[];
  totalRow: StockRow;
}

function formatNumber(num: number): string {
  return num > 0 ? num.toLocaleString() : "-";
}

export function InventoryTable({ data, totalRow }: InventoryTableProps) {
  const micronColumns = [
    { label: "6.35µ", reels: "reels635", qty: "qty635" },
    { label: "7µ", reels: "reels7", qty: "qty7" },
    { label: "8µ", reels: "reels8", qty: "qty8" },
    { label: "9µ", reels: "reels9", qty: "qty9" },
    { label: "12µ", reels: "reels12", qty: "qty12" },
    { label: "37µ", reels: "reels37", qty: "qty37" },
    { label: "40µ", reels: "reels40", qty: "qty40" },
  ] as const;

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
