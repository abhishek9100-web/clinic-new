"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Users, Phone, Eye, Calendar, Stethoscope, Pill, Receipt as ReceiptIcon, 
  X, Clock, BedDouble, Scissors, Syringe, FlaskConical, Loader2, ArrowLeft, Printer 
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getOPRecords, getReceipts, getXRayOrders, getLabOrders, getIPRecords, getSurgeries, getMedicines,
  type OPRecord, type Receipt, type XRayOrder, type LabOrder, type IPRecord, type SurgeryRecord, type Medicine
} from "@/components/api";
import { 
  generateOPRegistrationPDF, generateServiceBillPDF, generateReceiptPDF, 
  generateAdmissionPDF, type ServiceBillItem 
} from "@/components/pdfGenerator";

function isOPValid(dateStr: string | Date): boolean {
  if (!dateStr) return false;
  const opDate = new Date(dateStr);
  const now = new Date();
  return (now.getTime() - opDate.getTime()) / (1000 * 60 * 60 * 24) <= 15;
}

function getUniquePatients(opRecords: OPRecord[]): { phone: string; name: string; latestOP: OPRecord; opCount: number }[] {
  const map = new Map<string, { name: string; records: OPRecord[] }>();
  for (const r of opRecords) {
    if (!map.has(r.phone)) map.set(r.phone, { name: r.name, records: [] });
    map.get(r.phone)!.records.push(r);
  }
  return Array.from(map.entries()).map(([phone, { name, records }]) => ({
    phone,
    name: records[records.length - 1].name,
    latestOP: records[records.length - 1],
    opCount: records.length,
  }));
}

export default function PatientSearchPage() {
  const [data, setData] = useState<{
    opRecords: OPRecord[];
    receipts: Receipt[];
    xrayOrders: XRayOrder[];
    labOrders: LabOrder[];
    ipRecords: IPRecord[];
    surgeries: SurgeryRecord[];
    medicines: Medicine[]; // CRITICAL FIX: Added medicines to state
  }>({
    opRecords: [], receipts: [], xrayOrders: [], labOrders: [], ipRecords: [], surgeries: [], medicines: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllData() {
      try {
        const [ops, recs, xrays, labs, ips, surgs, meds] = await Promise.all([
          getOPRecords(), getReceipts(), getXRayOrders(), getLabOrders(), getIPRecords(), getSurgeries(), getMedicines()
        ]);
        
        setData({
          opRecords: Array.isArray(ops) ? ops : [],
          receipts: Array.isArray(recs) ? recs : [],
          xrayOrders: Array.isArray(xrays) ? xrays : [],
          labOrders: Array.isArray(labs) ? labs : [],
          ipRecords: Array.isArray(ips) ? ips : [],
          surgeries: Array.isArray(surgs) ? surgs : [],
          medicines: Array.isArray(meds) ? meds : [] // CRITICAL FIX: Storing medicines
        });
      } catch (error) {
        toast.error("Failed to load patient records");
      } finally {
        setIsLoading(false);
      }
    }
    fetchAllData();
  }, []);

  const { opRecords, receipts, xrayOrders, labOrders, ipRecords, surgeries, medicines } = data;

  const patients = getUniquePatients(opRecords);
  const filtered = searchQuery
    ? patients.filter(p =>
        p.phone.includes(searchQuery) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.latestOP.opId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : patients;

  // Selected Patient Data
  const patientOPs = selectedPhone ? opRecords.filter(r => r.phone === selectedPhone) : [];
  const patientReceipts = selectedPhone ? receipts.filter(r => r.phone === selectedPhone) : [];
  const patientXRays = selectedPhone ? xrayOrders.filter(r => r.phone === selectedPhone) : [];
  const patientLabs = selectedPhone ? labOrders.filter(r => r.phone === selectedPhone) : [];
  const patientIPs = selectedPhone ? ipRecords.filter(r => r.phone === selectedPhone) : [];
  const patientSurgeries = selectedPhone ? surgeries.filter(r => r.phone === selectedPhone) : [];
  const latestPatient = patientOPs.length > 0 ? patientOPs[patientOPs.length - 1] : null;

  const opPayments = patientReceipts.filter(r => r.type === "payment" || r.type === "op");
  const medReceipts = patientReceipts.filter(r => r.type === "medicine");
  const totalSpent = patientReceipts.reduce((s, r) => s + (r.amount || 0), 0);

  const allTreatments = patientIPs.flatMap(ip =>
    (ip.treatments || []).map(t => ({ ...t, ipId: ip.ipId, disease: ip.disease }))
  );

  const formatDate = (d: string | Date | undefined) => {
    if (!d) return "";
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return isNaN(dateObj.getTime()) ? String(d) : dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // --- PRINT HANDLERS ---
  const handlePrintOPCard = (op: OPRecord) => {
    generateOPRegistrationPDF(op);
    toast.info(`Downloading OP Card for ${op.opId}`);
  };

  const handlePrintReceipt = (receipt: Receipt) => {
    if (!latestPatient) return;
    const formattedReceipt = { ...receipt, id: receipt.receiptId || receipt.id || "N/A" };

    // CRITICAL FIX: If it's a medicine receipt, cross-reference the live `medicines` table 
    // to grab the missing Batch, Expiry, Manufacturer, and Schedule data!
    if (receipt.type?.toLowerCase() === "medicine") {
      let enrichedItems = formattedReceipt.itemDetails || [];
      
      // Fallback if itemDetails was empty but details had the name
      if (enrichedItems.length === 0 && formattedReceipt.details) {
        enrichedItems = [{ name: formattedReceipt.details, amount: formattedReceipt.amount, quantity: 1 }];
      }

      formattedReceipt.itemDetails = enrichedItems.map(item => {
        const matchingMed = medicines.find(m => m.name.toLowerCase() === item.name.toLowerCase());
        if (matchingMed) {
          return {
            ...item,
            batchNumber: matchingMed.batchNumber,
            manufacturer: matchingMed.manufacturer,
            expiryDate: matchingMed.expiryDate,
            schedule: matchingMed.schedule
          };
        }
        return item; // Return as-is if somehow deleted from the DB
      });

      generateReceiptPDF(formattedReceipt, latestPatient);
      toast.info("Downloading Pharmacy Receipt...");
      return;
    }

    if (["lab", "xray", "surgery", "treatment", "scan"].includes(receipt.type?.toLowerCase())) {
      let items: ServiceBillItem[] = (receipt.itemDetails || []).map(item => ({
        name: item.name, amount: item.amount, paid: item.amount 
      }));

      if (items.length === 0) {
        if (receipt.details && receipt.details.includes(",")) {
          const names = receipt.details.split(",").map(n => n.trim());
          const splitAmount = receipt.amount / names.length;
          items = names.map(name => ({ name, amount: splitAmount, paid: splitAmount }));
        } else {
          items = [{ name: receipt.details || receipt.category || "Service", amount: receipt.amount || 0, paid: receipt.amount || 0 }];
        }
      }
      const billTitle = `${receipt.category || "Service"} Bill`;
      generateServiceBillPDF(billTitle, latestPatient, formattedReceipt, items, receipt.method || "CASH");
    } else {
      generateReceiptPDF(formattedReceipt, latestPatient);
    }
    toast.info("Downloading Receipt...");
  };

  const handlePrintOrder = (order: XRayOrder | LabOrder, type: "X-Ray" | "Lab") => {
    if (!latestPatient) return;
    const items = (order.serviceNames || []).map(name => ({
      name, 
      amount: order.amount / Math.max(1, order.serviceNames.length), 
      paid: order.amount / Math.max(1, order.serviceNames.length)
    }));

    const receiptRecord = {
      id: order.orderId || order.id || `REC-${Date.now().toString().slice(-6)}`,
      opId: order.opId, 
      patientName: order.patientName, 
      phone: order.phone, 
      type: type === "X-Ray" ? "xray" : "lab", 
      category: `${type} Bill`, 
      amount: order.amount, 
      method: order.paymentMethod, 
      date: typeof order.date === 'string' ? order.date.split('T')[0] : new Date().toISOString(), 
      time: ""
    } as Receipt;

    generateServiceBillPDF(`${type} Bill`, latestPatient, receiptRecord, items, order.paymentMethod);
    toast.info(`Downloading ${type} Bill...`);
  };


  // --- RENDER LOADING ---
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading Patient Records...</span>
      </div>
    );
  }

  // --- RENDER PATIENT DETAILS VIEW ---
  if (selectedPhone && latestPatient) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 pb-10">
        <Button variant="ghost" onClick={() => setSelectedPhone(null)} className="pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Patient Directory
        </Button>

        <Card className="border-none shadow-sm overflow-hidden bg-primary/5 border border-primary/10">
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold text-primary">{latestPatient.name}</h2>
              <div className="text-sm text-muted-foreground mt-2 flex gap-x-6 gap-y-2 flex-wrap">
                <p><span className="font-medium text-foreground">Phone:</span> {latestPatient.phone}</p>
                <p><span className="font-medium text-foreground">Age/Gender:</span> {latestPatient.age} Y / {latestPatient.gender}</p>
                <p><span className="font-medium text-foreground">Village:</span> {latestPatient.village || "N/A"}</p>
                <p><span className="font-medium text-foreground">Latest OP:</span> {latestPatient.opId}</p>
              </div>
            </div>
            <div className="md:text-right bg-background p-4 rounded-xl shadow-sm border border-border/50 min-w-[200px]">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Total Lifetime Spend</p>
              <p className="font-heading font-bold text-3xl text-primary">₹{totalSpent.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="ops" className="w-full">
          <TabsList className="w-full flex justify-start rounded-none border-b bg-muted/20 h-14 px-4 overflow-x-auto">
            <TabsTrigger value="ops" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6"><Stethoscope className="h-4 w-4"/> OP Records</TabsTrigger>
            <TabsTrigger value="admissions" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6"><BedDouble className="h-4 w-4"/> Admissions</TabsTrigger>
            <TabsTrigger value="treatments" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6"><Syringe className="h-4 w-4"/> Doses</TabsTrigger>
            <TabsTrigger value="medicines" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6"><Pill className="h-4 w-4"/> Pharmacy</TabsTrigger>
            <TabsTrigger value="diagnostics" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6"><FlaskConical className="h-4 w-4"/> Lab & X-Ray</TabsTrigger>
            <TabsTrigger value="surgeries" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6"><Scissors className="h-4 w-4"/> Surgeries</TabsTrigger>
            <TabsTrigger value="receipts" className="data-[state=active]:bg-background flex items-center gap-2 h-10 px-6 ml-auto"><ReceiptIcon className="h-4 w-4"/> All Receipts</TabsTrigger>
          </TabsList>

          {/* OP TAB */}
          <TabsContent value="ops" className="p-0 mt-4 space-y-3">
            {patientOPs.length === 0 ? <p className="text-muted-foreground text-sm text-center py-10 bg-muted/10 rounded-lg border border-dashed">No OP records</p> : (
              [...patientOPs].reverse().map((op) => {
                const payment = opPayments.find(r => r.opId === op.opId);
                const valid = isOPValid(op.date);
                return (
                  <div key={op.opId} className="p-4 rounded-xl border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">{op.opId}</span>
                        <Badge variant={valid ? "default" : "destructive"} className="text-[10px] uppercase">{valid ? "Active" : "Expired"}</Badge>
                      </div>
                      <p className="text-sm font-medium">Consultation: Dr. {op.doctorName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(op.date)}
                      </p>
                      {payment && <p className="text-xs text-muted-foreground mt-1">Paid: ₹{payment.amount} via {payment.method.toUpperCase()}</p>}
                    </div>
                    <Button variant="outline" onClick={() => handlePrintOPCard(op)}>
                      <Printer className="h-4 w-4 mr-2" /> Print OP Card
                    </Button>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* ADMISSIONS TAB */}
          <TabsContent value="admissions" className="p-0 mt-4 space-y-3">
            {patientIPs.length === 0 ? <p className="text-muted-foreground text-sm text-center py-10 bg-muted/10 rounded-lg border border-dashed">No admission records</p> : (
              [...patientIPs].reverse().map((ip) => {
                const advReceipt = patientReceipts.find(r => r.type === "ip" && (r.opId === ip.opId || r.opId === ip.ipId));
                return (
                  <div key={ip.ipId} className="p-4 rounded-xl border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">{ip.ipId}</span>
                        <Badge variant={ip.status === "discharged" ? "secondary" : "default"} className="text-[10px] uppercase">{ip.status}</Badge>
                        <Badge variant="outline" className="text-[10px] uppercase">{ip.admissionType}</Badge>
                      </div>
                      <p className="text-sm"><span className="font-medium">Disease:</span> {ip.disease}</p>
                      <p className="text-xs text-muted-foreground">Doctor: {ip.doctor} · Room: {ip.room} · Dept: {ip.department || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">
                        Admitted: {formatDate(ip.dateOfAdmission || ip.admitted)} 
                        {ip.dateOfDischarge && ` · Discharged: ${formatDate(ip.dateOfDischarge)}`}
                      </p>
                    </div>
                    {advReceipt && (
                       <Button variant="outline" onClick={() => {
                          generateAdmissionPDF(ip, advReceipt);
                          toast.info("Downloading Admission Receipt");
                       }}>
                         <Printer className="h-4 w-4 mr-2" /> Print Advance Receipt
                       </Button>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* DOSES TAB */}
          <TabsContent value="treatments" className="p-0 mt-4 space-y-3">
            {allTreatments.length === 0 ? <p className="text-muted-foreground text-sm text-center py-10 bg-muted/10 rounded-lg border border-dashed">No treatment doses recorded</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[...allTreatments].reverse().map((t, idx) => (
                  <div key={t.id || idx} className="p-4 rounded-xl border bg-card space-y-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-xs">{t.type}</Badge>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{formatDate(t.date)} {t.time}</span>
                    </div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-mono text-[10px] text-muted-foreground">IP: {t.ipId}</span>
                      {t.administeredBy && <span className="text-[10px] text-muted-foreground uppercase font-bold">By: {t.administeredBy}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* PHARMACY TAB */}
          <TabsContent value="medicines" className="p-0 mt-4 space-y-3">
            {medReceipts.length === 0 ? <p className="text-muted-foreground text-sm text-center py-10 bg-muted/10 rounded-lg border border-dashed">No pharmacy records</p> : (
              [...medReceipts].reverse().map((r) => (
                <div key={r.id || r.receiptId} className="p-4 rounded-xl border bg-card flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">{r.receiptId || r.id}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(r.date)} {r.time}</span>
                    </div>
                    {r.itemDetails && r.itemDetails.length > 0 ? (
                      <div className="bg-muted/30 rounded p-3">
                        <table className="w-full text-sm">
                          <tbody>
                            {r.itemDetails.map((item, i) => (
                              <tr key={i} className="border-b last:border-0 border-border/40">
                                <td className="py-1 text-muted-foreground">{item.quantity || 1}x <span className="text-foreground font-medium">{item.name}</span></td>
                                <td className="py-1 text-right font-medium">₹{item.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="text-sm text-muted-foreground">{r.details}</p>}
                  </div>
                  <div className="flex flex-col items-end justify-between min-w-[120px]">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                      <p className="text-lg font-bold text-primary">₹{(r.amount || 0).toLocaleString()}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handlePrintReceipt(r)} className="mt-2 w-full md:w-auto">
                      <Printer className="h-3 w-3 mr-2" /> Print Bill
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* DIAGNOSTICS (LAB/XRAY) TAB */}
          <TabsContent value="diagnostics" className="p-0 mt-4 space-y-6">
            <div>
              <h4 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3 px-1">Lab Investigations</h4>
              {patientLabs.length === 0 ? <p className="text-muted-foreground text-sm py-4 px-4 bg-muted/10 rounded-lg border border-dashed">No lab records</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...patientLabs].reverse().map((lb) => (
                    <div key={lb.id || lb.orderId} className="p-4 rounded-xl border bg-card flex justify-between items-start gap-4">
                      <div>
                        <Badge variant={lb.status === "completed" ? "default" : "secondary"} className="mb-2 text-[10px] uppercase">{lb.status}</Badge>
                        <p className="text-sm font-medium">{lb.serviceNames?.join(", ")}</p>
                        <p className="text-xs text-muted-foreground mt-1">Ref: {lb.referredBy} · {formatDate(lb.date)}</p>
                        <p className="font-bold text-primary mt-2">₹{lb.amount}</p>
                      </div>
                      <Button size="icon" variant="outline" onClick={() => handlePrintOrder(lb, "Lab")}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h4 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3 px-1">X-Ray Scans</h4>
              {patientXRays.length === 0 ? <p className="text-muted-foreground text-sm py-4 px-4 bg-muted/10 rounded-lg border border-dashed">No X-Ray records</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...patientXRays].reverse().map((xr) => (
                    <div key={xr.id || xr.orderId} className="p-4 rounded-xl border bg-card flex justify-between items-start gap-4">
                      <div>
                        <Badge variant={xr.status === "completed" ? "default" : "secondary"} className="mb-2 text-[10px] uppercase">{xr.status}</Badge>
                        <p className="text-sm font-medium">{xr.serviceNames?.join(", ")}</p>
                        <p className="text-xs text-muted-foreground mt-1">Ref: {xr.referredBy} · {formatDate(xr.date)}</p>
                        <p className="font-bold text-primary mt-2">₹{xr.amount}</p>
                      </div>
                      <Button size="icon" variant="outline" onClick={() => handlePrintOrder(xr, "X-Ray")}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* SURGERIES TAB */}
          <TabsContent value="surgeries" className="p-0 mt-4 space-y-3">
            {patientSurgeries.length === 0 ? <p className="text-muted-foreground text-sm text-center py-10 bg-muted/10 rounded-lg border border-dashed">No surgery records</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[...patientSurgeries].reverse().map((s) => (
                  <div key={s.id} className="p-4 rounded-xl border bg-card space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-bold text-primary">{s.id}</span>
                      <Badge variant={s.status === "completed" ? "default" : "secondary"} className="text-[10px] uppercase">{s.status}</Badge>
                    </div>
                    <p className="text-base font-medium">{s.surgery}</p>
                    <div className="flex justify-between items-center pt-2 border-t text-xs text-muted-foreground">
                      <span>Dr. {s.surgeon}</span>
                      <span>{formatDate(s.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* RECEIPTS (ALL) TAB */}
          <TabsContent value="receipts" className="p-0 mt-4 space-y-3">
            {patientReceipts.length === 0 ? <p className="text-muted-foreground text-sm text-center py-10 bg-muted/10 rounded-lg border border-dashed">No receipts generated</p> : (
              <div className="grid grid-cols-1 gap-3">
                {[...patientReceipts].reverse().map((r) => (
                  <div key={r.id || r.receiptId} className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-primary">{r.receiptId || r.id}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{r.type}</Badge>
                      </div>
                      <p className="text-base font-medium">{r.category}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        {formatDate(r.date)} {r.time} <span className="mx-1">•</span> <strong className="uppercase">{r.method}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <p className="font-heading text-xl font-bold">₹{(r.amount || 0).toLocaleString()}</p>
                      <Button size="icon" variant="ghost" className="hover:bg-primary/10 hover:text-primary" onClick={() => handlePrintReceipt(r)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>
    );
  }

  // --- RENDER MASTER LIST VIEW ---
  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      <div>
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Patient Directory
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Search and view complete medical and billing histories.</p>
      </div>

      <Card className="border-none shadow-sm bg-primary/5 border border-primary/10">
        <CardContent className="p-4 md:p-6">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Search by mobile number, name, or OP ID..." className="pl-10 h-12 text-base shadow-sm"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-primary">{patients.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Patients</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-green-600">
              {opRecords.filter(r => isOPValid(r.date)).length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Active OPs</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-destructive/5">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-destructive">
              {opRecords.filter(r => !isOPValid(r.date)).length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Expired OPs</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b pb-4">
          <CardTitle className="font-heading text-base">All Registered Patients ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-sm">
                {searchQuery ? "No patients found matching your search." : "No patients registered yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left bg-muted/10">
                    <th className="p-4 font-medium text-muted-foreground">Patient Profile</th>
                    <th className="p-4 font-medium text-muted-foreground">Latest OP</th>
                    <th className="p-4 font-medium text-muted-foreground">Status</th>
                    <th className="p-4 font-medium text-muted-foreground text-center">Total Visits</th>
                    <th className="p-4 font-medium text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((p) => {
                    const valid = isOPValid(p.latestOP.date);
                    return (
                      <tr key={p.phone} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <p className="font-medium text-foreground text-base">{p.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {p.phone}
                          </p>
                        </td>
                        <td className="p-4 font-mono text-xs font-bold text-primary">{p.latestOP.opId}</td>
                        <td className="p-4">
                          <Badge variant={valid ? "default" : "destructive"} className="text-[10px] uppercase">
                            {valid ? "Active" : "Expired"}
                          </Badge>
                        </td>
                        <td className="p-4 text-center font-medium text-muted-foreground">{p.opCount}</td>
                        <td className="p-4 text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedPhone(p.phone)} className="hover:bg-primary hover:text-primary-foreground">
                            <Eye className="h-4 w-4 mr-2" /> Open Profile
                          </Button>
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
    </div>
  );
}