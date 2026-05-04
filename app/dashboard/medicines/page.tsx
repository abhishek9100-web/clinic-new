"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pill, Plus, Upload, Search, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getMedicines, addMedicine, addMedicines, type Medicine } from "@/components/api";
import * as XLSX from "xlsx";

export default function MedicineManagementPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    name: "", schedule: "", batchNumber: "", pricePerTablet: "0.00", tabletsPerSheet: "10", sheetsPerPack: "1",
    category: "Tablet", manufacturer: "", expiryDate: "", stockQuantity: "0", description: "",
  });

  const loadMedicines = async () => {
    try {
      const data = await getMedicines();
      setMedicines(data || []);
    } catch (error) {
      toast.error("Failed to load medicines");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedicines();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMedicine({
        name: form.name,
        schedule: form.schedule,
        batchNumber: form.batchNumber,
        pricePerTablet: Number(form.pricePerTablet),
        tabletsPerSheet: Number(form.tabletsPerSheet),
        sheetsPerPack: Number(form.sheetsPerPack),
        category: form.category,
        manufacturer: form.manufacturer,
        expiryDate: form.expiryDate,
        stockQuantity: Number(form.stockQuantity),
        description: form.description,
      } as any);

      toast.success("Medicine added successfully");
      setForm({ name: "", schedule: "", batchNumber: "", pricePerTablet: "0.00", tabletsPerSheet: "10", sheetsPerPack: "1", category: "Tablet", manufacturer: "", expiryDate: "", stockQuantity: "0", description: "" });
      setOpen(false);
      loadMedicines(); // Refresh the list
    } catch (error) {
      toast.error("Failed to add medicine");
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        
        const meds = data.map((row) => ({
          name: String(row["PRODUCT NAME"] || row["Medicine Name"] || row["name"] || ""),
          schedule: String(row["SCH"] || row["Schedule"] || row["schedule"] || ""),
          batchNumber: String(row["BATCH"] || row["Batch Number"] || row["batchNumber"] || ""),
          manufacturer: String(row["MFG"] || row["Manufacturer"] || row["manufacturer"] || ""),
          pricePerTablet: Number(row["RATE"] || row["Price per Tablet"] || row["pricePerTablet"] || 0),
          expiryDate: String(row["EXPIRY"] || row["Expiry Date"] || row["expiryDate"] || ""),
          stockQuantity: Number(row["QTY"] || row["Stock Quantity"] || row["stockQuantity"] || 0),
          tabletsPerSheet: Number(row["Tablets per Sheet"] || row["tabletsPerSheet"] || 10),
          sheetsPerPack: Number(row["Sheets per Pack"] || row["sheetsPerPack"] || 1),
          category: String(row["Category"] || row["category"] || "Tablet"),
          description: String(row["Description"] || row["description"] || ""),
        })).filter((m) => m.name);
        
        await addMedicines(meds as any);
        toast.success(`${meds.length} medicines imported from Excel`);
        loadMedicines(); // Refresh the list
      } catch (error) {
        toast.error("Failed to import medicines from Excel");
      }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const filtered = medicines.filter((m) => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.category.toLowerCase().includes(search.toLowerCase())
  );
  
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading Medicine Inventory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Pill className="h-6 w-6 text-primary" /> Medicine Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Add, search, and import medicines</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import Excel
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add Medicine</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Medicine</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>PRODUCT NAME *</Label><Input placeholder="e.g. DYPHASTON-TAB" value={form.name} onChange={(e) => set("name", e.target.value)} required /></div>
                  <div className="space-y-2"><Label>SCH (Schedule)</Label><Input placeholder="e.g. H" value={form.schedule} onChange={(e) => set("schedule", e.target.value)} /></div>
                  <div className="space-y-2"><Label>MFG (Manufacturer)</Label><Input placeholder="e.g. AB" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></div>
                  <div className="space-y-2"><Label>BATCH No. *</Label><Input placeholder="e.g. SAVA5042" value={form.batchNumber} onChange={(e) => set("batchNumber", e.target.value)} required /></div>
                  <div className="space-y-2"><Label>EXPIRY (MM/YYYY) *</Label><Input placeholder="e.g. 8/2028" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} required /></div>
                  <div className="space-y-2"><Label>RATE (₹) *</Label><Input type="number" step="0.01" value={form.pricePerTablet} onChange={(e) => set("pricePerTablet", e.target.value)} required /></div>
                  <div className="space-y-2"><Label>QTY (Stock) *</Label><Input type="number" value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value)} required /></div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => set("category", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Drops", "Inhaler", "Other"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Tablets per Sheet</Label><Input type="number" value={form.tabletsPerSheet} onChange={(e) => set("tabletsPerSheet", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Sheets per Pack</Label><Input type="number" value={form.sheetsPerPack} onChange={(e) => set("sheetsPerPack", e.target.value)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Additional details about the medicine..." value={form.description} onChange={(e) => set("description", e.target.value)} />
                </div>
                <div className="flex gap-3 justify-end border-t border-border pt-4 mt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit"><Pill className="h-4 w-4 mr-1" /> Add Medicine</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search medicines..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm">
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No medicines found. Add or import medicines to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">S.NO (ID)</th>
                    <th className="pb-3 font-medium text-muted-foreground">PRODUCT NAME</th>
                    <th className="pb-3 font-medium text-muted-foreground">SCH</th>
                    <th className="pb-3 font-medium text-muted-foreground">MFG</th>
                    <th className="pb-3 font-medium text-muted-foreground">BATCH</th>
                    <th className="pb-3 font-medium text-muted-foreground">EXPIRY</th>
                    <th className="pb-3 font-medium text-muted-foreground">QTY</th>
                    <th className="pb-3 font-medium text-muted-foreground">RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, idx) => (
                    <tr key={m.id || m.customId || idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 font-mono text-xs">{idx + 1} ({m.id || m.customId})</td>
                      <td className="py-3 font-medium">{m.name}</td>
                      <td className="py-3">{(m as any).schedule || "—"}</td>
                      <td className="py-3">{m.manufacturer || "—"}</td>
                      <td className="py-3 font-mono text-xs">{(m as any).batchNumber || "—"}</td>
                      <td className="py-3">{typeof m.expiryDate === 'string' ? m.expiryDate.split('T')[0] : "—"}</td>
                      <td className="py-3">{m.stockQuantity}</td>
                      <td className="py-3">{m.pricePerTablet?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}