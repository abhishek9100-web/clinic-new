"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Syringe, Plus, Search, Trash2, Printer, CheckCircle, Users, AlertCircle, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  getIPRecords, getMedicines, addTreatmentEntry, findPatientByPhone,
  findPatientByPhonePartial, admitPatient, decreaseMedicineStock, addReceipt,
  updateIPStatus, type IPRecord, type OPRecord, type Medicine
} from "@/components/api";
import { generateMedicineBillPDF, type MedicineBillItem } from "@/components/pdfGenerator";

// =========================================================================
// MEDICINE SEARCH DROPDOWN COMPONENT
// =========================================================================

const MedicineSearch = ({
  value,
  onChange,
  medicines,
}: {
  value: string;
  onChange: (id: string) => void;
  medicines: Medicine[];
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = medicines.find((m) => (m.id || m.customId) === value);
  const filtered = query
    ? medicines.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.category.toLowerCase().includes(query.toLowerCase())
      )
    : medicines;

  return (
    <div className="relative">
      <Input
        placeholder={
          selected
            ? `${selected.name} — ₹${selected.pricePerTablet}`
            : "Search medicine..."
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={selected ? "border-primary/50" : ""}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
          {filtered.map((m) => {
            const mid = m.id || m.customId || "";
            return (
              <button
                key={mid}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  onChange(mid);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {m.name} — ₹{m.pricePerTablet}{" "}
                <span className="text-muted-foreground text-xs">
                  ({m.category})
                </span>
              </button>
            );
          })}
        </div>
      )}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
};

// =========================================================================
// MAIN TREATMENT PAGE COMPONENT
// =========================================================================

export default function TreatmentPage() {
  const [ipRecords, setIpRecords] = useState<IPRecord[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchPhone, setSearchPhone] = useState("");
  const [foundOp, setFoundOp] = useState<OPRecord | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<IPRecord | null>(null);

  // ── NEW: track when an IP-ward patient is found during search ────────────
  // Instead of blocking the user, we now allow them to START daily treatment
  // even for currently admitted patients — the dose goes on a separate
  // "Doses Only" record tied to the same opId.
  // We still SHOW the ward info as a warning but do NOT block the action.
  const [wardPatientInfo, setWardPatientInfo] = useState<IPRecord | null>(null);

  const [medItems, setMedItems] = useState<
    { medicineId: string; quantity: number }[]
  >([]);
  const [administeredBy, setAdministeredBy] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  // =========================================================================
  // DATA LOADING
  // =========================================================================

  const loadData = async () => {
    try {
      const [ipData, medData] = await Promise.all([
        getIPRecords(),
        getMedicines(),
      ]);
      setIpRecords(ipData || []);
      setMedicines(medData || []);
    } catch {
      toast.error("Failed to load treatment data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // =========================================================================
  // DERIVED DATA
  // =========================================================================

  /**
   * Active "Doses Only" patients — deduplicated by opId, newest record wins.
   *
   * IMPORTANT CHANGE: we no longer exclude records based on IP-ward admission
   * status. A patient discharged from the IP ward can now freely receive daily
   * doses. Only "discharged" Doses-Only records are excluded.
   */
  const uniqueActiveDailies = useMemo(() => {
    const activeDailies = ipRecords.filter(
      (r) => r.type === "Doses Only" && r.status !== "discharged"
    );
    // Deduplicate: keep the LATEST record per opId
    return Array.from(
      new Map(activeDailies.map((r) => [r.opId, r])).values()
    ).reverse();
  }, [ipRecords]);

  // =========================================================================
  // PHONE SEARCH HANDLER
  // =========================================================================

  const handleSearchPhone = async (val: string) => {
    setSearchPhone(val);

    // Reset everything below the search box
    if (val.length < 4) {
      setFoundOp(null);
      setSelectedPatient(null);
      setWardPatientInfo(null);
      return;
    }

    // 1. Check if the patient already has an ACTIVE Doses-Only record.
    const existingDaily = uniqueActiveDailies.find((p) =>
      p.phone.includes(val)
    );
    if (existingDaily) {
      setSelectedPatient(existingDaily);
      setFoundOp(null);
      setWardPatientInfo(null);
      return;
    }

    // 2. Reset state before async lookup
    setSelectedPatient(null);
    setWardPatientInfo(null);
    setFoundOp(null);

    // 3. Check if the patient is currently in the IP ward (FULL treatment).
    //    Unlike the old code, we do NOT block daily doses — we just show a
    //    warning banner so the staff is aware.
    const activeFullIp = ipRecords.find(
      (r) =>
        r.type !== "Doses Only" &&
        r.status !== "discharged" &&
        r.phone.includes(val)
    );
    if (activeFullIp) {
      // Show the ward info as a soft warning, but still look up OP record
      // so staff can start a Doses-Only record if needed.
      setWardPatientInfo(activeFullIp);
    }

    // 4. Look up the most-recent OP record (used to pre-fill the new
    //    Doses-Only admission).
    try {
      const op =
        (await findPatientByPhone(val)) ||
        (await findPatientByPhonePartial(val));
      setFoundOp(op || null);
    } catch {
      // Silently fail — staff can still proceed if they know the patient
    }
  };

  // =========================================================================
  // START DAILY TREATMENT
  // Creates a new "Doses Only" IPRecord for the found OP patient.
  // Works whether the patient is currently in the IP ward or not.
  // =========================================================================

  const handleStartTreatment = async () => {
    if (!foundOp) return;
    try {
      const ip = await admitPatient({
        opId: foundOp.opId,
        name: foundOp.name,
        age: foundOp.age,
        gender: foundOp.gender,
        phone: foundOp.phone,
        village: foundOp.village,
        room: "OP-Dose",
        bed: "-",
        doctor: foundOp.doctorName || "Duty Doctor",
        disease: "Daily Treatment",
        department: "General",
        admissionType: "General Admission",
        management: "Medical Management",
        admissionCharges: 0,
        dateOfAdmission: new Date().toISOString(),
        dateOfDischarge: "",
        diagnosis: "Daily Doses",
        type: "Doses Only",
        status: "stable",
        notes: "",
      });

      setSelectedPatient(ip);
      setFoundOp(null);
      setWardPatientInfo(null);
      toast.success(`Daily treatment started for ${foundOp.name}`);
      loadData();
    } catch {
      toast.error("Failed to start treatment");
    }
  };

  // =========================================================================
  // MEDICINE ITEM HELPERS
  // =========================================================================

  const addMedItem = () =>
    setMedItems([...medItems, { medicineId: "", quantity: 1 }]);

  const removeMedItem = (i: number) =>
    setMedItems(medItems.filter((_, idx) => idx !== i));

  const updateMedItem = (i: number, key: string, val: string | number) =>
    setMedItems(
      medItems.map((it, idx) => (idx === i ? { ...it, [key]: val } : it))
    );

  const currentDoseTotal = medItems.reduce((sum, it) => {
    const med = medicines.find(
      (m) => (m.id || m.customId) === it.medicineId
    );
    return sum + (med ? med.pricePerTablet * it.quantity : 0);
  }, 0);

  // =========================================================================
  // RECORD DOSE HANDLER
  // =========================================================================

  const handleRecordDose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (
      medItems.length === 0 ||
      !medItems.every((m) => m.medicineId)
    ) {
      toast.error("Please select valid medicines");
      return;
    }

    const description = medItems
      .map((it) => {
        const m = medicines.find(
          (med) => (med.id || med.customId) === it.medicineId
        );
        return `${m?.name} (Qty: ${it.quantity})`;
      })
      .join(", ");

    const doseData = {
      cost: currentDoseTotal,
      items: medItems.map((it) => ({ id: it.medicineId, qty: it.quantity })),
    };

    try {
      await addTreatmentEntry(selectedPatient.ipId, {
        type: "Daily Dose",
        description: `${description} — ₹${currentDoseTotal}`,
        notes: JSON.stringify(doseData),
        administeredBy,
      });

      await Promise.all(
        medItems.map((it) =>
          decreaseMedicineStock(it.medicineId, it.quantity)
        )
      );

      toast.success("Daily dose recorded! Added to running bill.");
      setMedItems([]);
      setAdministeredBy("");

      // Refresh and re-select the updated record
      const updatedIps = await getIPRecords();
      const updatedPatient = [...updatedIps]
        .reverse()
        .find(
          (r) =>
            r.opId === selectedPatient.opId &&
            r.type === "Doses Only" &&
            r.status !== "discharged"
        );

      if (updatedPatient) setSelectedPatient(updatedPatient);
      setIpRecords(updatedIps);
    } catch {
      toast.error("Failed to record daily dose");
    }
  };

  // =========================================================================
  // ACCUMULATED BILL HELPER
  // =========================================================================

  const getAccumulatedBill = () => {
    if (!selectedPatient) return { total: 0, billItems: [] as MedicineBillItem[] };

    let total = 0;
    const aggregatedMeds: Record<string, number> = {};

    selectedPatient.treatments?.forEach((t) => {
      if (t.type === "Daily Dose") {
        try {
          const data = JSON.parse(t.notes);
          total += data.cost;
          data.items.forEach((it: { id: string; qty: number }) => {
            aggregatedMeds[it.id] = (aggregatedMeds[it.id] || 0) + it.qty;
          });
        } catch {}
      }
    });

    const billItems: MedicineBillItem[] = Object.entries(aggregatedMeds)
      .map(([id, qty]) => {
        const med = medicines.find((m) => (m.id || m.customId) === id);
        return med ? { medicine: med, quantity: qty } : null;
      })
      .filter(Boolean) as MedicineBillItem[];

    return { total, billItems };
  };

  const { total: runningTotal, billItems: runningBillItems } =
    getAccumulatedBill();

  // =========================================================================
  // END TREATMENT + GENERATE FINAL BILL
  // =========================================================================

  const handleEndTreatment = async () => {
    if (!selectedPatient) return;
    if (runningTotal === 0) {
      toast.error("No billable doses recorded for this patient.");
      return;
    }

    try {
      // 1. Generate PDF bill
      generateMedicineBillPDF(
        {
          opId: selectedPatient.opId,
          name: selectedPatient.name,
          phone: selectedPatient.phone,
          age: selectedPatient.age,
          gender: selectedPatient.gender,
          doctorName: selectedPatient.doctor,
        } as OPRecord,
        {
          id: `REC-${Date.now().toString().slice(-6)}`,
          opId: selectedPatient.opId,
          patientName: selectedPatient.name,
          phone: selectedPatient.phone,
          category: "Daily Doses Final Bill",
          time: new Date().toLocaleTimeString(),
          date: new Date().toISOString(),
          amount: runningTotal,
          method: paymentMethod,
        } as any,
        runningBillItems,
        paymentMethod
      );

      // 2. Add to official revenue
      const itemDetails = runningBillItems.map((it) => ({
        name: it.medicine.name,
        quantity: it.quantity,
        amount: it.medicine.pricePerTablet * it.quantity,
      }));

      await addReceipt({
        opId: selectedPatient.opId,
        patientName: selectedPatient.name,
        phone: selectedPatient.phone,
        type: "treatment",
        category: "Daily Doses Final Bill",
        amount: runningTotal,
        method: paymentMethod,
        details: `${runningBillItems.length} unique items over treatment`,
        itemDetails,
      });

      // 3. Mark this Doses-Only record as discharged
      await updateIPStatus(selectedPatient.ipId, "discharged");

      toast.success("Treatment ended! Bill generated & Revenue updated.");
      setSelectedPatient(null);
      setSearchPhone("");
      setWardPatientInfo(null);
      setFoundOp(null);
      loadData();
    } catch {
      toast.error("Failed to end treatment and generate bill");
    }
  };

  // =========================================================================
  // LOADING STATE
  // =========================================================================

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">
          Loading Treatment module...
        </span>
      </div>
    );
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6 pb-10">
      {/* ── Page Heading ── */}
      <div>
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Syringe className="h-6 w-6 text-primary" /> Daily Doses & Treatment
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Record OP daily doses and maintain a running pharmacy bill.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ================================================================
            LEFT COLUMN: Search, Start Treatment, Record Dose, Active List
        ================================================================ */}
        <div className="lg:col-span-7 space-y-6">

          {/* ── Patient Search Card ── */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-base">
                Select or Start Patient
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Search input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter patient phone number..."
                      className="pl-8"
                      value={searchPhone}
                      onChange={(e) => handleSearchPhone(e.target.value)}
                    />
                  </div>
                  {(selectedPatient || wardPatientInfo || foundOp) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedPatient(null);
                        setWardPatientInfo(null);
                        setFoundOp(null);
                        setSearchPhone("");
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* ── Soft warning: patient is currently in IP ward ── */}
                {wardPatientInfo && !selectedPatient && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-yellow-700 dark:text-yellow-400 font-medium text-sm flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Currently Admitted in IP Ward
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-semibold">{wardPatientInfo.name}</span> is
                      in Room {wardPatientInfo.room}
                      {wardPatientInfo.bed ? ` / Bed ${wardPatientInfo.bed}` : ""} (IP ID:{" "}
                      {wardPatientInfo.ipId}). You can still start a separate daily-dose
                      record for this visit.
                    </p>
                  </div>
                )}

                {/* ── OP found — can start treatment ── */}
                {foundOp && !selectedPatient && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <p className="font-medium">
                        {foundOp.name}{" "}
                        <span className="text-muted-foreground text-xs">
                          ({foundOp.opId})
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Phone: {foundOp.phone} · Village: {foundOp.village}
                      </p>
                    </div>
                    <Button onClick={handleStartTreatment} size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Start Daily Treatment
                    </Button>
                  </div>
                )}

                {/* ── No OP found after search ── */}
                {searchPhone.length >= 4 &&
                  !foundOp &&
                  !selectedPatient && (
                    <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded border border-dashed">
                      No patient record found for this phone number.
                    </p>
                  )}

                {/* ── Active Doses-Only record already running ── */}
                {selectedPatient && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Active Daily Treatment
                        </p>
                        <p className="text-lg font-bold mt-1">
                          {selectedPatient.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedPatient.phone} · OP ID:{" "}
                          {selectedPatient.opId}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-background">
                        Running Bill: ₹{runningTotal}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Record Daily Dose ── */}
          {selectedPatient && (
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-heading text-base">
                  Record Today's Dose
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addMedItem}>
                  <Plus className="h-3 w-3 mr-1" /> Add Medicine
                </Button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRecordDose} className="space-y-4">
                  {medItems.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4 bg-muted/30 rounded border border-dashed">
                      Click "Add Medicine" to select pharmacy items for
                      today's dose.
                    </p>
                  )}

                  {medItems.map((item, i) => {
                    const med = medicines.find(
                      (m) => (m.id || m.customId) === item.medicineId
                    );
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_100px_80px_40px] gap-2 items-end bg-muted/20 p-2 rounded-md"
                      >
                        <div className="space-y-1">
                          <Label className="text-xs">Medicine</Label>
                          <MedicineSearch
                            value={item.medicineId}
                            onChange={(v) =>
                              updateMedItem(i, "medicineId", v)
                            }
                            medicines={medicines}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateMedItem(
                                i,
                                "quantity",
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>
                        <div className="text-sm font-medium pb-2 text-right">
                          ₹
                          {med
                            ? (
                                med.pricePerTablet * item.quantity
                              ).toFixed(2)
                            : "0.00"}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive mb-1"
                          onClick={() => removeMedItem(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}

                  {medItems.length > 0 && (
                    <>
                      <div className="flex items-center justify-between pt-2">
                        <div className="space-y-1.5 w-1/2">
                          <Label>Administered By</Label>
                          <Input
                            placeholder="Nurse/Doctor name"
                            value={administeredBy}
                            onChange={(e) =>
                              setAdministeredBy(e.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Today's Dose Cost
                          </p>
                          <p className="font-heading font-bold text-xl">
                            ₹{currentDoseTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <Button type="submit" className="w-full">
                        Save Dose to Running Bill
                      </Button>
                    </>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Active Daily Patients List ── */}
          {!selectedPatient && (
            <Card className="border-none shadow-sm">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Active Daily
                  Patients
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {uniqueActiveDailies.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    No patients are currently on daily treatment.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {uniqueActiveDailies.map((p, idx) => (
                      <div
                        key={`${p.ipId}-${idx}`}
                        onClick={() => {
                          setSelectedPatient(p);
                          setSearchPhone(p.phone);
                        }}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm text-primary">
                            {p.name}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({p.opId})
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.phone} · Doses taken:{" "}
                            {p.treatments?.length || 0}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Select
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ================================================================
            RIGHT COLUMN: Running Bill + Dose History
        ================================================================ */}
        <div className="lg:col-span-5 space-y-6">
          {selectedPatient ? (
            <Card className="border-none shadow-sm bg-muted/30 border-primary/10">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-heading text-base flex justify-between">
                  <span>Running Bill</span>
                  <span className="text-primary">
                    ₹{runningTotal.toFixed(2)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-6">

                {/* Aggregated pharmacy items */}
                {runningBillItems.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Accumulated Pharmacy Items
                    </Label>
                    <div className="space-y-1.5 bg-background p-3 rounded border shadow-sm text-sm">
                      {runningBillItems.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between border-b last:border-0 pb-1.5 last:pb-0"
                        >
                          <span>
                            {it.quantity}x {it.medicine.name}
                          </span>
                          <span className="font-medium">
                            ₹{it.medicine.pricePerTablet * it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No medicines recorded yet.
                  </p>
                )}

                {/* Dose history log */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Dose Log
                  </Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {[...(selectedPatient.treatments || [])]
                      .reverse()
                      .map((t, idx) => (
                        <div
                          key={t.id || idx}
                          className="text-xs bg-background p-2 rounded border"
                        >
                          <div className="flex justify-between font-medium mb-1">
                            <span>
                              {new Date(t.date).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              {t.time}
                            </span>
                            <span className="text-muted-foreground">
                              By: {t.administeredBy}
                            </span>
                          </div>
                          <p>{t.description}</p>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Final checkout */}
                {runningTotal > 0 && (
                  <div className="pt-4 border-t border-border/50 space-y-3">
                    <div className="space-y-1.5">
                      <Label>Final Payment Method</Label>
                      <Select
                        value={paymentMethod}
                        onValueChange={setPaymentMethod}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleEndTreatment}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Printer className="h-4 w-4 mr-2" /> End Treatment &
                      Collect ₹{runningTotal}
                    </Button>
                    <p className="text-center text-[10px] text-muted-foreground">
                      This will close the treatment, generate the PDF bill,
                      and add to hospital revenue.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-sm h-full flex flex-col items-center justify-center p-8 text-center bg-muted/30 min-h-[400px]">
              <Syringe className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">
                Search and select a patient to view their running bill and
                dose history.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}