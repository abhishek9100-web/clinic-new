"use client";

/**
 * LabReportsPage.tsx  (UPDATED)
 *
 * Key changes vs previous version:
 *  1. Once a report is COMPLETED it cannot be edited — the pencil button is gone.
 *  2. Delete on a completed report: only within 15 minutes of filledAt.
 *     → reverts status to "pending" and clears sections (so it can be re-entered).
 *  3. After submitting, auto-syncs the matching LabOrder status to "completed"
 *     via the /api/orders/:orderId PUT endpoint.
 *  4. Enhanced visual design: colour-coded badges, progress indicators,
 *     gradient header, stat cards, timeline-style list rows.
 *  5. generateLabReportPDF is now async — awaited correctly.
 */

import {
  FlaskConical, Printer, Pencil, Trash2, RefreshCw, Loader2,
  Search, ChevronLeft, Eye, CheckCircle2, Clock, X, AlertTriangle,
  Activity, TrendingUp, FileText, Lock,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge }   from "@/components/ui/badge";
import { Button }  from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input }   from "@/components/ui/input";
import { Label }   from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  generateLabReportPDF,
  LAB_TEMPLATES,
  type LabReportSection,
  type LabReportPatient,
} from "@/components/Labreportpdfgenerator";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LabReportRecord {
  _id?:        string;
  reportId:    string;
  orderId:     string;
  opId:        string;
  serialNo:    number;
  patientName: string;
  phone:       string;
  age:         string;
  gender:      string;
  village:     string;
  doctorName:  string;
  reportDate:  string;
  reportType:  string;
  sections:    LabReportSection[];
  status:      "pending" | "completed";
  filledBy:    string;
  filledAt:    string | null;
  createdAt?:  string;
  updatedAt?:  string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("medcare_token") : null;
  const res   = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error: ${res.statusText}`);
  return data;
}

async function getLabReports(): Promise<LabReportRecord[]> {
  return apiFetch<LabReportRecord[]>("/labreports");
}
async function updateLabReport(reportId: string, payload: Partial<LabReportRecord>): Promise<LabReportRecord> {
  return apiFetch<LabReportRecord>(`/labreports/${reportId}`, { method: "PUT", body: JSON.stringify(payload) });
}
async function deleteLabReport(reportId: string): Promise<void> {
  await apiFetch(`/labreports/${reportId}`, { method: "DELETE" });
}
/** Sync the lab order status (LB-xxxxx) to completed */
async function syncOrderStatus(orderId: string, status: "pending" | "completed"): Promise<void> {
  if (!orderId) return;
  try {
    await apiFetch(`/orders/${orderId}`, { method: "PUT", body: JSON.stringify({ status }) });
  } catch (e) {
    console.warn("[LabReports] Could not sync order status:", e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesAgo(isoString: string | null): number {
  if (!isoString) return Infinity;
  return (Date.now() - new Date(isoString).getTime()) / 60000;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(val: string | null | undefined): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function buildPatientFromReport(r: LabReportRecord): LabReportPatient {
  return {
    patientName: r.patientName,
    age:         r.age,
    gender:      r.gender,
    village:     r.village,
    doctorName:  r.doctorName,
    phone:       r.phone,
    opId:        r.opId,
    reportId:    r.reportId,
    reportDate:  r.reportDate,
  };
}

function buildSectionsFromTemplate(reportType: string): LabReportSection[] {
  if (reportType === "SURGICAL_PROFILE") {
    return ["CBC","DIFF_COUNT","BLOOD_GROUP","BT_CT"].map(rt => {
      const t = LAB_TEMPLATES.find(x => x.reportType === rt)!;
      return templateToSection(t);
    });
  }
  const tmpl = LAB_TEMPLATES.find(t => t.reportType === reportType);
  if (!tmpl) return [];
  return [templateToSection(tmpl)];
}

function templateToSection(tmpl: typeof LAB_TEMPLATES[number]): LabReportSection {
  if (tmpl.sectionType === "table") {
    return {
      sectionTitle: tmpl.sectionTitle,
      sectionType:  "table",
      method:       tmpl.method || "",
      rows: (tmpl.fields || []).map(f => ({
        investigation: f.investigation,
        value:         "",
        unit:          f.unit,
        normalValue:   f.normalValue,
      })),
      freeTextRows: [],
    };
  }
  return {
    sectionTitle: tmpl.sectionTitle,
    sectionType:  "freetext",
    method:       tmpl.method || "",
    rows:         [],
    freeTextRows: (tmpl.freeTextKeys || []).map(k => `${k} : `),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

type View = "list" | "entry";

export default function LabReportsPage() {
  const [reports,      setReports]      = useState<LabReportRecord[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab,    setActiveTab]    = useState<"pending" | "completed">("pending");
  const [searchQ,      setSearchQ]      = useState("");
  const [userRole,     setUserRole]     = useState("billing");
  const [userName,     setUserName]     = useState("ADMIN");
  const [view,         setView]         = useState<View>("list");

  const [currentReport, setCurrentReport] = useState<LabReportRecord | null>(null);
  const [selectedType,  setSelectedType]  = useState("");
  const [sections,      setSections]      = useState<LabReportSection[]>([]);
  const [isSaving,      setIsSaving]      = useState(false);

  const loadData = useCallback(async () => {
    try {
      setReports(await getLabReports() || []);
    } catch {
      toast.error("Failed to load lab reports");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setUserRole(localStorage.getItem("medcare_role")?.toLowerCase() || "billing");
    setUserName(localStorage.getItem("medcare_username")?.toUpperCase() || "ADMIN");
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success("Refreshed");
  };

  const canEdit = userRole === "admin" || userRole === "lab";

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filterReports = (status: "pending" | "completed") =>
    reports
      .filter(r => !r.status || r.status === status)
      .filter(r => {
        if (!searchQ) return true;
        const q = searchQ.toLowerCase();
        return (
          r.patientName?.toLowerCase().includes(q) ||
          r.phone?.includes(q) ||
          r.opId?.toLowerCase().includes(q) ||
          r.reportId?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.reportDate || 0).getTime() - new Date(a.reportDate || 0).getTime());

  const pendingList   = filterReports("pending");
  const completedList = filterReports("completed");

  // ── Per-patient serial ─────────────────────────────────────────────────────

  function serialFor(r: LabReportRecord): number {
    const samePatient = reports
      .filter(x => x.opId === r.opId || x.phone === r.phone)
      .sort((a, b) => new Date(a.reportDate || 0).getTime() - new Date(b.reportDate || 0).getTime());
    return (samePatient.findIndex(x => x.reportId === r.reportId) ?? 0) + 1;
  }

  // ── Open entry form ────────────────────────────────────────────────────────

  function openEntryForm(report: LabReportRecord) {
    // LOCK: completed reports cannot be edited
    if (report.status === "completed") {
      toast.error("Completed reports cannot be edited. Delete within 15 min to re-enter.");
      return;
    }
    setCurrentReport(report);
    const type = report.reportType || "";
    setSelectedType(type);
    setSections(
      report.sections && report.sections.length > 0
        ? JSON.parse(JSON.stringify(report.sections))
        : buildSectionsFromTemplate(type)
    );
    setView("entry");
  }

  // ── Field updates ──────────────────────────────────────────────────────────

  function handleTypeChange(val: string) {
    setSelectedType(val);
    setSections(buildSectionsFromTemplate(val));
  }

  function updateRowValue(si: number, ri: number, value: string) {
    setSections(prev => {
      const c = JSON.parse(JSON.stringify(prev)) as LabReportSection[];
      c[si].rows![ri].value = value;
      return c;
    });
  }

  function updateFreeText(si: number, ri: number, value: string) {
    setSections(prev => {
      const c = JSON.parse(JSON.stringify(prev)) as LabReportSection[];
      c[si].freeTextRows![ri] = value;
      return c;
    });
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  async function handlePreview() {
    if (!currentReport) return;
    if (sections.length === 0) { toast.error("Select a test type first"); return; }
    await generateLabReportPDF(buildPatientFromReport(currentReport), sections, currentReport.reportId);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!currentReport) return;
    if (sections.length === 0) { toast.error("Select a test type first"); return; }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await updateLabReport(currentReport.reportId, {
        sections,
        reportType: selectedType,
        status:     "completed",
        filledBy:   userName,
        filledAt:   now,
      });

      // ── Sync lab order status ──
      if (currentReport.orderId) {
        // Check if all reports for this order are now completed
        const freshReports  = await getLabReports();
        const orderReports  = freshReports.filter(r => r.orderId === currentReport.orderId);
        const allDone       = orderReports.every(r =>
          r.reportId === currentReport.reportId ? true : r.status === "completed"
        );
        if (allDone) {
          await syncOrderStatus(currentReport.orderId, "completed");
        }
      }

      toast.success("Lab report saved & marked completed");
      await loadData();
      setView("list");
      setActiveTab("completed");
    } catch {
      toast.error("Failed to save report");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Delete / Revert ────────────────────────────────────────────────────────

  async function handleDelete(report: LabReportRecord) {
    if (report.status === "pending") {
      if (!confirm(`Delete pending report ${report.reportId}? This cannot be undone.`)) return;
      try {
        await deleteLabReport(report.reportId);
        toast.info("Report deleted");
        await loadData();
      } catch { toast.error("Delete failed"); }
      return;
    }

    // Completed — only within 15 min
    if (minutesAgo(report.filledAt) > 15) {
      toast.error("Can only clear values within 15 minutes of submission");
      return;
    }
    if (!confirm("Clear entered values and revert to Pending? This action cannot be undone.")) return;
    try {
      await updateLabReport(report.reportId, {
        sections: [],
        status:   "pending",
        filledBy: "",
        filledAt: null,
      });
      // Revert the order status too if it was completed
      if (report.orderId) {
        await syncOrderStatus(report.orderId, "pending");
      }
      toast.info("Reverted to pending — values cleared");
      await loadData();
    } catch { toast.error("Failed to revert"); }
  }

  // ── Reprint ────────────────────────────────────────────────────────────────

  async function handleReprint(report: LabReportRecord) {
    if (!report.sections || report.sections.length === 0) {
      toast.error("No report data to print");
      return;
    }
    await generateLabReportPDF(buildPatientFromReport(report), report.sections, report.reportId);
  }

  // ── L/H flag for display in list ──────────────────────────────────────────

  function getAbnormalCount(report: LabReportRecord): number {
    let count = 0;
    for (const sec of report.sections || []) {
      for (const row of sec.rows || []) {
        if (!row.value || !row.normalValue) continue;
        const num = parseFloat(row.value);
        if (isNaN(num)) continue;
        const rangeMatch = row.normalValue.match(/([\d.]+)\s*(?:–|-|to)\s*([\d.]+)/i);
        if (rangeMatch) {
          const lo = parseFloat(rangeMatch[1]);
          const hi = parseFloat(rangeMatch[2]);
          if (num < lo || num > hi) count++;
        }
      }
    }
    return count;
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Loading Lab Reports…</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ENTRY FORM VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (view === "entry" && currentReport) {
    return (
      <div className="space-y-5 max-w-4xl pb-10">

        {/* ── Top bar ── */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("list")}
            className="rounded-xl hover:bg-primary/10">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Enter Lab Results
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              {currentReport.patientName} · {currentReport.opId} · Report ID: {currentReport.reportId}
            </p>
          </div>
          <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        </div>

        {/* ── Patient card ── */}
        <div className="rounded-2xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Patient",    value: currentReport.patientName },
              { label: "Age/Gender", value: `${currentReport.age} / ${currentReport.gender}` },
              { label: "Doctor",     value: currentReport.doctorName || "—" },
              { label: "Village",    value: currentReport.village    || "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{label}</p>
                <p className="font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Test type selector ── */}
        <Card className="border shadow-sm rounded-2xl">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Test Type
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <Select value={selectedType} onValueChange={handleTypeChange} disabled={!canEdit}>
              <SelectTrigger className="w-full md:w-96 rounded-xl">
                <SelectValue placeholder="— choose a test template —" />
              </SelectTrigger>
              <SelectContent>
                {LAB_TEMPLATES.map(t => (
                  <SelectItem key={t.reportType} value={t.reportType}>{t.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* ── Section cards ── */}
        {sections.map((section, si) => (
          <Card key={si} className="border shadow-sm rounded-2xl overflow-hidden">
            {/* Section header band */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3">
              <h3 className="text-white font-bold text-sm tracking-wide">{section.sectionTitle}</h3>
            </div>
            <CardContent className="px-5 py-4 space-y-4">

              {/* TABLE */}
              {section.sectionType === "table" && section.rows && (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-2/5 text-xs uppercase">Investigation</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-1/6 text-xs uppercase">Value</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-16 text-xs uppercase">Flag</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-1/6 text-xs uppercase">Units</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase">Normal Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, ri) => {
                        // compute flag inline
                        let flag = "";
                        const num = parseFloat(row.value);
                        if (!isNaN(num) && row.normalValue) {
                          const rm = row.normalValue.match(/([\d.]+)\s*(?:–|-|to)\s*([\d.]+)/i);
                          if (rm) {
                            if (num < parseFloat(rm[1])) flag = "L";
                            else if (num > parseFloat(rm[2])) flag = "H";
                          }
                        }
                        return (
                          <tr key={ri} className={`border-t ${ri % 2 === 0 ? "" : "bg-muted/20"}`}>
                            <td className="px-3 py-2 font-medium">{row.investigation}</td>
                            <td className="px-3 py-2">
                              <Input
                                className="h-8 text-sm rounded-lg w-28"
                                value={row.value}
                                onChange={e => updateRowValue(si, ri, e.target.value)}
                                placeholder="—"
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="px-3 py-2 text-center w-14">
                              {flag === "L" && (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">L</span>
                              )}
                              {flag === "H" && (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold">H</span>
                              )}
                              {!flag && row.value && (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-bold">N</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{row.unit}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{row.normalValue}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* FREETEXT */}
              {section.sectionType === "freetext" && section.freeTextRows && (
                <div className="space-y-3">
                  {section.freeTextRows.map((line, li) => {
                    const colonIdx = line.indexOf(":");
                    const key = colonIdx !== -1 ? line.substring(0, colonIdx).trim() : line;
                    const val = colonIdx !== -1 ? line.substring(colonIdx + 1).trim() : "";
                    return (
                      <div key={li} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30">
                        <span className="text-sm font-semibold w-60 shrink-0 text-foreground">{key}</span>
                        <span className="text-muted-foreground">:</span>
                        <Input
                          className="h-8 text-sm rounded-lg"
                          value={val}
                          onChange={e => updateFreeText(si, li, `${key} : ${e.target.value}`)}
                          placeholder="Enter result"
                          disabled={!canEdit}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Method */}
              {canEdit && (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Method (optional)</Label>
                  <Input
                    className="h-7 text-xs rounded-lg w-80"
                    value={section.method || ""}
                    onChange={e => setSections(prev => {
                      const c = JSON.parse(JSON.stringify(prev)) as LabReportSection[];
                      c[si].method = e.target.value;
                      return c;
                    })}
                    placeholder="e.g. Automated Cell Counter"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* ── Actions ── */}
        {canEdit && sections.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handlePreview} className="rounded-xl gap-2">
              <Eye className="h-4 w-4" /> Preview PDF
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="rounded-xl gap-2 bg-green-600 hover:bg-green-700">
              {isSaving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />}
              {isSaving ? "Saving…" : "Submit & Mark Completed"}
            </Button>
            <Button variant="ghost" onClick={() => setView("list")} className="rounded-xl gap-2">
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>
        )}

        {!canEdit && (
          <p className="text-muted-foreground text-sm bg-muted/50 rounded-xl p-4">
            <Lock className="inline h-4 w-4 mr-1" />
            You have view-only access. Only lab or admin users can enter results.
          </p>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════

  const ReportRow = ({ report }: { report: LabReportRecord }) => {
    const serial     = serialFor(report);
    const isCompleted = report.status === "completed";
    const abnormal   = isCompleted ? getAbnormalCount(report) : 0;
    const canDelComp = isCompleted && canEdit && minutesAgo(report.filledAt) <= 15;
    const canDelPend = !isCompleted && canEdit;
    const minsLeft   = isCompleted ? Math.max(0, 15 - minutesAgo(report.filledAt)) : 0;

    return (
      <div className={`
        flex items-center justify-between px-4 py-3 rounded-2xl border transition-all
        ${isCompleted
          ? "bg-green-50/60 border-green-200/60 hover:bg-green-50"
          : "bg-amber-50/50 border-amber-200/50 hover:bg-amber-50"
        }
      `}>
        {/* Left: serial + info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`
            flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm
            ${isCompleted ? "bg-green-600 text-white" : "bg-amber-500 text-white"}
          `}>
            {serial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{report.patientName}</p>
              <span className="text-xs bg-white/80 text-foreground px-2 py-0.5 rounded-lg border font-mono">
                {report.reportType || "—"}
              </span>
              {abnormal > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-lg font-medium">
                  ⚠ {abnormal} abnormal
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono">{report.reportId}</span>
              {" · "}{report.opId}
              {" · "}{formatDate(report.reportDate)}
              {report.filledBy && ` · ${report.filledBy}`}
              {isCompleted && report.filledAt && ` · ${formatTime(report.filledAt)}`}
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <Badge className={isCompleted
            ? "bg-green-600 text-white border-0 text-xs"
            : "bg-amber-500 text-white border-0 text-xs"
          }>
            {isCompleted ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
            {isCompleted ? "Completed" : "Pending"}
          </Badge>

          {/* Edit — only for PENDING */}
          {!isCompleted && canEdit && (
            <Button size="sm" variant="outline" onClick={() => openEntryForm(report)}
              className="h-8 w-8 p-0 rounded-xl border-amber-300 hover:bg-amber-100" title="Enter results">
              <Pencil className="h-3.5 w-3.5 text-amber-700" />
            </Button>
          )}

          {/* Lock icon for completed — not clickable */}
          {isCompleted && canEdit && (
            <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-muted/50" title="Completed — editing locked">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}

          {/* Reprint */}
          {isCompleted && (
            <Button size="sm" variant="outline" onClick={() => handleReprint(report)}
              className="h-8 w-8 p-0 rounded-xl" title="Reprint report">
              <Printer className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Delete */}
          {(canDelComp || canDelPend) && (
            <Button
              size="sm" variant="ghost"
              className={`h-8 w-8 p-0 rounded-xl ${canDelComp ? "text-orange-600 hover:bg-orange-50" : "text-destructive hover:bg-red-50"}`}
              onClick={() => handleDelete(report)}
              title={
                canDelComp
                  ? `Revert to pending (${Math.floor(minsLeft)}m left)`
                  : "Delete pending report"
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Expired delete window indicator */}
          {isCompleted && canEdit && minutesAgo(report.filledAt) > 15 && minutesAgo(report.filledAt) < 30 && (
            <div className="h-8 px-2 rounded-xl flex items-center bg-muted/40 text-xs text-muted-foreground" title="15-min window expired">
              <Lock className="h-3 w-3 mr-1" />locked
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Stat cards ─────────────────────────────────────────────────────────────

  const totalReports    = reports.length;
  const pendingCount    = reports.filter(r => r.status === "pending").length;
  const completedCount  = reports.filter(r => r.status === "completed").length;
  const todayCount      = reports.filter(r => {
    const d = new Date(r.reportDate);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            Lab Reports
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage, enter, and print lab investigation reports
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}
          className="rounded-xl h-10 w-10">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Reports", value: totalReports,   icon: FileText,      color: "text-blue-600",   bg: "bg-blue-50"  },
          { label: "Pending",       value: pendingCount,   icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50" },
          { label: "Completed",     value: completedCount, icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-50" },
          { label: "Today",         value: todayCount,     icon: Activity,      color: "text-purple-600", bg: "bg-purple-50"},
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border bg-white p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search patient, OP, report ID…"
          className="pl-10 rounded-xl"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "pending" | "completed")}>
        <TabsList className="rounded-xl p-1 gap-1">
          <TabsTrigger value="pending" className="rounded-lg gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Clock className="h-3.5 w-3.5" />
            Pending ({pendingList.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg gap-1.5 data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed ({completedList.length})
          </TabsTrigger>
        </TabsList>

        {/* ── PENDING ── */}
        <TabsContent value="pending" className="mt-4">
          <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Pending Reports
                {pendingList.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300 bg-amber-50 text-xs">
                    {pendingList.length} awaiting results
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingList.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto" />
                  <p className="text-muted-foreground text-sm font-medium">
                    {searchQ ? "No matching pending reports." : "All caught up! No pending reports."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingList.map(r => <ReportRow key={r.reportId} report={r} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── COMPLETED ── */}
        <TabsContent value="completed" className="mt-4">
          <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Completed Reports
                {completedList.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-green-600 border-green-300 bg-green-50 text-xs">
                    {completedList.length} total
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedList.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <FlaskConical className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground text-sm">
                    {searchQ ? "No matching completed reports." : "No completed reports yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {completedList.map(r => <ReportRow key={r.reportId} report={r} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Legend */}
      {canEdit && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded-xl px-4 py-2.5">
          <span className="flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5 text-amber-500" /> Edit available on pending only</span>
          <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-muted-foreground" /> Completed reports are locked</span>
          <span className="flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5 text-orange-500" /> Revert within 15 min</span>
        </div>
      )}
    </div>
  );
}