"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Stethoscope, Printer, FileText, UserPlus, Search,
  CreditCard, Loader2, RefreshCw, CalendarClock, Calendar,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getDoctors, getRMPs, getOPRecords, getReceipts, createOP, admitPatient,
  findPatientByPhoneAll, type OPRecord, type Doctor, type RMP, type Receipt,
} from "@/components/api";
import { generateOPRegistrationPDF, generatePaymentPDF, generateReceiptPDF } from "@/components/pdfGenerator";

// ─── Helper ────────────────────────────────────────────────────────────────────
/** Return a Date that is `base` + 15 days (end-of-day). */
function addFifteenDays(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + 15);
  return d;
}

/** Format a Date as the value used by <input type="date"> (YYYY-MM-DD). */
function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function OutpatientPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rmps, setRmps] = useState<RMP[]>([]);
  const [opRecords, setOpRecords] = useState<OPRecord[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /** Role read from localStorage — used to show admin-only UI. */
  const [role, setRole] = useState<string>("staff");

  const [searchQuery, setSearchQuery] = useState("");
  const [patientStatus, setPatientStatus] = useState<"new" | "existing" | null>(null);
  const [validityMsg, setValidityMsg] = useState<{ text: string; isValid: boolean } | null>(null);

  const [formData, setFormData] = useState({
    opId: "", name: "", age: "", gender: "", phone: "", village: "",
    doctorId: "", paymentMethod: "cash", rmpId: "none", rmpName: "",
    transactionId: "",
  });

  // ── Admin-only: custom OP date ──────────────────────────────────────────────
  /**
   * `useCustomDate`  — toggle to enable/disable the date picker (admin only).
   * `customDate`     — the value of the date input (YYYY-MM-DD string).
   *                    Empty string = not set = fall back to real-time.
   */
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState<string>("");

  const isAdmin = role === "admin";

  const [rmpSearch, setRmpSearch] = useState("");
  const [showRmpList, setShowRmpList] = useState(false);

  const selectedDoc = doctors.find((d) => (d.id || d.customId) === formData.doctorId);
  const baseFee = selectedDoc?.fee || 0;
  const finalAmount = baseFee;

  const set = (key: string, val: string) =>
    setFormData((p) => ({ ...p, [key]: val }));

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedRole = localStorage.getItem("medcare_role");
    setRole(storedRole ? storedRole.toLowerCase() : "staff");

    const loadData = async () => {
      try {
        const [docsData, rmpsData, opsData, receiptsData] = await Promise.all([
          getDoctors(), getRMPs(), getOPRecords(), getReceipts(),
        ]);
        setDoctors(docsData || []);
        setRmps(rmpsData || []);
        setOpRecords(opsData || []);
        setReceipts(receiptsData || []);
      } catch {
        toast.error("Failed to load hospital data from server");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // ── Refresh ─────────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [opsData, receiptsData] = await Promise.all([getOPRecords(), getReceipts()]);
      setOpRecords(opsData || []);
      setReceipts(receiptsData || []);
      toast.success("List refreshed successfully");
    } catch {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Phone lookup ────────────────────────────────────────────────────────────
  const handlePhoneChange = async (val: string) => {
    set("phone", val);
    if (val.length >= 10) {
      try {
        const patient = await findPatientByPhoneAll(val);
        if (patient && patient.phone === val) {
          setFormData((p) => ({
            ...p, phone: val, opId: patient.opId,
            name: patient.name, age: patient.age,
            gender: patient.gender, village: patient.village,
          }));
          setPatientStatus("existing");

          if (patient.date) {
            const opDate = new Date(patient.date);
            const expiryDate = addFifteenDays(opDate);
            const now = new Date();

            if (now <= expiryDate) {
              setValidityMsg({
                text: `Current OP (${patient.opId}) is valid till ${expiryDate.toLocaleDateString()}`,
                isValid: true,
              });
              toast.info(`Patient has an active OP valid until ${expiryDate.toLocaleDateString()}`);
            } else {
              setValidityMsg({
                text: `Previous OP expired on ${expiryDate.toLocaleDateString()}. New OP required.`,
                isValid: false,
              });
            }
          }
        } else if (val.length >= 10) {
          setPatientStatus("new");
          setFormData((p) => ({ ...p, opId: "" }));
          setValidityMsg(null);
        } else {
          setPatientStatus(null);
          setValidityMsg(null);
        }
      } catch {
        console.error("Error finding patient");
      }
    } else {
      setPatientStatus(null);
      setValidityMsg(null);
    }
  };

  // ── Form submit ─────────────────────────────────────────────────────────────
  const handleCreateOP = async (e: React.FormEvent) => {
    e.preventDefault();

    // Block duplicate active OPs — but admins using a custom date bypass this
    // only if the custom date is in the past (back-dated entry); still block
    // if validity is active and no custom date is chosen.
    if (validityMsg?.isValid && !(isAdmin && useCustomDate && customDate)) {
      toast.error("This patient already has an active OP. Cannot create a duplicate.");
      return;
    }

    const doc = doctors.find((d) => (d.id || d.customId) === formData.doctorId);
    if (!doc) { toast.error("Please select a doctor"); return; }

    // ── Determine the OP date to use ──────────────────────────────────────────
    // Admin + custom date toggle on + date entered → use custom date.
    // Everything else → real-time (let the API/createOP handle it).
    let opDateIso: string | undefined;
    if (isAdmin && useCustomDate && customDate) {
      // Parse the YYYY-MM-DD value into a proper ISO string (midnight local time).
      const parsed = new Date(customDate + "T00:00:00");
      if (isNaN(parsed.getTime())) {
        toast.error("Invalid custom date selected.");
        return;
      }
      opDateIso = parsed.toISOString();
    }

    setIsSubmitting(true);

    try {
      // We extend createOP to accept an optional `date` override.
      // The api.ts `createOP` signature already spreads `data` into the payload,
      // so passing `date` here will override the `new Date()` inside createOP
      // only if the API function supports it.  We pass it as part of the payload
      // via a cast — adjust if your API signature differs.
      const record = await createOP({
        opId: formData.opId || undefined,
        name: formData.name,
        age: formData.age,
        gender: formData.gender,
        phone: formData.phone,
        village: formData.village,
        doctorId: doc.id || doc.customId || "",
        doctorName: doc.name,
        consultationFee: doc.fee,
        finalAmount,
        paymentMethod: formData.paymentMethod,
        transactionId: formData.paymentMethod === "upi" ? formData.transactionId : undefined,
        referredByRmpId:
          formData.rmpId !== "none" && formData.rmpId !== "manual"
            ? formData.rmpId
            : undefined,
        referredByRmpName:
          formData.rmpId === "manual"
            ? formData.rmpName
            : formData.rmpId !== "none"
            ? rmps.find((r) => (r.id || r.customId) === formData.rmpId)?.name
            : undefined,
        // ── Admin custom date override ──────────────────────────────────────
        ...(opDateIso ? { date: opDateIso } : {}),
      } as any);

      const freshReceipts = await getReceipts();
      setReceipts(freshReceipts);

      const sortedReceipts = [...freshReceipts].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const generatedReceipt = sortedReceipts.find(
        (r) => r.opId === record.opId && r.type === "op"
      );

      generateOPRegistrationPDF(record);

      if (generatedReceipt) {
        generateReceiptPDF(generatedReceipt, record);
      } else {
        const fallbackReceipt: Receipt = {
          id: "REC-PROCESSING",
          opId: record.opId,
          patientName: record.name,
          phone: record.phone,
          type: "payment",
          category: "OP Consultation",
          amount: record.finalAmount,
          method: record.paymentMethod,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        };
        generatePaymentPDF(record, fallbackReceipt);
      }

      // Show which date was used so admin can confirm
      const usedDateLabel = opDateIso
        ? `Date: ${new Date(opDateIso).toLocaleDateString("en-IN")}`
        : "Date: Today";

      toast.success(`OP Created: ${record.opId}`, {
        description: `Fee: ₹${finalAmount} · ${usedDateLabel} · PDFs generated`,
      });

      const freshOps = await getOPRecords();
      setOpRecords(freshOps);

      // Reset form
      setFormData({
        opId: "", name: "", age: "", gender: "", phone: "", village: "",
        doctorId: "", paymentMethod: "cash", rmpId: "none", rmpName: "", transactionId: "",
      });
      setRmpSearch("");
      setPatientStatus(null);
      setValidityMsg(null);
      // Reset custom date fields
      setUseCustomDate(false);
      setCustomDate("");
    } catch {
      toast.error("Failed to create OP Registration");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Derived validity preview for custom date ────────────────────────────────
  const customDateExpiryLabel = (() => {
    if (!isAdmin || !useCustomDate || !customDate) return null;
    const parsed = new Date(customDate + "T00:00:00");
    if (isNaN(parsed.getTime())) return null;
    const expiry = addFifteenDays(parsed);
    return `Valid till: ${expiry.toLocaleDateString("en-IN")}`;
  })();

  // ── Filtered lists ──────────────────────────────────────────────────────────
  const filteredRecords = searchQuery
    ? opRecords.filter(
        (r) =>
          r.phone.includes(searchQuery.toLowerCase()) ||
          r.opId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : opRecords;

  const filteredRmps = rmps.filter((r) =>
    r.name.toLowerCase().includes(rmpSearch.toLowerCase())
  );

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading OP data...</span>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Stethoscope className="h-6 w-6 text-primary" /> Outpatient Registration
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Register patient, select doctor, pay & generate OP PDFs
        </p>
      </div>

      {/* Registration form */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> New OP Registration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOP} className="space-y-4">

            {/* ── Patient info row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Phone */}
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Mobile number"
                    className="pl-8"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    required
                  />
                </div>
                {patientStatus === "existing" && !validityMsg?.isValid && (
                  <p className="text-[11px] text-green-600 font-medium">✓ Existing patient (Auto-filled)</p>
                )}
                {patientStatus === "new" && (
                  <p className="text-[11px] text-blue-600 font-medium">+ New patient</p>
                )}
                {validityMsg && (
                  <p className={`text-[11px] font-bold mt-1 ${validityMsg.isValid ? "text-emerald-600" : "text-amber-600"}`}>
                    {validityMsg.text}
                  </p>
                )}
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  placeholder="Patient name"
                  value={formData.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </div>

              {/* Age */}
              <div className="space-y-1.5">
                <Label>Age *</Label>
                <Input
                  type="number"
                  placeholder="Age"
                  value={formData.age}
                  onChange={(e) => set("age", e.target.value)}
                  required
                />
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Village + RMP row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Village</Label>
                <Input
                  placeholder="Village name"
                  value={formData.village}
                  onChange={(e) => set("village", e.target.value)}
                />
              </div>

              {/* RMP search */}
              <div className="space-y-1.5 relative">
                <Label>Referred By (RMP)</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search RMP or enter manual name..."
                    className="pl-8"
                    value={rmpSearch}
                    onChange={(e) => {
                      setRmpSearch(e.target.value);
                      setShowRmpList(true);
                      set("rmpId", e.target.value ? "manual" : "none");
                      set("rmpName", e.target.value);
                    }}
                    onFocus={() => setShowRmpList(true)}
                    onBlur={() => setTimeout(() => setShowRmpList(false), 200)}
                  />
                </div>
                {showRmpList && (
                  <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-auto top-[60px]">
                    <div
                      className="px-3 py-2 cursor-pointer hover:bg-muted text-sm text-muted-foreground border-b border-border"
                      onClick={() => {
                        setRmpSearch("");
                        set("rmpId", "none");
                        set("rmpName", "");
                        setShowRmpList(false);
                      }}
                    >
                      No Referral (Clear)
                    </div>
                    {filteredRmps.length === 0 && rmpSearch ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-primary">Press enter to add:</span> "{rmpSearch}"
                      </div>
                    ) : (
                      filteredRmps.map((r) => (
                        <div
                          key={r.id || r.customId}
                          className="px-3 py-2 cursor-pointer hover:bg-muted text-sm flex justify-between"
                          onClick={() => {
                            setRmpSearch(r.name);
                            set("rmpId", r.id || r.customId || "manual");
                            set("rmpName", r.name);
                            setShowRmpList(false);
                          }}
                        >
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs text-muted-foreground">{r.clinicName || r.address || "RMP"}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── ADMIN ONLY: Custom Date Section ── */}
            {isAdmin && (
              <div className="rounded-lg border border-border bg-muted/40 overflow-hidden">
                {/* ── Header row — always visible ── */}
                <button
                  type="button"
                  onClick={() =>
                    setUseCustomDate((prev) => {
                      if (prev) setCustomDate("");
                      return !prev;
                    })
                  }
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/70 transition-colors group"
                  aria-expanded={useCustomDate}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <CalendarClock className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground leading-none">
                        Back-date OP Entry
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {useCustomDate
                          ? "Custom date active — using selected date below"
                          : "Using today's real-time date"}
                      </p>
                    </div>
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  </div>

                  {/* ── Toggle pill ── */}
                  <div
                    className={`relative flex items-center h-7 w-13 rounded-full px-0.5 transition-all duration-200 shrink-0 ${
                      useCustomDate
                        ? "bg-primary"
                        : "bg-slate-300 dark:bg-slate-600"
                    }`}
                    style={{ minWidth: "52px" }}
                  >
                    <span
                      className={`h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                        useCustomDate ? "translate-x-[26px]" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>

                {/* ── Expanded: date picker + validity preview ── */}
                {useCustomDate && (
                  <div className="border-t border-border px-4 py-4 bg-background">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Date input */}
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          OP Registration Date *
                        </Label>
                        <Input
                          type="date"
                          value={customDate}
                          max={toDateInputValue(new Date())}
                          onChange={(e) => setCustomDate(e.target.value)}
                          required={useCustomDate}
                          className="w-full"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Cannot be a future date. Validity is calculated from this date.
                        </p>
                      </div>

                      {/* Validity preview — appears once a date is chosen */}
                      {customDateExpiryLabel ? (
                        <div className="flex items-end">
                          <div className="w-full rounded-lg bg-muted/60 border border-border px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                              Validity Window
                            </p>
                            <p className="text-sm font-bold text-foreground">
                              {customDateExpiryLabel}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              15 days from selected OP date
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-end">
                          <div className="w-full rounded-lg border border-dashed border-border px-4 py-3 flex items-center justify-center">
                            <p className="text-[12px] text-muted-foreground">
                              Select a date to preview validity
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Doctor / Payment row ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-border">
              <div className="space-y-1.5">
                <Label>Select Doctor *</Label>
                <Select value={formData.doctorId} onValueChange={(v) => set("doctorId", v)}>
                  <SelectTrigger><SelectValue placeholder="Choose doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors
                      .filter((d) => d.available)
                      .map((d) => (
                        <SelectItem key={d.id || d.customId} value={d.id || d.customId || ""}>
                          {d.name} — {d.specialization} (₹{d.fee})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={formData.paymentMethod} onValueChange={(v) => set("paymentMethod", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.paymentMethod === "upi" && (
                <div className="space-y-1.5">
                  <Label>Transaction ID</Label>
                  <Input
                    placeholder="UPI Transaction ID"
                    value={formData.transactionId}
                    onChange={(e) => set("transactionId", e.target.value)}
                  />
                </div>
              )}

              {formData.doctorId && (
                <div className="flex items-end">
                  <div className="bg-muted/50 rounded-lg p-3 text-sm w-full text-center">
                    <p className="font-bold text-primary">Fee: ₹{baseFee}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={
                isSubmitting ||
                // Block if active OP and admin hasn't opted into custom date
                (validityMsg?.isValid && !(isAdmin && useCustomDate && customDate))
              }
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              {isSubmitting ? "Registering..." : "Register & Generate PDFs"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── OP Queue list ── */}
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base">
            Today's OP Queue ({opRecords.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, OP ID..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh List"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {searchQuery ? "No results found" : "No OP registrations yet today"}
            </p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {[...filteredRecords].reverse().map((p) => {
                const sortedReceipts = [...receipts].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                );
                const rec = sortedReceipts.find(
                  (r) => r.opId === p.opId && (r.type === "payment" || r.type === "op")
                );

                return (
                  <div key={p.opId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.opId} · Age {p.age} · {p.doctorName} · ₹{p.finalAmount} · Ph: {p.phone}
                        {p.referredByRmpName ? ` · Ref: ${p.referredByRmpName}` : ""}
                        {/* Show the OP date for admin so they can verify custom-dated entries */}
                        {isAdmin && p.date ? ` · ${new Date(p.date).toLocaleDateString("en-IN")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { generateOPRegistrationPDF(p); toast.info("OPD Card generated"); }}
                      >
                        <Printer className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (rec) {
                            generateReceiptPDF(rec, p);
                          } else {
                            const fallbackReceipt: Receipt = {
                              id: "REC-PROCESSING",
                              opId: p.opId,
                              patientName: p.name,
                              phone: p.phone,
                              type: "payment",
                              category: "OP Consultation",
                              amount: p.finalAmount,
                              method: p.paymentMethod,
                              date: new Date(p.date).toLocaleDateString(),
                              time: new Date(p.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
                            };
                            generatePaymentPDF(p, fallbackReceipt);
                          }
                          toast.info("Payment receipt generated");
                        }}
                      >
                        <CreditCard className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}