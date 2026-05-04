"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BedDouble, Search, Plus, ClipboardList, Pill, TestTube, 
  Activity, LogOut, FileText, ArrowLeft, ReceiptText, Printer, IndianRupee, Loader2, CheckCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getIPRecords, getReceipts, getLabOrders, getXRayOrders,
  updateIPStatus, addTreatmentEntry, addReceipt,
  type IPRecord, type Receipt, type LabOrder, type XRayOrder
} from "@/components/api";
import { generateFinalBillPDF, generateAdmissionPDF } from "@/components/pdfGenerator";

export default function InpatientPage() {
  const [ipRecords, setIpRecords] = useState<IPRecord[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [xrayOrders, setXrayOrders] = useState<XRayOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIP, setSelectedIP] = useState<IPRecord | null>(null);

  const [treatmentForm, setTreatmentForm] = useState({
    type: "", description: "", notes: "", administeredBy: "", amount: ""
  });

  const loadData = async () => {
    try {
      const [ips, recs, labs, xrays] = await Promise.all([
        getIPRecords(),
        getReceipts(),
        getLabOrders(),
        getXRayOrders()
      ]);
      setIpRecords(ips || []);
      setReceipts(recs || []);
      setLabOrders(labs || []);
      setXrayOrders(xrays || []);
      
      // If a patient is currently selected, update their local state to reflect fresh DB changes
      if (selectedIP) {
        const updatedSelected = (ips || []).find((ip: IPRecord) => ip.ipId === selectedIP.ipId);
        if (updatedSelected) setSelectedIP(updatedSelected);
      }
    } catch (error) {
      toast.error("Failed to load Inpatient data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ipPatients = ipRecords.filter(r => r.type !== "Doses Only");

  const filtered = searchQuery
    ? ipPatients.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.ipId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phone.includes(searchQuery)
      )
    : ipPatients;

  const activeFiltered = filtered.filter(p => p.status !== "discharged");
  const dischargedFiltered = filtered.filter(p => p.status === "discharged");

  const activeCount = ipPatients.filter(r => r.status !== "discharged").length;
  const criticalCount = ipPatients.filter(r => r.status === "critical").length;
  const stableRecoveringCount = ipPatients.filter(r => r.status === "stable" || r.status === "recovering").length;
  const dischargedCount = ipPatients.filter(r => r.status === "discharged").length;

  const handleAddTreatment = async () => {
    if (!selectedIP || !treatmentForm.type || !treatmentForm.description) {
      toast.error("Fill treatment type and description"); return;
    }
    
    try {
      // 1. Add Medical Record
      await addTreatmentEntry(selectedIP.ipId, {
        type: treatmentForm.type,
        description: treatmentForm.description,
        notes: treatmentForm.notes,
        administeredBy: treatmentForm.administeredBy,
      });

      // 2. Add Financial Record if Cost is provided
      const cost = Number(treatmentForm.amount);
      if (cost > 0) {
        await addReceipt({
          opId: selectedIP.opId,
          patientName: selectedIP.name,
          phone: selectedIP.phone,
          type: "treatment",
          category: "Ward Treatment",
          amount: cost,
          method: "Pending", // Bill added to room
          details: treatmentForm.type,
          itemDetails: [{ name: treatmentForm.description, amount: cost, quantity: 1 }]
        });
        toast.success(`Treatment logged and ₹${cost} added to bill.`);
      } else {
        toast.success("Treatment entry added (No charges applied).");
      }

      setTreatmentForm({ type: "", description: "", notes: "", administeredBy: "", amount: "" });
      loadData(); // Refresh UI to show the new treatment
    } catch (error) {
      toast.error("Failed to add treatment entry");
    }
  };

  const handleStatusUpdate = async (ip: IPRecord, status: IPRecord["status"]) => {
    try {
      await updateIPStatus(ip.ipId, status);
      toast.success(`${ip.name} status updated to ${status}`);
      loadData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDischarge = async (patientReceipts: Receipt[]) => {
    if (!selectedIP) return;
    
    try {
      // Generate Final PDF
      generateFinalBillPDF(selectedIP, patientReceipts);

      // Update DB
      await updateIPStatus(selectedIP.ipId, "discharged");
      await addTreatmentEntry(selectedIP.ipId, {
        type: "Discharge",
        description: "Patient formally discharged. Final Bill generated.",
        notes: "Account settled.",
        administeredBy: "System",
      });
      
      toast.success(`${selectedIP.name} has been discharged successfully!`);
      setSelectedIP(null);
      loadData();
    } catch (error) {
      toast.error("Failed to process discharge");
    }
  };

  // Dedicated function to reprint Final Bill from the Discharged list
  const handlePrintFinalBill = (ip: IPRecord) => {
    const patientReceipts = receipts.filter(r => r.opId === ip.opId);
    if (patientReceipts.length === 0) {
      toast.info("No receipts found for this patient to generate a final bill.");
    }
    generateFinalBillPDF(ip, patientReceipts);
    toast.success(`Final bill downloaded for ${ip.name}`);
  };

  const renderSafeNotes = (notes: string) => {
    if (!notes) return null;
    try {
      const parsed = JSON.parse(notes);
      if (parsed.cost !== undefined) return null;
      return notes;
    } catch (e) {
      return notes;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading Inpatient module...</span>
      </div>
    );
  }

  if (selectedIP) {
    const patientReceipts = receipts.filter(r => r.opId === selectedIP.opId);
    const pharmacyReceipts = patientReceipts.filter(r => r.type === "medicine");
    const advances = patientReceipts.filter(r => r.type === "ip");
    const billedItems = patientReceipts.filter(r => r.type !== "ip");

    const pLabs = labOrders.filter(l => l.opId === selectedIP.opId);
    const pXrays = xrayOrders.filter(x => x.opId === selectedIP.opId);
    
    const grossTotal = billedItems.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalAdvance = advances.reduce((sum, r) => sum + (r.amount || 0), 0);
    const netPayable = Math.max(0, grossTotal - totalAdvance);

    return (
      <div className="space-y-6 pb-10 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setSelectedIP(null)} className="pl-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Patient List
          </Button>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="bg-primary/5 p-6 border-b border-primary/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold flex items-center gap-3">
                {selectedIP.name} 
                <Badge variant={selectedIP.status === "critical" ? "destructive" : "default"} className="text-xs uppercase tracking-wider">
                  {selectedIP.status}
                </Badge>
              </h2>
              <div className="text-sm text-muted-foreground mt-2 flex gap-x-6 gap-y-2 flex-wrap">
                <p><span className="font-medium text-foreground">IP ID:</span> {selectedIP.ipId}</p>
                <p><span className="font-medium text-foreground">OP ID:</span> {selectedIP.opId}</p>
                <p><span className="font-medium text-foreground">Room:</span> {selectedIP.room} {selectedIP.bed ? `(Bed: ${selectedIP.bed})` : ""}</p>
                <p><span className="font-medium text-foreground">Doctor:</span> {selectedIP.doctor}</p>
              </div>
            </div>
            <div className="md:text-right bg-background p-4 rounded-xl shadow-sm border border-border/50 min-w-[200px]">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Net Payable Balance</p>
              <p className="font-heading font-bold text-3xl text-primary">₹{netPayable.toFixed(2)}</p>
            </div>
          </div>

          <CardContent className="p-0">
            <Tabs defaultValue="treatments" className="w-full">
              <TabsList className="w-full flex justify-start rounded-none border-b bg-muted/20 h-14 px-4 overflow-x-auto">
                <TabsTrigger value="treatments" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6">
                  <Activity className="h-4 w-4"/> Treatments
                </TabsTrigger>
                <TabsTrigger value="pharmacy" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6">
                  <Pill className="h-4 w-4"/> Pharmacy Bills
                </TabsTrigger>
                <TabsTrigger value="diagnostics" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6">
                  <TestTube className="h-4 w-4"/> Lab & X-Ray
                </TabsTrigger>
                <TabsTrigger value="bills" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6">
                  <ReceiptText className="h-4 w-4"/> All Bills & Advances
                </TabsTrigger>
                <TabsTrigger value="discharge" className="data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive flex items-center gap-2 h-10 px-6 ml-auto">
                  <LogOut className="h-4 w-4"/> Discharge
                </TabsTrigger>
              </TabsList>

              {/* 1. TREATMENTS TAB */}
              <TabsContent value="treatments" className="p-6 m-0 space-y-6 bg-muted/5">
                <Card className="border border-border/50 shadow-sm bg-background">
                  <CardHeader className="py-4 border-b">
                    <CardTitle className="text-base font-heading flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" /> Add New Treatment Entry
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Treatment Type *</Label>
                        <Select value={treatmentForm.type} onValueChange={(v) => setTreatmentForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IV Drip">IV Drip</SelectItem>
                            <SelectItem value="Injection">Injection</SelectItem>
                            <SelectItem value="Medication">Medication</SelectItem>
                            <SelectItem value="Dressing">Dressing</SelectItem>
                            <SelectItem value="Observation">Observation</SelectItem>
                            <SelectItem value="Procedure">Procedure</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Administered By</Label>
                        <Input placeholder="Nurse/Doctor name" value={treatmentForm.administeredBy}
                          onChange={(e) => setTreatmentForm(f => ({ ...f, administeredBy: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                          <IndianRupee className="h-3 w-3"/> Treatment Cost (Optional)
                        </Label>
                        <Input type="number" placeholder="0.00" value={treatmentForm.amount}
                          onChange={(e) => setTreatmentForm(f => ({ ...f, amount: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">Description *</Label>
                      <Input placeholder="e.g. Paracetamol 500mg, Saline drip" value={treatmentForm.description}
                        onChange={(e) => setTreatmentForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">Notes (Optional)</Label>
                      <Textarea placeholder="Additional notes..." rows={2} value={treatmentForm.notes}
                        onChange={(e) => setTreatmentForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <Button onClick={handleAddTreatment} className="w-full">
                      Save Treatment & Apply Charges
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <h4 className="font-heading font-bold text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground"/> Treatment History ({(selectedIP.treatments || []).length})
                  </h4>
                  {(!selectedIP.treatments || selectedIP.treatments.length === 0) ? (
                    <div className="text-center py-12 bg-background rounded-lg border border-dashed">
                      <p className="text-muted-foreground">No treatment entries recorded yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {[...selectedIP.treatments].reverse().map((t) => {
                        const safeNotes = renderSafeNotes(t.notes);
                        return (
                          <div key={t.id} className="p-5 rounded-xl border bg-background shadow-sm space-y-3 relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 rounded-l-xl"></div>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                              <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-sm w-fit">{t.type}</Badge>
                              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1.5 rounded-md flex items-center gap-1.5">
                                {typeof t.date === 'string' ? t.date.split('T')[0] : ''} at {t.time}
                              </span>
                            </div>
                            <p className="text-base font-medium text-foreground">{t.description}</p>
                            
                            {safeNotes && (
                              <div className="bg-muted/40 p-3 rounded-md border border-border/50 text-sm text-muted-foreground">
                                {safeNotes}
                              </div>
                            )}

                            {t.administeredBy && (
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-1">
                                Administered By: <span className="text-foreground">{t.administeredBy}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 2. PHARMACY TAB */}
              <TabsContent value="pharmacy" className="p-6 m-0 space-y-4 bg-muted/5">
                <h4 className="font-heading font-bold text-lg">Medications Issued from Pharmacy</h4>
                {pharmacyReceipts.length === 0 ? (
                  <div className="text-center py-12 bg-background rounded-lg border border-dashed">
                    <p className="text-muted-foreground">No pharmacy bills found for this patient.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {pharmacyReceipts.map(receipt => (
                      <Card key={receipt.id || receipt.receiptId} className="shadow-sm border-border/50 bg-background">
                        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
                          <div className="text-xs font-medium text-muted-foreground">{typeof receipt.date === 'string' ? receipt.date.split('T')[0] : ''} {receipt.time}</div>
                          <div className="text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded">₹{(receipt.amount || 0).toFixed(2)}</div>
                        </CardHeader>
                        <CardContent className="py-4">
                          <div className="space-y-3">
                            {receipt.itemDetails?.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0">
                                <span>{item.quantity}x <span className="font-medium text-foreground">{item.name}</span></span>
                                <span className="font-medium text-muted-foreground">₹{(item.amount || 0).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 3. DIAGNOSTICS TAB */}
              <TabsContent value="diagnostics" className="p-6 m-0 space-y-8 bg-muted/5">
                <div className="space-y-4">
                  <h4 className="font-heading font-bold text-lg flex items-center gap-2 border-b pb-2">
                    <TestTube className="h-5 w-5 text-primary" /> Lab Investigations
                  </h4>
                  {pLabs.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-background p-6 rounded-lg border border-dashed text-center">No lab orders found.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pLabs.map(lab => (
                        <div key={lab.id || lab.orderId} className="p-4 bg-background border rounded-xl shadow-sm text-sm space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">{lab.orderId || lab.id}</span>
                            <Badge variant={lab.status === "completed" ? "default" : "secondary"}>{lab.status}</Badge>
                          </div>
                          <ul className="space-y-1.5 border-t border-b py-3 text-muted-foreground">
                            {(lab.serviceNames || []).map((s, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span> {s}
                              </li>
                            ))}
                          </ul>
                          <div className="font-bold text-right text-lg text-primary">₹{lab.amount}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 4. BILLS TAB */}
              <TabsContent value="bills" className="p-6 m-0 space-y-4 bg-muted/5">
                <h4 className="font-heading font-bold text-lg flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-primary" /> Complete Billing History
                </h4>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => generateAdmissionPDF(selectedIP, advances[0])}>
                      <Printer className="h-4 w-4 mr-2" /> Print Admission Advance Receipt
                    </Button>
                </div>
                {patientReceipts.length === 0 ? (
                  <div className="text-center py-12 bg-background rounded-lg border border-dashed">
                    <p className="text-muted-foreground">No bills or receipts found for this patient.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {[...patientReceipts].reverse().map(receipt => (
                      <div key={receipt.id || receipt.receiptId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background border rounded-xl shadow-sm gap-4 hover:border-primary/30 transition-colors">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">{receipt.receiptId || receipt.id}</span>
                            <Badge variant={receipt.type === "ip" ? "default" : "secondary"} className="text-[10px] uppercase tracking-wider">
                              {receipt.type === "ip" ? "Advance Payment" : receipt.type}
                            </Badge>
                          </div>
                          <p className="font-medium text-foreground text-lg">{receipt.category}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {typeof receipt.date === 'string' ? receipt.date.split('T')[0] : ''} at {receipt.time} <span className="mx-2">•</span> Method: <strong className="uppercase">{receipt.method}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                          <p className="font-heading font-bold text-2xl text-primary">
                            {receipt.type === "ip" ? "-" : ""}₹{(receipt.amount || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 5. DISCHARGE TAB (Final Bill UI) */}
              <TabsContent value="discharge" className="p-6 m-0 bg-muted/5">
                <Card className="border-primary/20 shadow-md max-w-4xl mx-auto">
                  <CardHeader className="border-b border-border/50 bg-primary/5 pb-4">
                    <CardTitle className="text-primary flex items-center justify-between gap-2 text-xl">
                      <span className="flex items-center gap-2"><LogOut className="h-6 w-6" /> Discharge Summary & Final Bill</span>
                      <span className="text-sm font-mono text-muted-foreground">IP: {selectedIP.ipId}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6 text-sm">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Billed Items */}
                      <div className="bg-background rounded-xl border border-border p-5 space-y-4 shadow-sm">
                        <h4 className="font-heading font-bold text-base border-b pb-2 text-muted-foreground">Billed Charges</h4>
                        <div className="space-y-2">
                          {billedItems.length === 0 ? <p className="text-muted-foreground italic">No charges applied.</p> : 
                            billedItems.map(r => (
                              <div key={r.id || r.receiptId} className="flex justify-between items-center py-1">
                                <span className="capitalize">{r.category} <span className="text-xs text-muted-foreground">({typeof r.date === 'string' ? r.date.split('T')[0] : ''})</span></span>
                                <span className="font-medium">₹{(r.amount || 0).toFixed(2)}</span>
                              </div>
                            ))
                          }
                        </div>
                        <div className="flex justify-between items-center text-lg font-bold border-t pt-3 mt-4">
                          <span>Gross Total</span>
                          <span>₹{grossTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Advances Paid */}
                      <div className="bg-background rounded-xl border border-border p-5 space-y-4 shadow-sm">
                        <h4 className="font-heading font-bold text-base border-b pb-2 text-muted-foreground">Advances Paid</h4>
                        <div className="space-y-2">
                          {advances.length === 0 ? <p className="text-muted-foreground italic">No advances paid.</p> : 
                            advances.map(r => (
                              <div key={r.id || r.receiptId} className="flex justify-between items-center py-1 text-green-600">
                                <span>Advance Receipt <span className="text-xs opacity-70">({typeof r.date === 'string' ? r.date.split('T')[0] : ''})</span></span>
                                <span className="font-medium">- ₹{(r.amount || 0).toFixed(2)}</span>
                              </div>
                            ))
                          }
                        </div>
                        <div className="flex justify-between items-center text-lg font-bold border-t pt-3 mt-4 text-green-600">
                          <span>Total Advances</span>
                          <span>- ₹{totalAdvance.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Final Settlement */}
                    <div className="bg-primary/10 rounded-xl p-6 border border-primary/20 flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-primary">Final Settlement</h3>
                        <p className="text-muted-foreground text-xs mt-1">Gross Total (₹{grossTotal}) - Less Advances (₹{totalAdvance})</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-1">Net Payable Amount</p>
                        <p className="font-heading text-4xl font-bold text-primary">₹{netPayable.toFixed(2)}</p>
                      </div>
                    </div>

                    <Button 
                      className="w-full font-bold text-lg h-14 mt-4 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      onClick={() => handleDischarge(patientReceipts)}
                    >
                      <Printer className="h-5 w-5"/> Generate Final Bill & Discharge Patient
                    </Button>

                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // DEFAULT LIST VIEW (Table with Tabs for Active/Discharged)
  // ============================================================================
  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      <div>
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <BedDouble className="h-6 w-6 text-primary" /> Inpatient (IP)
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Manage admitted patients, apply treatments, and generate Final Discharge Bills.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-primary">{activeCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Admitted</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-destructive">{criticalCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Critical Patients</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-green-600">{stableRecoveringCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Stable / Recovering</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-muted/30">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-muted-foreground">{dischargedCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Discharged</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <CardTitle className="font-heading text-base">Patient Directory</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, IP ID, phone..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="w-full flex justify-start rounded-none border-b bg-muted/20 h-12 px-4">
              <TabsTrigger value="active" className="data-[state=active]:bg-background flex items-center gap-2 px-6">
                Active Admissions ({activeFiltered.length})
              </TabsTrigger>
              <TabsTrigger value="discharged" className="data-[state=active]:bg-background flex items-center gap-2 px-6">
                <CheckCircle className="h-4 w-4" /> Discharged History ({dischargedFiltered.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB: ACTIVE ADMISSIONS */}
            <TabsContent value="active" className="p-0 m-0">
              {activeFiltered.length === 0 ? (
                <div className="p-6">
                  <p className="text-muted-foreground text-sm text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                    {searchQuery ? "No active patients found matching your search." : "No patients are currently admitted."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left bg-muted/30">
                        <th className="p-4 font-medium text-muted-foreground">IP No.</th>
                        <th className="p-4 font-medium text-muted-foreground">Patient</th>
                        <th className="p-4 font-medium text-muted-foreground">Room / Bed</th>
                        <th className="p-4 font-medium text-muted-foreground">Disease</th>
                        <th className="p-4 font-medium text-muted-foreground">Status</th>
                        <th className="p-4 font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {activeFiltered.map((p) => (
                        <tr key={p.ipId} className="hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-mono text-xs text-primary font-bold">{p.ipId}</td>
                          <td className="p-4">
                            <p className="font-medium text-foreground">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Age {p.age} · Dr. {p.doctor}</p>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="bg-background text-foreground shadow-sm">{p.room}{p.bed ? ` / ${p.bed}` : ""}</Badge>
                          </td>
                          <td className="p-4">
                            <p className="font-medium text-foreground truncate max-w-[150px]">{p.disease}</p>
                          </td>
                          <td className="p-4">
                            <Select value={p.status} onValueChange={(v) => handleStatusUpdate(p, v as IPRecord["status"])}>
                              <SelectTrigger className={`h-8 text-xs w-28 ${p.status === 'critical' ? 'text-destructive border-destructive' : ''}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="stable">Stable</SelectItem>
                                <SelectItem value="recovering">Recovering</SelectItem>
                                <SelectItem value="discharged">Discharged</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-4 text-right">
                            <Button size="sm" onClick={() => setSelectedIP(p)}>
                              <ClipboardList className="h-4 w-4 mr-1.5" /> Manage & Bill
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* TAB: DISCHARGED HISTORY */}
            <TabsContent value="discharged" className="p-0 m-0">
              {dischargedFiltered.length === 0 ? (
                <div className="p-6">
                  <p className="text-muted-foreground text-sm text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                    {searchQuery ? "No discharged patients found matching your search." : "No discharged patient history available."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left bg-muted/30">
                        <th className="p-4 font-medium text-muted-foreground">IP No.</th>
                        <th className="p-4 font-medium text-muted-foreground">Patient</th>
                        <th className="p-4 font-medium text-muted-foreground">Admitted On</th>
                        <th className="p-4 font-medium text-muted-foreground">Disease</th>
                        <th className="p-4 font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {dischargedFiltered.map((p) => (
                        <tr key={p.ipId} className="hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-mono text-xs text-muted-foreground font-bold">{p.ipId}</td>
                          <td className="p-4">
                            <p className="font-medium text-foreground">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Ph: {p.phone} · Dr. {p.doctor}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm">{typeof p.dateOfAdmission === 'string' ? p.dateOfAdmission.split('T')[0] : p.dateOfAdmission}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-medium text-foreground truncate max-w-[150px]">{p.disease}</p>
                          </td>
                          <td className="p-4 text-right">
                            <Button size="sm" variant="outline" onClick={() => handlePrintFinalBill(p)}>
                              <Printer className="h-4 w-4 mr-1.5" /> Print Final Bill
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}