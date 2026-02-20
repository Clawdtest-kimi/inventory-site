"use client";

import { useEffect, useState, useMemo } from "react";
import { StockRow } from "@/lib/types";
import { parseStockCSV, getTotalRow } from "@/lib/csv-parser";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, RotateCcw } from "lucide-react";

// Default stock data from the CSV file
const DEFAULT_CSV = `Width (mm),6.35µ,7µ,8µ,9µ,12µ,37µ,40µ,Total,,,,,,,,
Reels (Nos),Qty (Kgs),Reels (Nos),Qty (Kgs),Reels (Nos),Qty (Kgs),Reels (Nos),Qty (Kgs),Reels (Nos),Qty (Kgs),Reels (Nos),Qty (Kgs),Reels (Nos),Qty (Kgs),Reels (Nos),Qty (Kgs),
565,,,1,266,,,,,,,,,,,1,266
700,,,,,,,44,13381,,,20,8278,,,64,21659
735,,,,,,,2,781,,,,,,,2,781
770,4,1550,,,,,,,,,,,,,4,1550
780,,,,,,,4,1640,,,,,,,4,1640
830,,,,,3,1365,,,,,,,,,3,1365
860,,,8,3571,2,998,,,,,,,,,10,4569
865,2,915,12,6752,,,,,,,,,,,14,7667
870,,,1,495,14,6977,,,,,,,,,15,7472
900,,,3,1746,,,,,,,,,,,3,1746
920,,,6,3694,4,2270,2,1208,,,,,,,12,7172
960,,,,,10,5537,,,,,,,,,10,5537
970,,,,,,,2,1269,,,,,,,2,1269
980,,,2,1085,7,3789,2,1193,,,,,,,11,6067
990,,,,,,,10,6066,,,,,,,10,6066
1010,,,10,5234,,,10,4408,1,599,10,6136,8,5963,39,22340
1020,,,,,,,3,1792,,,,,,,3,1792
1050,,,4,2042,,,,,,,,,,,4,2042
1067,5,2796,,,,,,,,,,,,,5,2796
1070,,,,,,,8,5040,,,,,,,8,5040
1080,,,,,8,4614,,,,,,,,,8,4614
1090,,,5,3035,,,,,,,,,,,5,3035
1116,11,7311,,,,,,,,,,,,,11,7311
1120,,,8,4882,4,2679,,,,,,,,,12,7561
1140,,,,,,,2,1091,,,,,,,2,1091
1160,,,,,2,1254,,,,,,,,,2,1254
1180,,,,,,,8,5458,,,,,,,8,5458
1200,2,1254,,,,,,,,,,,,,2,1254
1220,,,,,,,4,2364,,,,,,,4,2364
1445,11,7824,,,,,,,,,,,,,11,7824
Total,35,21650,60,32802,54,29483,101,45691,1,599,30,14414,8,5963,289,150602`;

const thicknessConfigs = [
  { value: "6.35", label: "6.35µ", reelsKey: "reels635" as const },
  { value: "7", label: "7µ", reelsKey: "reels7" as const },
  { value: "8", label: "8µ", reelsKey: "reels8" as const },
  { value: "9", label: "9µ", reelsKey: "reels9" as const },
  { value: "12", label: "12µ", reelsKey: "reels12" as const },
  { value: "37", label: "37µ", reelsKey: "reels37" as const },
  { value: "40", label: "40µ", reelsKey: "reels40" as const },
];

export default function HomePage() {
  const [data, setData] = useState<StockRow[]>([]);
  const [isClient, setIsClient] = useState(false);
  
  // Filter states
  const [aluType, setAluType] = useState("all");
  const [alloy, setAlloy] = useState("all");
  const [thickness, setThickness] = useState("all");
  const [width, setWidth] = useState("all");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    const saved = localStorage.getItem("inventoryData");
    
    if (saved) {
      setData(JSON.parse(saved));
    } else {
      const parsed = parseStockCSV(DEFAULT_CSV);
      setData(parsed.data);
    }
  }, []);

  // Calculate total rolls for each thickness
  const thicknessOptions = useMemo(() => {
    const options = [{ value: "all", label: "All Thicknesses", rolls: data.reduce((sum, row) => sum + row.totalReels, 0) }];
    thicknessConfigs.forEach(config => {
      const rolls = data.reduce((sum, row) => sum + (row[config.reelsKey] || 0), 0);
      options.push({ value: config.value, label: config.label, rolls });
    });
    return options;
  }, [data]);

  // Get unique widths for dropdown with roll counts for SELECTED thickness
  const widthOptions = useMemo(() => {
    const thicknessReelsMap: Record<string, keyof StockRow> = {
      "6.35": "reels635",
      "7": "reels7",
      "8": "reels8",
      "9": "reels9",
      "12": "reels12",
      "37": "reels37",
      "40": "reels40",
    };
    
    const reelsKey = thickness !== "all" ? thicknessReelsMap[thickness] : null;
    
    // Filter widths that have data for selected thickness
    let widthsWithData: { width: number; rolls: number }[] = [];
    
    data.forEach(row => {
      const rolls = reelsKey ? (row[reelsKey] as number) || 0 : row.totalReels;
      if (rolls > 0) {
        const existing = widthsWithData.find(w => w.width === row.width);
        if (existing) {
          existing.rolls += rolls;
        } else {
          widthsWithData.push({ width: row.width, rolls });
        }
      }
    });
    
    // Sort by width
    widthsWithData.sort((a, b) => a.width - b.width);
    
    // Calculate total for "All Widths"
    const allRolls = widthsWithData.reduce((sum, w) => sum + w.rolls, 0);
    
    const options = [{ value: "all", label: `All Widths (${allRolls} rolls)`, rolls: allRolls }];
    widthsWithData.forEach(w => {
      options.push({ value: w.width.toString(), label: `${w.width} mm (${w.rolls} rolls)`, rolls: w.rolls });
    });
    
    return options;
  }, [data, thickness]);

  // Filtered data
  const filteredData = useMemo(() => {
    if (!showResults) return [];
    
    return data.filter(row => {
      if (width !== "all" && row.width !== parseFloat(width)) return false;
      
      // Check if row has data for selected thickness
      if (thickness !== "all") {
        const thicknessMap: Record<string, keyof StockRow> = {
          "6.35": "qty635",
          "7": "qty7",
          "8": "qty8",
          "9": "qty9",
          "12": "qty12",
          "37": "qty37",
          "40": "qty40",
        };
        const qtyKey = thicknessMap[thickness];
        const qty = qtyKey ? (row[qtyKey] as number) || 0 : 0;
        if (qty === 0) return false;
      }
      
      return true;
    });
  }, [data, width, thickness, showResults]);

  const totalRow = getTotalRow(filteredData);

  // Determine which columns have data (for hiding empty columns)
  const visibleColumns = useMemo(() => {
    if (thickness !== "all") return []; // Single thickness view handles differently
    
    return [
      { key: "6.35", label: "6.35µ", reels: "reels635", qty: "qty635" },
      { key: "7", label: "7µ", reels: "reels7", qty: "qty7" },
      { key: "8", label: "8µ", reels: "reels8", qty: "qty8" },
      { key: "9", label: "9µ", reels: "reels9", qty: "qty9" },
      { key: "12", label: "12µ", reels: "reels12", qty: "qty12" },
      { key: "37", label: "37µ", reels: "reels37", qty: "qty37" },
      { key: "40", label: "40µ", reels: "reels40", qty: "qty40" },
    ].filter(col => {
      return filteredData.some(row => {
        const reels = (row as any)[col.reels] || 0;
        const qty = (row as any)[col.qty] || 0;
        return reels > 0 || qty > 0;
      });
    });
  }, [filteredData, thickness]);

  // Reset width when thickness changes (width might not have data for new thickness)
  useEffect(() => {
    setWidth("all");
  }, [thickness]);

  const handleSearch = () => {
    setShowResults(true);
  };

  const handleReset = () => {
    setAluType("all");
    setAlloy("all");
    setThickness("all");
    setWidth("all");
    setShowResults(false);
  };

  const getThicknessData = (row: StockRow, thick: string) => {
    const map: Record<string, { reels: number; qty: number }> = {
      "6.35": { reels: row.reels635 || 0, qty: row.qty635 || 0 },
      "7": { reels: row.reels7 || 0, qty: row.qty7 || 0 },
      "8": { reels: row.reels8 || 0, qty: row.qty8 || 0 },
      "9": { reels: row.reels9 || 0, qty: row.qty9 || 0 },
      "12": { reels: row.reels12 || 0, qty: row.qty12 || 0 },
      "37": { reels: row.reels37 || 0, qty: row.qty37 || 0 },
      "40": { reels: row.reels40 || 0, qty: row.qty40 || 0 },
    };
    return map[thick] || { reels: 0, qty: 0 };
  };

  if (!isClient) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Filter Section */}
      <Card className="mb-6 shadow-sm border-slate-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Alu Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Alu</label>
              <Select value={aluType} onValueChange={setAluType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Alu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types ({data.reduce((sum, row) => sum + row.totalReels, 0)} rolls)</SelectItem>
                  <SelectItem value="aluminium">Aluminium ({data.reduce((sum, row) => sum + row.totalReels, 0)} rolls)</SelectItem>
                  <SelectItem value="bopet">BOPET film (0 rolls)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Alloy */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Alloy</label>
              <Select value={alloy} onValueChange={setAlloy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Alloy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Alloys ({data.reduce((sum, row) => sum + row.totalReels, 0)} rolls)</SelectItem>
                  <SelectItem value="8079-8011">Alloy 8079, 8011 ({data.reduce((sum, row) => sum + row.totalReels, 0)} rolls)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Thickness */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Thickness</label>
              <Select value={thickness} onValueChange={setThickness}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Thickness" />
                </SelectTrigger>
                <SelectContent>
                  {thicknessOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label} ({opt.rolls} rolls)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Width */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Width</label>
              <Select value={width} onValueChange={setWidth}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Width" />
                </SelectTrigger>
                <SelectContent>
                  {widthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Button */}
            <div className="space-y-2 flex flex-col justify-end">
              <div className="flex gap-2">
                <Button onClick={handleSearch} className="flex-1">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
                <Button variant="outline" onClick={handleReset} size="icon">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      {showResults && (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Search Results ({filteredData.length} items)
              </h2>
              {thickness !== "all" && (
                <div className="text-sm text-slate-600">
                  Showing data for <span className="font-medium">{thickness}µ</span> thickness
                </div>
              )}
            </div>

            {filteredData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold text-slate-900">Width (mm)</TableHead>
                      {thickness === "all" ? (
                        visibleColumns.length > 0 ? (
                          visibleColumns.map(col => (
                            <>
                              <TableHead key={`${col.key}-reels`} className="text-center">{col.label} Reels</TableHead>
                              <TableHead key={`${col.key}-qty`} className="text-center">{col.label} Qty (kg)</TableHead>
                            </>
                          ))
                        ) : (
                          // Fallback: show all columns if none detected
                          <>
                            <TableHead className="text-center">6.35µ Reels</TableHead>
                            <TableHead className="text-center">6.35µ Qty (kg)</TableHead>
                            <TableHead className="text-center">7µ Reels</TableHead>
                            <TableHead className="text-center">7µ Qty (kg)</TableHead>
                            <TableHead className="text-center">8µ Reels</TableHead>
                            <TableHead className="text-center">8µ Qty (kg)</TableHead>
                            <TableHead className="text-center">9µ Reels</TableHead>
                            <TableHead className="text-center">9µ Qty (kg)</TableHead>
                            <TableHead className="text-center">12µ Reels</TableHead>
                            <TableHead className="text-center">12µ Qty (kg)</TableHead>
                            <TableHead className="text-center">37µ Reels</TableHead>
                            <TableHead className="text-center">37µ Qty (kg)</TableHead>
                            <TableHead className="text-center">40µ Reels</TableHead>
                            <TableHead className="text-center">40µ Qty (kg)</TableHead>
                          </>
                        )
                      ) : (
                        <>
                          <TableHead className="text-center">Reels</TableHead>
                          <TableHead className="text-center">Qty (kg)</TableHead>
                        </>
                      )}
                      <TableHead className="text-center font-bold">Total Reels</TableHead>
                      <TableHead className="text-center font-bold">Total Qty (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((row, index) => (
                      <TableRow key={row.width} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <TableCell className="font-medium">{row.width}</TableCell>
                        {thickness === "all" ? (
                          visibleColumns.length > 0 ? (
                            visibleColumns.map(col => (
                              <>
                                <TableCell key={`${row.width}-${col.key}-reels`} className="text-center">{(row as any)[col.reels] || "-"}</TableCell>
                                <TableCell key={`${row.width}-${col.key}-qty`} className="text-center">{(row as any)[col.qty]?.toLocaleString() || "-"}</TableCell>
                              </>
                            ))
                          ) : (
                            <>
                              <TableCell className="text-center">{row.reels635 || "-"}</TableCell>
                              <TableCell className="text-center">{row.qty635?.toLocaleString() || "-"}</TableCell>
                              <TableCell className="text-center">{row.reels7 || "-"}</TableCell>
                              <TableCell className="text-center">{row.qty7?.toLocaleString() || "-"}</TableCell>
                              <TableCell className="text-center">{row.reels8 || "-"}</TableCell>
                              <TableCell className="text-center">{row.qty8?.toLocaleString() || "-"}</TableCell>
                              <TableCell className="text-center">{row.reels9 || "-"}</TableCell>
                              <TableCell className="text-center">{row.qty9?.toLocaleString() || "-"}</TableCell>
                              <TableCell className="text-center">{row.reels12 || "-"}</TableCell>
                              <TableCell className="text-center">{row.qty12?.toLocaleString() || "-"}</TableCell>
                              <TableCell className="text-center">{row.reels37 || "-"}</TableCell>
                              <TableCell className="text-center">{row.qty37?.toLocaleString() || "-"}</TableCell>
                              <TableCell className="text-center">{row.reels40 || "-"}</TableCell>
                              <TableCell className="text-center">{row.qty40?.toLocaleString() || "-"}</TableCell>
                            </>
                          )
                        ) : (
                          <>
                            <TableCell className="text-center">{getThicknessData(row, thickness).reels || "-"}</TableCell>
                            <TableCell className="text-center">{getThicknessData(row, thickness).qty.toLocaleString() || "-"}</TableCell>
                          </>
                        )}
                        <TableCell className="text-center font-semibold">{row.totalReels}</TableCell>
                        <TableCell className="text-center font-semibold">{row.totalQty.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                      <TableCell>Total</TableCell>
                      {thickness === "all" ? (
                        visibleColumns.length > 0 ? (
                          visibleColumns.map(col => (
                            <>
                              <TableCell key={`total-${col.key}-reels`} className="text-center">{(totalRow as any)[col.reels] || "-"}</TableCell>
                              <TableCell key={`total-${col.key}-qty`} className="text-center">{(totalRow as any)[col.qty]?.toLocaleString() || "-"}</TableCell>
                            </>
                          ))
                        ) : (
                          <>
                            <TableCell className="text-center">{totalRow.reels635 || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.qty635?.toLocaleString() || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.reels7 || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.qty7?.toLocaleString() || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.reels8 || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.qty8?.toLocaleString() || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.reels9 || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.qty9?.toLocaleString() || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.reels12 || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.qty12?.toLocaleString() || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.reels37 || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.qty37?.toLocaleString() || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.reels40 || "-"}</TableCell>
                            <TableCell className="text-center">{totalRow.qty40?.toLocaleString() || "-"}</TableCell>
                          </>
                        )
                      ) : (
                        <>
                          <TableCell className="text-center">-</TableCell>
                          <TableCell className="text-center">-</TableCell>
                        </>
                      )}
                      <TableCell className="text-center">{totalRow.totalReels.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{totalRow.totalQty.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg">No results found for the selected filters.</p>
                <p className="text-sm mt-2">Try adjusting your search criteria.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!showResults && (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Select filters and click Search to view inventory</p>
        </div>
      )}
    </div>
  );
}
