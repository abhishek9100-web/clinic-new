"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Pill,
  Plus,
  Search,
  Loader2,
  ImageIcon,
  FileSpreadsheet,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  getMedicines,
  addMedicine,
  addMedicines,
  updateMedicine,
  deleteMedicine,
  type Medicine,
} from "@/components/api";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MedicineDraft {
  _key: string;
  name: string;
  schedule: string;
  batchNumber: string;
  manufacturer: string;
  pricePerTablet: string;
  expiryDate: string;   // display string, e.g. "12/27" or "01/12/2027"
  stockQuantity: string;
  tabletsPerSheet: string;
  sheetsPerPack: string;
  category: string;
  description: string;
  hsn: string;
  mrp: string;
  gst: string;
  dis: string;
  pack: string;
  amt: string;
  free: string;
}

const CATEGORIES = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Cream",
  "Drops",
  "Inhaler",
  "Other",
];

const mkKey = () => Math.random().toString(36).slice(2);

const emptyDraft = (): MedicineDraft => ({
  _key: mkKey(),
  name: "",
  schedule: "",
  batchNumber: "",
  manufacturer: "",
  pricePerTablet: "0.00",
  expiryDate: "",
  stockQuantity: "0",
  tabletsPerSheet: "10",
  sheetsPerPack: "1",
  category: "Tablet",
  description: "",
  hsn: "",
  mrp: "",
  gst: "",
  dis: "0.00",
  pack: "",
  amt: "",
  free: "",
});

// ─── Expiry Date Parsing ──────────────────────────────────────────────────────
/**
 * Accepts several common formats and always returns an ISO date string
 * (YYYY-MM-DD) or empty string if unparseable.
 *
 * Supported input formats:
 *   "12/27"        → MM/YY (pharmacy invoice shorthand) → 2027-12-01
 *   "1/28"         → M/YY                               → 2028-01-01
 *   "12/2027"      → MM/YYYY                            → 2027-12-01
 *   "01/12/2027"   → DD/MM/YYYY                         → 2027-12-01
 *   "1/12/2027"    → D/MM/YYYY                          → 2027-12-01
 *   "2027-12-01"   → already ISO, pass through
 *   Any Date ISO string from DB is also handled via the Date object path.
 */
export function parseExpiryToISO(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";

  // Already ISO date (YYYY-MM-DD or full ISO from DB)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const parts = s.split("/");

  if (parts.length === 2) {
    const [a, b] = parts;
    // MM/YY  (year ≤ 2 digits)
    if (b.length <= 2) {
      const month = a.padStart(2, "0");
      const year = parseInt(b, 10) + 2000;
      return `${year}-${month}-01`;
    }
    // MM/YYYY
    if (b.length === 4) {
      const month = a.padStart(2, "0");
      return `${b}-${month}-01`;
    }
  }

  if (parts.length === 3) {
    // DD/MM/YYYY
    const [d, m, y] = parts;
    if (y.length === 4) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // MM/DD/YYYY (US) — only if d > 12 could indicate day; we default DD/MM/YYYY
    if (y.length === 4) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  return "";
}

/** Format ISO date string for display: "Dec 2027" */
export function formatExpiry(isoOrRaw: string | Date | undefined | null): string {
  if (!isoOrRaw) return "—";
  const s = typeof isoOrRaw === "string" ? isoOrRaw : isoOrRaw.toISOString();
  const iso = parseExpiryToISO(s) || s;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(isoOrRaw).split("T")[0] || "—";
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function col(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  return "";
}

function inferCategory(name: string): string {
  const n = name.toUpperCase();
  if (n.includes(" TAB") || n.endsWith("-TAB") || n.includes("-TAB ")) return "Tablet";
  if (n.includes("CAPS") || n.includes("CAP ") || n.endsWith("-CAP")) return "Capsule";
  if (n.includes("SYP") || n.includes("SYRUP")) return "Syrup";
  if (n.includes(" INJ") || n.includes("-INJ") || n.includes("AMP")) return "Injection";
  if (n.includes("CREAM") || n.includes("CREP") || n.includes("GEL")) return "Cream";
  if (n.includes("DROP") || n.includes("EYE") || n.includes("EAR")) return "Drops";
  if (n.includes("INHALER") || n.includes("ROTACAP")) return "Inhaler";
  return "Tablet";
}

/** Convert draft to API payload — expiryDate always sent as ISO string */
function toApiPayload(d: MedicineDraft) {
  return {
    name: d.name.trim(),
    schedule: d.schedule,
    batchNumber: d.batchNumber,
    manufacturer: d.manufacturer,
    pricePerTablet: parseFloat(d.pricePerTablet) || 0,
    expiryDate: parseExpiryToISO(d.expiryDate) || d.expiryDate,
    stockQuantity: parseInt(d.stockQuantity) || 0,
    tabletsPerSheet: parseInt(d.tabletsPerSheet) || 10,
    sheetsPerPack: parseInt(d.sheetsPerPack) || 1,
    category: d.category,
    description: d.description,
    pack: d.pack,
    hsn: d.hsn,
    mrp: parseFloat(d.mrp) || 0,
    gst: parseFloat(d.gst) || 0,
    dis: parseFloat(d.dis) || 0,
    amt: parseFloat(d.amt) || 0,
    free: parseInt(d.free) || 0,
  };
}

/** Convert a Medicine record back into a draft for editing */
function medicineToEditable(m: Medicine & Record<string, any>): MedicineDraft {
  const expiry = m.expiryDate
    ? typeof m.expiryDate === "string"
      ? m.expiryDate.split("T")[0]
      : new Date(m.expiryDate).toISOString().split("T")[0]
    : "";

  return {
    _key: mkKey(),
    name: m.name || "",
    schedule: m.schedule || "",
    batchNumber: m.batchNumber || "",
    manufacturer: m.manufacturer || "",
    pricePerTablet: String(m.pricePerTablet ?? "0"),
    expiryDate: expiry,
    stockQuantity: String(m.stockQuantity ?? "0"),
    tabletsPerSheet: String(m.tabletsPerSheet ?? "10"),
    sheetsPerPack: String(m.sheetsPerPack ?? "1"),
    category: m.category || "Tablet",
    description: m.description || "",
    pack: m.pack || "",
    hsn: m.hsn || "",
    mrp: String(m.mrp ?? ""),
    gst: String(m.gst ?? ""),
    dis: String(m.dis ?? "0"),
    amt: String(m.amt ?? ""),
    free: String(m.free ?? "0"),
  };
}

// ─── Editable Row ─────────────────────────────────────────────────────────────
function EditableRow({
  draft,
  onChange,
  onDelete,
}: {
  draft: MedicineDraft;
  onChange: (u: MedicineDraft) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = (k: keyof MedicineDraft, v: string) => onChange({ ...draft, [k]: v });

  return (
    <div className="border border-border rounded-lg mb-2 overflow-hidden text-sm">
      {/* Collapsed row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-4"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <div className="flex flex-col gap-0.5 flex-[2] min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5">Product Name *</span>
          <Input className="h-7 text-xs" placeholder="e.g. ASCODEX LS" value={draft.name} onChange={(e) => s("name", e.target.value)} />
        </div>

        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5">Batch No.</span>
          <Input className="h-7 text-xs" placeholder="e.g. P2EEY019" value={draft.batchNumber} onChange={(e) => s("batchNumber", e.target.value)} />
        </div>

        <div className="flex flex-col gap-0.5 w-24 flex-shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5">Expiry</span>
          <Input
            className="h-7 text-xs"
            placeholder="MM/YY or DD/MM/YYYY"
            value={draft.expiryDate}
            onChange={(e) => s("expiryDate", e.target.value)}
          />
          {draft.expiryDate && parseExpiryToISO(draft.expiryDate) && (
            <span className="text-[9px] text-primary px-0.5">
              → {formatExpiry(draft.expiryDate)}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-0.5 w-20 flex-shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5">Rate (₹)</span>
          <Input className="h-7 text-xs" placeholder="0.00" type="number" value={draft.pricePerTablet} onChange={(e) => s("pricePerTablet", e.target.value)} />
        </div>

        <div className="flex flex-col gap-0.5 w-16 flex-shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5">Qty</span>
          <Input className="h-7 text-xs" placeholder="0" type="number" value={draft.stockQuantity} onChange={(e) => s("stockQuantity", e.target.value)} />
        </div>

        <button type="button" onClick={onDelete} className="text-destructive hover:text-destructive/70 transition-colors flex-shrink-0 mt-4">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 border-t border-border bg-background">
          <div className="space-y-1">
            <Label className="text-xs">Schedule</Label>
            <Input className="h-7 text-xs" value={draft.schedule} onChange={(e) => s("schedule", e.target.value)} placeholder="e.g. H" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Manufacturer</Label>
            <Input className="h-7 text-xs" value={draft.manufacturer} onChange={(e) => s("manufacturer", e.target.value)} placeholder="e.g. ALKEM" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pack</Label>
            <Input className="h-7 text-xs" value={draft.pack} onChange={(e) => s("pack", e.target.value)} placeholder="e.g. 10'S" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">HSN</Label>
            <Input className="h-7 text-xs" value={draft.hsn} onChange={(e) => s("hsn", e.target.value)} placeholder="HSN Code" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">MRP (₹)</Label>
            <Input className="h-7 text-xs" type="number" value={draft.mrp} onChange={(e) => s("mrp", e.target.value)} placeholder="MRP" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">GST %</Label>
            <Input className="h-7 text-xs" type="number" value={draft.gst} onChange={(e) => s("gst", e.target.value)} placeholder="5" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Discount %</Label>
            <Input className="h-7 text-xs" type="number" value={draft.dis} onChange={(e) => s("dis", e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Free Qty</Label>
            <Input className="h-7 text-xs" type="number" value={draft.free} onChange={(e) => s("free", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">AMT (₹)</Label>
            <Input className="h-7 text-xs" type="number" value={draft.amt} onChange={(e) => s("amt", e.target.value)} placeholder="Total amount" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={draft.category} onValueChange={(v) => s("category", v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tablets/Sheet</Label>
            <Input className="h-7 text-xs" type="number" value={draft.tabletsPerSheet} onChange={(e) => s("tabletsPerSheet", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sheets/Pack</Label>
            <Input className="h-7 text-xs" type="number" value={draft.sheetsPerPack} onChange={(e) => s("sheetsPerPack", e.target.value)} />
          </div>
          <div className="col-span-2 md:col-span-4 space-y-1">
            <Label className="text-xs">Description / Notes</Label>
            <Textarea className="text-xs min-h-[48px]" value={draft.description} onChange={(e) => s("description", e.target.value)} placeholder="Additional notes..." />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
function PreviewModal({
  open, onClose, drafts, onDraftsChange, onConfirm, isSubmitting,
  title, subtitle, previewImageUrl,
}: {
  open: boolean; onClose: () => void; drafts: MedicineDraft[];
  onDraftsChange: (d: MedicineDraft[]) => void; onConfirm: () => void;
  isSubmitting: boolean; title: string; subtitle?: string; previewImageUrl?: string;
}) {
  const validCount = drafts.filter((d) => d.name.trim()).length;
  const updateDraft = (key: string, updated: MedicineDraft) =>
    onDraftsChange(drafts.map((d) => (d._key === key ? updated : d)));
  const deleteDraft = (key: string) =>
    onDraftsChange(drafts.filter((d) => d._key !== key));
  const addRow = () => onDraftsChange([...drafts, emptyDraft()]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary">{validCount} valid</Badge>
              <Badge variant="outline">{drafts.length} total</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {previewImageUrl && (
            <div className="rounded-lg border border-border overflow-hidden bg-muted/20 max-h-52">
              <img src={previewImageUrl} alt="Uploaded invoice" className="w-full object-contain max-h-52" />
            </div>
          )}
          {drafts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No medicines extracted. Add rows manually below.</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                Review and edit all data. Expiry accepts <strong>MM/YY</strong> (e.g. 12/27) or <strong>DD/MM/YYYY</strong> (e.g. 01/12/2027). A preview of the parsed date shows below the field.
              </p>
              {drafts.map((d) => (
                <EditableRow key={d._key} draft={d} onChange={(u) => updateDraft(d._key, u)} onDelete={() => deleteDraft(d._key)} />
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-1" /> Add Row Manually
          </Button>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isSubmitting || validCount === 0} className="min-w-36">
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" /> Import {validCount} Medicine{validCount !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditMedicineModal({
  medicine, open, onClose, onSaved,
}: {
  medicine: (Medicine & Record<string, any>) | null;
  open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<MedicineDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (medicine) setForm(medicineToEditable(medicine));
  }, [medicine]);

  const s = (k: keyof MedicineDraft, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!medicine) return;
    setSaving(true);
    try {
      await updateMedicine(medicine.id || medicine._id, toApiPayload(form));
      toast.success("Medicine updated");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to update medicine");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Medicine</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input value={form.name} onChange={(e) => s("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Schedule</Label>
              <Input value={form.schedule} onChange={(e) => s("schedule", e.target.value)} placeholder="e.g. H" />
            </div>
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input value={form.manufacturer} onChange={(e) => s("manufacturer", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Batch No.</Label>
              <Input value={form.batchNumber} onChange={(e) => s("batchNumber", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>
                Expiry
                {form.expiryDate && parseExpiryToISO(form.expiryDate) && (
                  <span className="ml-2 text-xs text-primary font-normal">→ {formatExpiry(form.expiryDate)}</span>
                )}
              </Label>
              <Input
                value={form.expiryDate}
                onChange={(e) => s("expiryDate", e.target.value)}
                placeholder="MM/YY or DD/MM/YYYY"
              />
            </div>
            <div className="space-y-2">
              <Label>Rate (₹)</Label>
              <Input type="number" step="0.01" value={form.pricePerTablet} onChange={(e) => s("pricePerTablet", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Stock Qty</Label>
              <Input type="number" value={form.stockQuantity} onChange={(e) => s("stockQuantity", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pack</Label>
              <Input value={form.pack} onChange={(e) => s("pack", e.target.value)} placeholder="e.g. 10'S" />
            </div>
            <div className="space-y-2">
              <Label>HSN</Label>
              <Input value={form.hsn} onChange={(e) => s("hsn", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>MRP (₹)</Label>
              <Input type="number" value={form.mrp} onChange={(e) => s("mrp", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>GST %</Label>
              <Input type="number" value={form.gst} onChange={(e) => s("gst", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Discount %</Label>
              <Input type="number" value={form.dis} onChange={(e) => s("dis", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Free Qty</Label>
              <Input type="number" value={form.free} onChange={(e) => s("free", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>AMT (₹)</Label>
              <Input type="number" value={form.amt} onChange={(e) => s("amt", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => s("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tablets/Sheet</Label>
              <Input type="number" value={form.tabletsPerSheet} onChange={(e) => s("tabletsPerSheet", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sheets/Pack</Label>
              <Input type="number" value={form.sheetsPerPack} onChange={(e) => s("sheetsPerPack", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => s("description", e.target.value)} />
          </div>

          <div className="flex gap-3 justify-end border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Check className="h-4 w-4 mr-2" />Save Changes</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirmDialog({
  medicine, open, onClose, onDeleted,
}: {
  medicine: (Medicine & Record<string, any>) | null;
  open: boolean; onClose: () => void; onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!medicine) return;
    setDeleting(true);
    try {
      await deleteMedicine(medicine.id || medicine._id);
      toast.success(`"${medicine.name}" deleted`);
      onDeleted();
      onClose();
    } catch {
      toast.error("Failed to delete medicine");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Medicine?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mt-1">
          Are you sure you want to delete <strong>{medicine?.name}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : <><Trash2 className="h-4 w-4 mr-2" />Delete</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MedicineManagementPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Single add modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyDraft());

  // Edit modal
  const [editTarget, setEditTarget] = useState<(Medicine & Record<string, any>) | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<(Medicine & Record<string, any>) | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Image import
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | undefined>();
  const [imageExtracting, setImageExtracting] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageDrafts, setImageDrafts] = useState<MedicineDraft[]>([]);
  const [imageSubmitting, setImageSubmitting] = useState(false);

  // Excel import
  const excelFileRef = useRef<HTMLInputElement>(null);
  const [excelPreviewOpen, setExcelPreviewOpen] = useState(false);
  const [excelDrafts, setExcelDrafts] = useState<MedicineDraft[]>([]);
  const [excelSubmitting, setExcelSubmitting] = useState(false);
  const [excelFileName, setExcelFileName] = useState("");

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadMedicines = async () => {
    try {
      const data = await getMedicines();
      setMedicines(data || []);
    } catch {
      toast.error("Failed to load medicines");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadMedicines(); }, []);

  // ── Single Add ────────────────────────────────────────────────────────────────
  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMedicine(toApiPayload(form) as any);
      toast.success("Medicine added successfully");
      setForm(emptyDraft());
      setAddOpen(false);
      loadMedicines();
    } catch {
      toast.error("Failed to add medicine");
    }
  };

  // ── Image Import ──────────────────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageFileRef.current) imageFileRef.current.value = "";

    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
    setImageExtracting(true);

    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = () => rej(new Error("File read failed"));
        reader.readAsDataURL(file);
      });

      const mediaType =
        file.type === "image/png" ? "image/png"
        : file.type === "image/webp" ? "image/webp"
        : "image/jpeg";

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              {
                type: "text",
                text: `You are a pharmacy invoice OCR expert. Extract ALL medicine/product line items from this GST invoice image.

Return ONLY a valid JSON array (no markdown fences, no explanation) with exactly this structure per item:

[
  {
    "name": "product name exactly as shown",
    "pack": "pack size e.g. 10'S or 100ML",
    "manufacturer": "MFG code e.g. ALKEM",
    "batchNumber": "batch number exactly as shown e.g. P2EEY019",
    "hsn": "HSN code number",
    "expiryDate": "expiry exactly as shown e.g. 12/27 or 1/28 or 01/12/2027",
    "stockQuantity": <qty number>,
    "free": <free qty number or 0>,
    "mrp": <MRP number>,
    "gst": <GST percent number>,
    "pricePerTablet": <RATE number>,
    "dis": <DIS number or 0>,
    "amt": <AMT number>,
    "schedule": "schedule code if present else empty string",
    "category": "Tablet or Capsule or Syrup or Injection or Cream or Drops or Inhaler or Other",
    "description": ""
  }
]

Rules:
- Extract EVERY row. Never skip any row.
- batchNumber MUST come from the Batch column — include it exactly.
- expiryDate: preserve exactly as shown in invoice (e.g. 12/27 or 1/28 or DD/MM/YYYY).
- stockQuantity from Qty column, pricePerTablet from RATE, mrp from MRP, gst from GST, dis from DIS, amt from AMT.
- Infer category from name: TAB→Tablet, CAP→Capsule, SYP/SYRUP→Syrup, INJ/AMP→Injection, CREAM/GEL→Cream, DROP→Drops.
- Return ONLY the raw JSON array — no text before or after, no code fences.`,
              },
            ],
          }],
        }),
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);
      const data = await response.json();
      const rawText = data.content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("") || "";
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      const arrayStart = cleaned.indexOf("[");
      const arrayEnd = cleaned.lastIndexOf("]");
      if (arrayStart === -1 || arrayEnd === -1) throw new Error("No JSON array found in response");

      const rows: any[] = JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1));
      const drafts: MedicineDraft[] = rows.map((row) => ({
        _key: mkKey(),
        name: String(row.name || "").trim(),
        pack: String(row.pack || "").trim(),
        manufacturer: String(row.manufacturer || "").trim(),
        batchNumber: String(row.batchNumber || "").trim(),
        hsn: String(row.hsn || "").trim(),
        expiryDate: String(row.expiryDate || "").trim(),
        stockQuantity: String(row.stockQuantity ?? "0"),
        free: String(row.free ?? "0"),
        mrp: String(row.mrp ?? ""),
        gst: String(row.gst ?? ""),
        pricePerTablet: String(row.pricePerTablet ?? "0"),
        dis: String(row.dis ?? "0.00"),
        amt: String(row.amt ?? ""),
        schedule: String(row.schedule || "").trim(),
        category: String(row.category || "Tablet"),
        tabletsPerSheet: "10",
        sheetsPerPack: "1",
        description: "",
      })).filter((d) => d.name);

      setImageDrafts(drafts);
      setImagePreviewOpen(true);
      toast.success(`Extracted ${drafts.length} medicines from image`);
    } catch (err: any) {
      console.error("Image extraction error:", err);
      toast.error(`Extraction failed: ${err?.message || "Unknown error"}`);
    } finally {
      setImageExtracting(false);
    }
  };

  const handleImageImportConfirm = async () => {
    const valid = imageDrafts.filter((d) => d.name.trim());
    if (!valid.length) return;
    setImageSubmitting(true);
    try {
      await addMedicines(valid.map(toApiPayload) as any);
      toast.success(`${valid.length} medicines imported from image`);
      setImagePreviewOpen(false);
      setImageDrafts([]);
      setImagePreviewUrl(undefined);
      loadMedicines();
    } catch {
      toast.error("Failed to import medicines");
    } finally {
      setImageSubmitting(false);
    }
  };

  // ── Excel Import ──────────────────────────────────────────────────────────────
  const parseExcelRow = (row: Record<string, any>): MedicineDraft => {
    const name = col(row, "NAME OF PRODUCTS", "PRODUCT NAME", "Medicine Name", "name", "Product", "PRODUCT");
    const pack = col(row, "Pack", "PACK", "pack", "Pack Size");
    const manufacturer = col(row, "MFG", "Manufacturer", "manufacturer", "MANUFACTURER", "Company");
    const batchNumber = col(row, "Batch", "BATCH", "Batch Number", "BatchNo", "Batch No", "batchNumber", "batch");
    const hsn = col(row, "HSN", "hsn", "HSN Code", "HSNCode");
    const expiryDate = col(row, "Exp.", "EXPIRY", "Expiry", "Exp", "expiryDate", "Expiry Date");
    const stockQuantity = col(row, "Qty.", "QTY", "Qty", "qty", "stockQuantity", "Stock Quantity", "QUANTITY");
    const free = col(row, "Free", "FREE", "free", "Free Qty");
    const mrp = col(row, "MRP", "mrp", "M.R.P", "MRP (₹)");
    const gst = col(row, "GST", "gst", "GST%", "GST %", "Tax");
    const pricePerTablet = col(row, "RATE", "Rate", "rate", "pricePerTablet", "Price", "Price per Tablet");
    const dis = col(row, "DIS", "Dis", "dis", "Discount", "DISCOUNT", "DIS%");
    const amt = col(row, "AMT", "Amount", "amt", "AMOUNT", "Total");
    const schedule = col(row, "SCH", "Schedule", "schedule", "Sch");
    const description = col(row, "Description", "description", "Notes", "notes");
    const categoryRaw = col(row, "Category", "category", "CATEGORY");

    return {
      _key: mkKey(),
      name, pack, manufacturer, batchNumber, hsn,
      expiryDate: expiryDate || "",
      stockQuantity: stockQuantity || "0",
      free: free || "0",
      mrp, gst,
      pricePerTablet: pricePerTablet || "0.00",
      dis: dis || "0.00",
      amt, schedule,
      category: categoryRaw || inferCategory(name),
      tabletsPerSheet: "10",
      sheetsPerPack: "1",
      description,
    };
  };

  const handleExcelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);
    if (excelFileRef.current) excelFileRef.current.value = "";

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { raw: false, defval: "" });

        if (rows.length > 0) {
          console.log("[Excel import] Headers:", Object.keys(rows[0]));
        }

        const drafts = rows.map(parseExcelRow).filter((d) => d.name.trim() !== "");
        if (drafts.length === 0) {
          toast.error("No valid rows found. Check the sheet has a header row.");
          return;
        }
        setExcelDrafts(drafts);
        setExcelPreviewOpen(true);
        toast.success(`Loaded ${drafts.length} rows from "${file.name}"`);
      } catch (err: any) {
        toast.error(`Failed to read file: ${err?.message || "Unknown error"}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelImportConfirm = async () => {
    const valid = excelDrafts.filter((d) => d.name.trim());
    if (!valid.length) return;
    setExcelSubmitting(true);
    try {
      await addMedicines(valid.map(toApiPayload) as any);
      toast.success(`${valid.length} medicines imported from "${excelFileName}"`);
      setExcelPreviewOpen(false);
      setExcelDrafts([]);
      setExcelFileName("");
      loadMedicines();
    } catch {
      toast.error("Failed to import medicines");
    } finally {
      setExcelSubmitting(false);
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = medicines.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category?.toLowerCase().includes(search.toLowerCase())
  );

  const setF = (k: keyof MedicineDraft, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // ── Render ────────────────────────────────────────────────────────────────────
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
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Pill className="h-6 w-6 text-primary" /> Medicine Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Add, search, edit, and import medicines</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <input ref={excelFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelSelect} />

          {/* <Button variant="outline" onClick={() => imageFileRef.current?.click()} disabled={imageExtracting} className="flex items-center gap-1.5">
            {imageExtracting ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</> : <><ImageIcon className="h-4 w-4" /> Import from Image</>}
          </Button> */}

          <Button variant="outline" onClick={() => excelFileRef.current?.click()} className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Import Excel / CSV
          </Button>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add Medicine</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Medicine</DialogTitle></DialogHeader>
              <form onSubmit={handleAddSingle} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Name *</Label>
                    <Input placeholder="e.g. DYPHASTON-TAB" value={form.name} onChange={(e) => setF("name", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Schedule</Label>
                    <Input placeholder="e.g. H" value={form.schedule} onChange={(e) => setF("schedule", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Manufacturer</Label>
                    <Input placeholder="e.g. ALKEM" value={form.manufacturer} onChange={(e) => setF("manufacturer", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Batch No.</Label>
                    <Input placeholder="e.g. P2EEY019" value={form.batchNumber} onChange={(e) => setF("batchNumber", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Expiry
                      {form.expiryDate && parseExpiryToISO(form.expiryDate) && (
                        <span className="ml-2 text-xs text-primary font-normal">→ {formatExpiry(form.expiryDate)}</span>
                      )}
                    </Label>
                    <Input placeholder="MM/YY or DD/MM/YYYY" value={form.expiryDate} onChange={(e) => setF("expiryDate", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate (₹)</Label>
                    <Input type="number" step="0.01" value={form.pricePerTablet} onChange={(e) => setF("pricePerTablet", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock Qty</Label>
                    <Input type="number" value={form.stockQuantity} onChange={(e) => setF("stockQuantity", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pack</Label>
                    <Input placeholder="e.g. 10'S" value={form.pack} onChange={(e) => setF("pack", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>HSN</Label>
                    <Input value={form.hsn} onChange={(e) => setF("hsn", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>MRP (₹)</Label>
                    <Input type="number" value={form.mrp} onChange={(e) => setF("mrp", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>GST %</Label>
                    <Input type="number" value={form.gst} onChange={(e) => setF("gst", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount %</Label>
                    <Input type="number" value={form.dis} onChange={(e) => setF("dis", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setF("category", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tablets/Sheet</Label>
                    <Input type="number" value={form.tabletsPerSheet} onChange={(e) => setF("tabletsPerSheet", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sheets/Pack</Label>
                    <Input type="number" value={form.sheetsPerPack} onChange={(e) => setF("sheetsPerPack", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Additional details..." value={form.description} onChange={(e) => setF("description", e.target.value)} />
                </div>
                <div className="flex gap-3 justify-end border-t border-border pt-4 mt-2">
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button type="submit"><Pill className="h-4 w-4 mr-1" /> Add Medicine</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {imageExtracting && (
        <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
          <div>
            <p className="font-medium text-primary">Reading invoice image…</p>
            <p className="text-xs text-muted-foreground mt-0.5">Claude Vision is scanning all rows. Usually takes 5–15 seconds.</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search medicines…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Medicine table */}
      <Card className="border-none shadow-sm">
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Pill className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No medicines found</p>
              <p className="text-xs mt-1">Add medicines manually, import from a photo invoice, or upload an Excel / CSV file.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {["S.NO", "PRODUCT NAME", "PACK", "SCH", "MFG", "BATCH", "HSN", "EXPIRY", "QTY", "FREE", "RATE", "MRP", "GST%", "DIS%", "CATEGORY", "ACTIONS"].map((h) => (
                      <th key={h} className="pb-3 pr-3 font-medium text-muted-foreground whitespace-nowrap text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, idx) => {
                    const med = m as Medicine & Record<string, any>;
                    return (
                      <tr key={med.id || med._id || idx} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 pr-3 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 pr-3 font-medium whitespace-nowrap">{med.name}</td>
                        <td className="py-3 pr-3 text-xs">{med.pack || "—"}</td>
                        <td className="py-3 pr-3 text-xs">{med.schedule || "—"}</td>
                        <td className="py-3 pr-3 text-xs whitespace-nowrap">{med.manufacturer || "—"}</td>
                        <td className="py-3 pr-3 font-mono text-xs whitespace-nowrap">{med.batchNumber || "—"}</td>
                        <td className="py-3 pr-3 text-xs">{med.hsn || "—"}</td>
                        <td className="py-3 pr-3 text-xs whitespace-nowrap">{formatExpiry(med.expiryDate)}</td>
                        <td className="py-3 pr-3 text-xs">{med.stockQuantity ?? "—"}</td>
                        <td className="py-3 pr-3 text-xs">{med.free ?? "0"}</td>
                        <td className="py-3 pr-3 text-xs whitespace-nowrap">₹{med.pricePerTablet?.toFixed ? med.pricePerTablet.toFixed(2) : med.pricePerTablet ?? "—"}</td>
                        <td className="py-3 pr-3 text-xs whitespace-nowrap">{med.mrp ? `₹${med.mrp}` : "—"}</td>
                        <td className="py-3 pr-3 text-xs">{med.gst != null ? `${med.gst}%` : "—"}</td>
                        <td className="py-3 pr-3 text-xs">{med.dis != null ? `${med.dis}%` : "—"}</td>
                        <td className="py-3 pr-3">
                          <Badge variant="secondary" className="text-xs">{med.category || "—"}</Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => { setEditTarget(med); setEditOpen(true); }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeleteTarget(med); setDeleteOpen(true); }}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <PreviewModal
        open={imagePreviewOpen}
        onClose={() => { setImagePreviewOpen(false); setImageDrafts([]); setImagePreviewUrl(undefined); }}
        drafts={imageDrafts}
        onDraftsChange={setImageDrafts}
        onConfirm={handleImageImportConfirm}
        isSubmitting={imageSubmitting}
        title="Verify Extracted Medicines"
        subtitle="Review and correct data extracted from your invoice image before importing."
        previewImageUrl={imagePreviewUrl}
      />

      <PreviewModal
        open={excelPreviewOpen}
        onClose={() => { setExcelPreviewOpen(false); setExcelDrafts([]); setExcelFileName(""); }}
        drafts={excelDrafts}
        onDraftsChange={setExcelDrafts}
        onConfirm={handleExcelImportConfirm}
        isSubmitting={excelSubmitting}
        title="Verify Excel Import"
        subtitle={`Review all rows from "${excelFileName}" before importing.`}
      />

      <EditMedicineModal
        medicine={editTarget}
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditTarget(null); }}
        onSaved={loadMedicines}
      />

      <DeleteConfirmDialog
        medicine={deleteTarget}
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null); }}
        onDeleted={loadMedicines}
      />
    </div>
  );
}