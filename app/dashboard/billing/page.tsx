"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Users, Phone, Eye, Calendar, Stethoscope, Pill, Receipt as ReceiptIcon, 
  X, Clock, BedDouble, Scissors, Syringe, FlaskConical, Loader2, ArrowLeft, Printer,
  Plus, Trash2, RefreshCw,CreditCard 
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  getMedicines, getOPRecords, getReceipts, findPatientByPhone, findPatientByPhonePartial, 
  addReceipt, decreaseMedicineStock, type Medicine, type OPRecord, type Receipt 
} from "@/components/api";
import { generateMedicineBillPDF, generateServiceBillPDF, type MedicineBillItem, type ServiceBillItem } from "@/components/pdfGenerator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// 1. Medicine Search Component (Filters out Expired Medicines)
const MedicineSearch = ({ value, onChange, medicines }: { value: string; onChange: (id: string) => void; medicines: Medicine[] }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = medicines.find(m => (m.id || m.customId) === value);
  
  // Filter out expired medicines
  const unexpiredMedicines = medicines.filter(m => {
    if (!m.expiryDate || m.expiryDate === "N/A" || m.expiryDate === "-") return true;
    const expDate = new Date(m.expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    return isNaN(expDate.getTime()) || expDate >= today;
  });

  const filtered = query
    ? unexpiredMedicines.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) || m.category.toLowerCase().includes(query.toLowerCase()))
    : unexpiredMedicines;

  return (
    <div className="relative">
      <Input
        placeholder={selected ? `${selected.name} — ₹${selected.pricePerTablet}` : "Search medicine..."}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className={selected ? "border-primary/50" : ""}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
          {filtered.map((m) => {
            const mid = m.id || m.customId || "";
            return (
              <button key={mid} type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => { onChange(mid); setQuery(""); setOpen(false); }}>
                {m.name} — ₹{m.pricePerTablet} <span className="text-muted-foreground text-xs">({m.category})</span>
              </button>
            );
          })}
        </div>
      )}
      {open && filtered.length === 0 && query && (
         <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md px-3 py-2 text-sm text-muted-foreground">
            No valid medicines found.
         </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
};

// 2. Service Items Editor Component
const ServiceItemsEditor = ({
  items, setItems, total, onGenerate, label, isSubmitting
}: {
  items: { name: string; amount: string }[];
  setItems: React.Dispatch<React.SetStateAction<{ name: string; amount: string }[]>>;
  total: number; onGenerate: () => void; label: string; isSubmitting: boolean;
}) => (
  <div className="space-y-3 pt-4">
    <div className="flex items-center justify-between">
      <Label className="text-base font-heading">{label}</Label>
      <Button size="sm" variant="outline" onClick={() => setItems([...items, { name: "", amount: "" }])}>
        <Plus className="h-3 w-3 mr-1" /> Add Item
      </Button>
    </div>
    {items.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Click "Add Item" to add services</p>}
    {items.map((item, i) => (
      <div key={i} className="grid grid-cols-[1fr_120px_40px] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Service Name</Label>
          <Input placeholder="e.g. Dressing, Suture" value={item.name}
            onChange={(e) => setItems(items.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Amount (₹)</Label>
          <Input type="number" value={item.amount}
            onChange={(e) => setItems(items.map((it, idx) => idx === i ? { ...it, amount: e.target.value } : it))} />
        </div>
        <Button size="icon" variant="ghost" className="text-destructive mb-1"
          onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ))}
    {items.length > 0 && (
      <div className="border-t pt-3 flex justify-between items-center">
        <p className="font-heading font-bold text-lg">Total: ₹{total.toFixed(2)}</p>
        <Button onClick={onGenerate} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
          {isSubmitting ? "Generating..." : "Generate Bill PDF"}
        </Button>
      </div>
    )}
  </div>
);

export default function BillingPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [opRecords, setOpRecords] = useState<OPRecord[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingMed, setIsSubmittingMed] = useState(false);
  const [isSubmittingTreat, setIsSubmittingTreat] = useState(false);
  const [isSubmittingSurg, setIsSubmittingSurg] = useState(false);

  const [activeTab, setActiveTab] = useState("medicine");

  const [phone, setPhone] = useState("");
  const [opId, setOpId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    try {
      const [meds, ops, recs] = await Promise.all([
        getMedicines(), getOPRecords(), getReceipts()
      ]);
      setMedicines(meds || []);
      setOpRecords(ops || []);
      setReceipts(recs || []);
    } catch (error) {
      toast.error("Failed to load billing data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success("History refreshed successfully");
  };

  const resetPatientForm = () => {
    setPhone(""); setOpId(""); setPatientName(""); setAge(""); setGender(""); setDoctorName("");
  };

  const handlePhoneLookup = async (ph: string) => {
    setPhone(ph);
    if (ph.length >= 4) {
      try {
        const patient = (await findPatientByPhone(ph)) || (await findPatientByPhonePartial(ph));
        if (patient) {
          setOpId(patient.opId);
          setPatientName(patient.name);
          setAge(patient.age || "");
          setGender(patient.gender || "");
          setDoctorName(patient.doctorName || (patient as any).doctor || "");
          if (ph === patient.phone) toast.info(`Patient found: ${patient.name}`);
        }
      } catch (error) {
        console.error("Error looking up patient", error);
      }
    } else {
       setOpId(""); setPatientName(""); setAge(""); setGender(""); setDoctorName("");
    }
  };

  // --- MEDICINE BILLING ---
  const [medItems, setMedItems] = useState<{ medicineId: string; quantity: number }[]>([]);
  const addMedItem = () => setMedItems([...medItems, { medicineId: "", quantity: 1 }]);
  const removeMedItem = (i: number) => setMedItems(medItems.filter((_, idx) => idx !== i));
  const updateMedItem = (i: number, key: string, val: string | number) =>
    setMedItems(medItems.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  const medTotal = medItems.reduce((sum, it) => {
    const med = medicines.find((m) => (m.id || m.customId) === it.medicineId);
    return sum + (med ? med.pricePerTablet * it.quantity : 0);
  }, 0);

  const handleMedicineBill = async () => {
    if (!opId || !patientName || medItems.length === 0) {
      toast.error("Fill all fields and add medicines"); return;
    }
    
    setIsSubmittingMed(true);
    const billItems: MedicineBillItem[] = medItems
      .map((it) => ({ medicine: medicines.find((m) => (m.id || m.customId) === it.medicineId)!, quantity: it.quantity }))
      .filter((it) => it.medicine);
      
    const itemDetails = billItems.map(it => ({
      name: it.medicine.name, quantity: it.quantity,
      amount: it.medicine.pricePerTablet * it.quantity,
    }));

    try {
      await Promise.all(
        billItems.map(it => decreaseMedicineStock(it.medicine.id || it.medicine.customId || "", it.quantity))
      );
      
      const generatedReceipt = await addReceipt({ 
        opId, patientName, phone, type: "medicine", category: "Pharmacy Bill", 
        amount: medTotal, method: paymentMethod, details: `${medItems.length} items`, itemDetails 
      });

      const finalReceipt: Receipt = {
        ...generatedReceipt,
        id: generatedReceipt?.receiptId || generatedReceipt?.id || "N/A"
      };

      const patientRecord = { opId, name: patientName, phone, age, gender, doctorName } as OPRecord;

      generateMedicineBillPDF(patientRecord, finalReceipt, billItems, paymentMethod);
      
      toast.success("Pharmacy bill PDF generated & stock updated");
      setMedItems([]);
      resetPatientForm();
      loadData(); 
    } catch (error) {
      toast.error("Error saving bill to database");
    } finally {
      setIsSubmittingMed(false);
    }
  };

  const handlePrintPastMedicineBill = (rec: Receipt) => {
    const patient = opRecords.find(p => p.opId === rec.opId) || { opId: rec.opId, name: rec.patientName, phone: rec.phone } as OPRecord;
    
    const billItems = (rec.itemDetails || []).map(item => {
      const searchName = String(item.name || "").trim().toLowerCase();
      const fullMedicine = medicines.find(m => String(m.name || "").trim().toLowerCase() === searchName);
      
      return {
        medicine: fullMedicine ? { ...fullMedicine } : { 
          name: item.name, 
          pricePerTablet: (item.amount || 0) / (item.quantity || 1),
          schedule: "", manufacturer: "", batchNumber: "", expiryDate: ""
        } as Medicine,
        quantity: item.quantity || 1
      };
    });

    const fullRec = { ...rec, id: rec.id || (rec as any).receiptId || "N/A" };
    generateMedicineBillPDF(patient, fullRec, billItems, rec.method || "CASH");
    toast.info("Pharmacy Bill Downloaded");
  };

  // --- TREATMENT BILLING ---
  const [treatmentItems, setTreatmentItems] = useState<{ name: string; amount: string }[]>([]);
  const treatmentTotal = treatmentItems.reduce((s, it) => s + Number(it.amount || 0), 0);

  const handleTreatmentBill = async () => {
    if (!opId || !patientName || treatmentItems.length === 0) {
      toast.error("Fill patient and add items"); return;
    }
    
    setIsSubmittingTreat(true);
    const items: ServiceBillItem[] = treatmentItems.map((it) => ({ name: it.name, amount: Number(it.amount), paid: Number(it.amount) }));
    const itemDetails = items.map(it => ({ name: it.name, amount: it.amount }));
    
    try {
      const generatedReceipt = await addReceipt({ opId, patientName, phone, type: "treatment", category: "Treatment Bill", amount: treatmentTotal, method: paymentMethod, itemDetails });
      
      const finalReceipt: Receipt = { ...generatedReceipt, id: generatedReceipt?.receiptId || generatedReceipt?.id || "N/A" };
      const patientRecord = { opId, name: patientName, phone, age, gender, doctorName } as OPRecord;

      generateServiceBillPDF("Treatment Bill", patientRecord, finalReceipt, items, paymentMethod);
      
      toast.success("Treatment bill PDF generated");
      setTreatmentItems([]);
      resetPatientForm();
      loadData();
    } catch (error) {
      toast.error("Error saving treatment bill");
    } finally {
      setIsSubmittingTreat(false);
    }
  };

  // --- SURGERY BILLING ---
  const [surgeryItems, setSurgeryItems] = useState<{ name: string; amount: string }[]>([]);
  const surgeryTotal = surgeryItems.reduce((s, it) => s + Number(it.amount || 0), 0);

  const handleSurgeryBill = async () => {
    if (!opId || !patientName || surgeryItems.length === 0) {
      toast.error("Fill patient and add items"); return;
    }
    
    setIsSubmittingSurg(true);
    const items: ServiceBillItem[] = surgeryItems.map((it) => ({ name: it.name, amount: Number(it.amount), paid: Number(it.amount) }));
    const itemDetails = items.map(it => ({ name: it.name, amount: it.amount }));
    
    try {
      const generatedReceipt = await addReceipt({ opId, patientName, phone, type: "surgery", category: "Surgery Bill", amount: surgeryTotal, method: paymentMethod, itemDetails });
      
      const finalReceipt: Receipt = { ...generatedReceipt, id: generatedReceipt?.receiptId || generatedReceipt?.id || "N/A" };
      const patientRecord = { opId, name: patientName, phone, age, gender, doctorName } as OPRecord;

      generateServiceBillPDF("Surgery Bill", patientRecord, finalReceipt, items, paymentMethod);

      toast.success("Surgery bill PDF generated");
      setSurgeryItems([]);
      resetPatientForm();
      loadData();
    } catch (error) {
      toast.error("Error saving surgery bill");
    } finally {
      setIsSubmittingSurg(false);
    }
  };

  const handlePrintPastServiceBill = (title: string, rec: Receipt) => {
    const patient = opRecords.find(p => p.opId === rec.opId) || { opId: rec.opId, name: rec.patientName, phone: rec.phone } as OPRecord;
    const items = (rec.itemDetails || []).map(item => ({ name: item.name, amount: item.amount, paid: item.amount }));
    const fullRec = { ...rec, id: rec.id || (rec as any).receiptId || "N/A" };
    generateServiceBillPDF(title, patient, fullRec, items, rec.method || "CASH");
    toast.info(`${title} Downloaded`);
  };

  // --- SHARED UI COMPONENTS ---
  const patientLookupJSX = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b border-border">
      <div className="space-y-1.5">
        <Label>Phone Number</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Enter phone to find patient" value={phone} onChange={(e) => handlePhoneLookup(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>OP/IP No. *</Label>
        <Input placeholder="OP-1001" value={opId} onChange={(e) => setOpId(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Patient Name *</Label>
        <Input placeholder="Name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Payment Method</Label>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderHistoryList = (type: string, title: string, printHandler: (rec: Receipt) => void) => {
    const filtered = receipts.filter(r => r.type === type && (r.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) || (r.id || (r as any).receiptId || "").toLowerCase().includes(searchQuery.toLowerCase())));
    
    return (
      <Card className="border-none shadow-sm mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base">Past {title}s ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or Receipt ID..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing} title="Refresh">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No {title.toLowerCase()}s found.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {[...filtered].reverse().map((r) => {
                const rid = r.id || (r as any).receiptId || "";
                return (
                  <div key={rid} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{r.patientName} <span className="text-muted-foreground text-xs font-normal">({r.opId})</span></p>
                      <p className="text-xs text-muted-foreground">
                        {rid} · {typeof r.date === 'string' ? r.date.split('T')[0] : ''} · ₹{r.amount} · {r.method?.toUpperCase()}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => printHandler(r)}>
                      <Printer className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading Billing module...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" /> Pharmacy & Billing
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Generate bills for medicines, treatment, and surgery</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchQuery(""); }}>
        <TabsList>
          <TabsTrigger value="medicine">Pharmacy Bill</TabsTrigger>
          <TabsTrigger value="treatment">Treatment Bill</TabsTrigger>
          <TabsTrigger value="surgery">Surgery Bill</TabsTrigger>
        </TabsList>

        <TabsContent value="medicine">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="font-heading text-base">New Pharmacy Bill</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {patientLookupJSX}
              <div className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-heading">Medicines</Label>
                  <Button size="sm" variant="outline" onClick={addMedItem}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
                </div>
                {medItems.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Click "Add Item" to add medicines</p>}
                {medItems.map((item, i) => {
                  const med = medicines.find((m) => (m.id || m.customId) === item.medicineId);
                  return (
                    <div key={i} className="grid grid-cols-[1fr_100px_80px_40px] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Medicine</Label>
                        <MedicineSearch value={item.medicineId} onChange={(v) => updateMedItem(i, "medicineId", v)} medicines={medicines} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min={1} value={item.quantity} onChange={(e) => updateMedItem(i, "quantity", Number(e.target.value))} />
                      </div>
                      <div className="text-sm font-medium pb-2">₹{med ? (med.pricePerTablet * item.quantity).toFixed(2) : "0.00"}</div>
                      <Button size="icon" variant="ghost" className="text-destructive mb-1" onClick={() => removeMedItem(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                {medItems.length > 0 && (
                  <div className="border-t pt-3 flex justify-between items-center">
                    <p className="font-heading font-bold text-lg">Total: ₹{medTotal.toFixed(2)}</p>
                    <Button onClick={handleMedicineBill} disabled={isSubmittingMed}>
                      {isSubmittingMed ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
                      {isSubmittingMed ? "Generating..." : "Generate Bill PDF"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {renderHistoryList("medicine", "Pharmacy Bill", handlePrintPastMedicineBill)}
        </TabsContent>

        <TabsContent value="treatment">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="font-heading text-base">New Treatment Bill</CardTitle></CardHeader>
            <CardContent>
              {patientLookupJSX}
              <ServiceItemsEditor items={treatmentItems} setItems={setTreatmentItems} total={treatmentTotal}
                onGenerate={handleTreatmentBill} label="Treatment Services" isSubmitting={isSubmittingTreat} />
            </CardContent>
          </Card>
          {renderHistoryList("treatment", "Treatment Bill", (rec) => handlePrintPastServiceBill("Treatment Bill", rec))}
        </TabsContent>

        <TabsContent value="surgery">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="font-heading text-base">New Surgery Bill</CardTitle></CardHeader>
            <CardContent>
              {patientLookupJSX}
              <ServiceItemsEditor items={surgeryItems} setItems={setSurgeryItems} total={surgeryTotal}
                onGenerate={handleSurgeryBill} label="Surgery Services" isSubmitting={isSubmittingSurg} />
            </CardContent>
          </Card>
          {renderHistoryList("surgery", "Surgery Bill", (rec) => handlePrintPastServiceBill("Surgery Bill", rec))}
        </TabsContent>
      </Tabs>
    </div>
  );
}