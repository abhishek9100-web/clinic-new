"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Printer, Plus, Trash2, Search, Settings, Pencil, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getECGServices, getECGOrders, addECGService, updateECGService, removeECGService,
  createECGOrder, updateECGStatus, findPatientByPhone, findPatientByPhonePartial,
  getOPRecords, getReceipts, type OPRecord, type ECGService, type ECGOrder, type Receipt
} from "@/components/api"; // Make sure your api.ts exports these ECG functions/types
import { generateServiceBillPDF } from "@/components/pdfGenerator";

export default function ECGPage() {
  const [ecgServices, setEcgServices] = useState<ECGService[]>([]);
  const [ecgOrders, setEcgOrders] = useState<ECGOrder[]>([]);
  const [opRecords, setOpRecords] = useState<OPRecord[]>([]); 
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string>("admin");
  
  const [activeTab, setActiveTab] = useState("orders");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");

  // Service form - Pre-filled with ECG default 400 Rs
  const [svcForm, setSvcForm] = useState({ name: "ECG", bodyPart: "General", amount: "400", description: "Standard Electrocardiogram" });
  const [editSvc, setEditSvc] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", bodyPart: "", amount: "", description: "" });

  // Order form
  const [orderForm, setOrderForm] = useState({
    phone: "", opId: "", patientName: "", referredBy: "", paymentMethod: "cash",
    age: "", gender: "", doctorName: ""
  });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const loadData = async () => {
    try {
      const [servicesData, ordersData, opsData, receiptsData] = await Promise.all([
        getECGServices(),
        getECGOrders(),
        getOPRecords(),
        getReceipts()
      ]);
      setEcgServices(servicesData || []);
      setEcgOrders(ordersData || []);
      setOpRecords(opsData || []);
      setReceipts(receiptsData || []);
    } catch (error) {
      toast.error("Failed to load ECG data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("medcare_role")?.toLowerCase() || "admin";
    setUserRole(role);
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success("Data refreshed successfully");
  };

  const handlePhoneLookup = async (phone: string) => {
    setOrderForm((p) => ({ ...p, phone }));
    if (phone.length >= 4) {
      try {
        const patient = (await findPatientByPhone(phone)) || (await findPatientByPhonePartial(phone));
        if (patient) {
          setOrderForm((p) => ({ 
            ...p, 
            opId: patient.opId, 
            patientName: patient.name,
            age: patient.age || "",
            gender: patient.gender || "",
            doctorName: patient.doctorName || "",
            referredBy: (patient as any).doctorName || "" 
          }));
          if (phone === patient.phone) toast.info(`Patient found: ${patient.name} (${patient.opId})`);
        }
      } catch (error) {
        console.error("Error looking up patient", error);
      }
    }
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectedTotal = selectedServiceIds.reduce((sum, id) => {
    const svc = ecgServices.find(s => (s.id || s.customId) === id);
    return sum + (svc?.amount || 0);
  }, 0);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addECGService({ 
        name: svcForm.name, 
        bodyPart: svcForm.bodyPart, 
        amount: Number(svcForm.amount), 
        description: svcForm.description 
      });
      toast.success("ECG service added");
      setSvcForm({ name: "ECG", bodyPart: "General", amount: "400", description: "Standard Electrocardiogram" });
      loadData();
    } catch (error) {
      toast.error("Failed to add service");
    }
  };

  const handleEditSave = async () => {
    if (!editSvc) return;
    try {
      await updateECGService(editSvc, { 
        name: editForm.name, 
        bodyPart: editForm.bodyPart, 
        amount: Number(editForm.amount), 
        description: editForm.description 
      });
      toast.success("Service updated");
      setEditSvc(null);
      loadData();
    } catch (error) {
      toast.error("Failed to update service");
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await removeECGService(id);
      toast.info("Service removed");
      loadData();
    } catch (error) {
      toast.error("Failed to delete service");
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServiceIds.length === 0) { toast.error("Select at least one service"); return; }
    if (!orderForm.patientName) { toast.error("Enter patient details"); return; }

    setIsSubmitting(true);

    const serviceNames = selectedServiceIds.map(id => {
      const svc = ecgServices.find(s => (s.id || s.customId) === id);
      return svc ? `${svc.name} (${svc.bodyPart})` : "";
    });

    try {
      const order = await createECGOrder({
        opId: orderForm.opId,
        patientName: orderForm.patientName,
        phone: orderForm.phone,
        serviceIds: selectedServiceIds,
        serviceNames,
        amount: selectedTotal,
        referredBy: orderForm.referredBy,
        paymentMethod: orderForm.paymentMethod,
      });

      const billItems = selectedServiceIds.map(id => {
        const svc = ecgServices.find(s => (s.id || s.customId) === id)!;
        return { name: `${svc.name} (${svc.bodyPart})`, amount: svc.amount, paid: svc.amount };
      });

      const patientRecord = {
        opId: orderForm.opId,
        name: orderForm.patientName,
        phone: orderForm.phone,
        age: orderForm.age,
        gender: orderForm.gender,
        doctorName: orderForm.doctorName,
      } as OPRecord;

      // Fetch fresh receipts to get the EXACT newly generated receipt ID
      const freshReceipts = await getReceipts();
      setReceipts(freshReceipts);
      
      const sortedReceipts = [...freshReceipts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const generatedReceipt = sortedReceipts.find(r => r.opId === order.opId && r.type === "ecg");

      const receiptRecord = generatedReceipt || {
        id: "REC-PROCESSING", 
        receiptId: "REC-PROCESSING",
        opId: order.opId, 
        patientName: order.patientName, 
        phone: order.phone, 
        type: "ecg", 
        category: "ECG Bill", 
        amount: order.amount, 
        method: order.paymentMethod, 
        date: new Date().toLocaleDateString(), 
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) 
      } as Receipt;

      generateServiceBillPDF("ECG Bill", patientRecord, receiptRecord, billItems, order.paymentMethod);

      toast.success(`ECG ordered successfully`, { description: "Bill PDF generated" });
      setOrderForm({ phone: "", opId: "", patientName: "", referredBy: "", paymentMethod: "cash", age: "", gender: "", doctorName: "" });
      setSelectedServiceIds([]);
      await loadData();
    } catch (error) {
      toast.error("Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: ECGOrder["status"]) => {
    try {
      await updateECGStatus(id, status);
      toast.success("Order marked as complete");
      loadData();
    } catch (error) {
      toast.error("Failed to update order status");
    }
  };

  const filteredOrders = ecgOrders.filter(o => {
    const oid = o.orderId || o.id || "";
    
    // STRICT FILTER: If it doesn't start with ECG-, hide it!
    if (!oid.startsWith("ECG-")) return false;

    if (orderSearchQuery) {
      const q = orderSearchQuery.toLowerCase();
      return (
        o.patientName?.toLowerCase().includes(q) || 
        o.phone?.includes(q) || 
        oid.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading ECG module...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <X className="h-6 w-6 text-primary" /> ECG Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage ECG services, orders, and billing</p>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          title="Refresh Data"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders">Orders & Billing</TabsTrigger>
          {userRole === "admin" && (
            <TabsTrigger value="services"><Settings className="h-3 w-3 mr-1" /> Manage Services</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="font-heading text-base">New ECG Order</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Phone Number *</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Enter phone to find patient" className="pl-8" value={orderForm.phone}
                        onChange={(e) => handlePhoneLookup(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>OP/IP No.</Label>
                    <Input placeholder="OP-1001" value={orderForm.opId}
                      onChange={(e) => setOrderForm((p) => ({ ...p, opId: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Patient Name *</Label>
                    <Input placeholder="Name" value={orderForm.patientName}
                      onChange={(e) => setOrderForm((p) => ({ ...p, patientName: e.target.value }))} required />
                  </div>
                </div>

                {/* Multi-select services */}
                <div className="space-y-2">
                  <Label>Select ECG Services * (multi-select)</Label>
                  {ecgServices.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No services added. Go to Manage Services tab first.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                      {ecgServices.map((s) => {
                        const sid = s.id || s.customId || "";
                        return (
                          <label key={sid} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedServiceIds.includes(sid) ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}>
                            <Checkbox checked={selectedServiceIds.includes(sid)} onCheckedChange={() => toggleService(sid)} />
                            <span className="text-sm">{s.name} — ₹{s.amount}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Referred By</Label>
                    <Input placeholder="Doctor name" value={orderForm.referredBy}
                      onChange={(e) => setOrderForm((p) => ({ ...p, referredBy: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment</Label>
                    <Select value={orderForm.paymentMethod} onValueChange={(v) => setOrderForm((p) => ({ ...p, paymentMethod: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedServiceIds.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="font-medium">Selected: {selectedServiceIds.length} service(s) · Total: ₹{selectedTotal}</p>
                  </div>
                )}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {isSubmitting ? "Generating Order..." : "Order ECG & Generate Bill"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-base">ECG Orders ({filteredOrders.length})</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search patient, OP, phone..." 
                  className="pl-8" 
                  value={orderSearchQuery} 
                  onChange={(e) => setOrderSearchQuery(e.target.value)} 
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredOrders.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  {orderSearchQuery ? "No matching orders found." : "No ECG orders yet."}
                </p>
              ) : (
                <div className="space-y-3">
                  {[...filteredOrders].reverse().map((x) => {
                    const oid = x.id || x.orderId || "";
                    return (
                      <div key={oid} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{x.patientName} — {x.serviceNames?.join(", ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {oid} · {x.opId} · {typeof x.date === 'string' ? x.date.split('T')[0] : ''} · ₹{x.amount} · {x.paymentMethod.toUpperCase()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={x.status === "completed" ? "default" : "outline"}>{x.status}</Badge>
                          {x.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(oid, "completed")}>
                              Complete
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => {
                            const items = x.serviceNames.map((name, i) => {
                              const svc = ecgServices.find(s => (s.id || s.customId) === x.serviceIds[i]);
                              return { name, amount: svc?.amount || x.amount / x.serviceNames.length, paid: svc?.amount || x.amount / x.serviceNames.length };
                            });

                            const matchedPatient = opRecords.find(p => p.opId === x.opId) || {
                              opId: x.opId,
                              name: x.patientName,
                              phone: x.phone,
                            } as OPRecord;

                            // Lookup exact receipt for historical printing
                            const rec = receipts.find(r => r.opId === x.opId && r.type === "ecg");
                            const receiptRecord = rec || {
                              id: oid,
                              receiptId: oid,
                              opId: x.opId, 
                              patientName: x.patientName, 
                              phone: x.phone, 
                              type: "ecg", 
                              category: "ECG Bill", 
                              amount: x.amount, 
                              method: x.paymentMethod, 
                              date: typeof x.date === 'string' ? x.date.split('T')[0] : new Date().toLocaleDateString(), 
                              time: ""
                            } as Receipt;

                            generateServiceBillPDF("ECG Bill", matchedPatient, receiptRecord, items, x.paymentMethod);
                            toast.info("ECG bill generated");
                          }}>
                            <Printer className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {userRole === "admin" && (
          <TabsContent value="services" className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="font-heading text-base">Add ECG Service</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAddService} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label>Service Name *</Label>
                      <Input placeholder="e.g. ECG" value={svcForm.name}
                        onChange={(e) => setSvcForm((p) => ({ ...p, name: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Body Part *</Label>
                      <Input placeholder="e.g. General" value={svcForm.bodyPart}
                        onChange={(e) => setSvcForm((p) => ({ ...p, bodyPart: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Amount (₹) *</Label>
                      <Input type="number" placeholder="400" value={svcForm.amount}
                        onChange={(e) => setSvcForm((p) => ({ ...p, amount: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Input placeholder="Optional notes" value={svcForm.description}
                        onChange={(e) => setSvcForm((p) => ({ ...p, description: e.target.value }))} />
                    </div>
                  </div>
                  <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Add Service</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="font-heading text-base">ECG Services ({ecgServices.length})</CardTitle></CardHeader>
              <CardContent>
                {ecgServices.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No services added yet</p>
                ) : (
                  <div className="space-y-3">
                    {ecgServices.map((s) => {
                      const sid = s.id || s.customId || "";
                      return (
                        <div key={sid} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium text-sm">{s.name} — {s.bodyPart}</p>
                            <p className="text-xs text-muted-foreground">{sid} · ₹{s.amount} {s.description && `· ${s.description}`}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => { 
                              setEditSvc(sid); 
                              setEditForm({ name: s.name, bodyPart: s.bodyPart, amount: String(s.amount), description: s.description }); 
                            }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteService(sid)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Service Dialog */}
      <Dialog open={!!editSvc} onOpenChange={(open) => !open && setEditSvc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Edit ECG Service</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Body Part</Label><Input value={editForm.bodyPart} onChange={(e) => setEditForm(f => ({ ...f, bodyPart: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={editForm.amount} onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
            <Button onClick={handleEditSave} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}