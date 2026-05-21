"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Plus, Trash2, Search, Settings, Pencil, Loader2, RefreshCw, Stethoscope, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getOtherServices, getOtherOrders, addOtherService, updateOtherService, removeOtherService,
  createOtherOrder, updateOtherStatus, findPatientByPhone, findPatientByPhonePartial,
  getOPRecords, getReceipts, type OPRecord, type Receipt
} from "@/components/api";
import { generateServiceBillPDF } from "@/components/pdfGenerator";

export interface OtherService {
  id?: string;
  customId?: string;
  name: string;
  category: string;
  amount: number;
  description: string;
}

export interface OtherOrder {
  id?: string;
  orderId?: string;
  opId: string;
  patientName: string;
  phone: string;
  serviceIds: string[];
  serviceNames: string[];
  amount: number;
  referredBy: string;
  paymentMethod: string;
  status: string;
  date: string;
}

// Each row in the selected-items list
interface SelectedItem {
  uid: string;          // unique key per row (serviceId + timestamp)
  serviceId: string;
  name: string;
  price: number;        // editable by user
}

export default function OtherServicesPage() {
  const [services, setServices] = useState<OtherService[]>([]);
  const [orders, setOrders] = useState<OtherOrder[]>([]);
  const [opRecords, setOpRecords] = useState<OPRecord[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState("orders");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");

  // Service form
  const [svcForm, setSvcForm] = useState({ name: "", category: "", amount: "", description: "" });
  const [editSvc, setEditSvc] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "", amount: "", description: "" });

  // Order form
  const [orderForm, setOrderForm] = useState({
    phone: "", opId: "", patientName: "", referredBy: "", paymentMethod: "cash",
    age: "", gender: "", doctorName: ""
  });

  // ── NEW: list of selected items with editable price ───────────────────────
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // ── Default services ─────────────────────────────────────────────────────
  const defaultServices: OtherService[] = [
    { id: "default-1",  customId: "default-1",  name: "ECG",                          category: "Cardiology",   amount: 300,  description: "" },
    { id: "default-2",  customId: "default-2",  name: "Buddy Strapping",               category: "General",      amount: 200,  description: "" },
    { id: "default-7",  customId: "default-7",  name: "Suturing",                      category: "General",      amount: 1000, description: "" },
    { id: "default-8",  customId: "default-8",  name: "Suture Removal",                category: "General",      amount: 1000, description: "" },
    { id: "default-9",  customId: "default-9",  name: "Dressing Charges",              category: "General",      amount: 1000, description: "" },
    { id: "default-10", customId: "default-10", name: "Observation Bill",              category: "General",      amount: 500,  description: "" },
    { id: "default-11", customId: "default-11", name: "Nebulization",                  category: "General",      amount: 200,  description: "" },
    { id: "default-3",  customId: "default-3",  name: "POP Cast - Below Elbow",        category: "Orthopedics",  amount: 2500, description: "" },
    { id: "default-4",  customId: "default-4",  name: "POP Cast - Above Elbow",        category: "Orthopedics",  amount: 3000, description: "" },
    { id: "default-5",  customId: "default-5",  name: "POP Cast - Below Knee",         category: "Orthopedics",  amount: 3500, description: "" },
    { id: "default-6",  customId: "default-6",  name: "POP Cast - Above Knee",         category: "Orthopedics",  amount: 4000, description: "" },
    { id: "default-12", customId: "default-12", name: "POP Slab - Below Elbow",        category: "Orthopedics",  amount: 1500, description: "" },
    { id: "default-13", customId: "default-13", name: "POP Slab - Above Elbow",        category: "Orthopedics",  amount: 2000, description: "" },
    { id: "default-14", customId: "default-14", name: "POP Slab - Below Knee",         category: "Orthopedics",  amount: 2500, description: "" },
    { id: "default-15", customId: "default-15", name: "POP Slab - Above Knee",         category: "Orthopedics",  amount: 3000, description: "" },
  ];

  const loadData = async () => {
    try {
      const [servicesData, ordersData, opsData, receiptsData] = await Promise.all([
        getOtherServices(),
        getOtherOrders(),
        getOPRecords(),
        getReceipts()
      ]);

      if (!servicesData || servicesData.length === 0) {
        setServices(defaultServices);
      } else {
        setServices(servicesData);
      }

      setOrders(ordersData || []);
      setOpRecords(opsData || []);
      setReceipts(receiptsData || []);
    } catch {
      toast.error("Failed to load services data");
      setServices(defaultServices);
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
    toast.success("Data refreshed successfully");
  };

  const handlePhoneLookup = async (phone: string) => {
    setOrderForm((p) => ({ ...p, phone }));
    if (phone.length >= 10) {
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
      } catch {
        console.error("Error looking up patient");
      }
    }
  };

  // ── Add a service row to the selected list ────────────────────────────────
  const addServiceToList = (svc: OtherService) => {
    const uid = `${svc.id || svc.customId || ""}-${Date.now()}-${Math.random()}`;
    setSelectedItems((prev) => [
      ...prev,
      {
        uid,
        serviceId: svc.id || svc.customId || "",
        name: svc.name,
        price: svc.amount,
      },
    ]);
  };

  // ── Update price for a specific row ──────────────────────────────────────
  const updateItemPrice = (uid: string, newPrice: string) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.uid === uid ? { ...item, price: Number(newPrice) || 0 } : item
      )
    );
  };

  // ── Remove a specific row ─────────────────────────────────────────────────
  const removeItem = (uid: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.uid !== uid));
  };

  // ── Running total ─────────────────────────────────────────────────────────
  const selectedTotal = selectedItems.reduce((sum, item) => sum + (item.price || 0), 0);

  // ── Bill title helper ─────────────────────────────────────────────────────
  const getBillTitle = (names: string[]) => {
    if (names.length === 1) return `${names[0]} Bill`;
    return "Other Services Bill";
  };

  // ── Service CRUD ──────────────────────────────────────────────────────────
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addOtherService({
        name: svcForm.name,
        category: svcForm.category,
        amount: Number(svcForm.amount),
        description: svcForm.description
      });
      toast.success("Service added");
      setSvcForm({ name: "", category: "", amount: "", description: "" });
      loadData();
    } catch {
      toast.error("Failed to add service");
    }
  };

  const handleEditSave = async () => {
    if (!editSvc) return;
    try {
      await updateOtherService(editSvc, {
        name: editForm.name,
        category: editForm.category,
        amount: Number(editForm.amount),
        description: editForm.description
      });
      toast.success("Service updated");
      setEditSvc(null);
      loadData();
    } catch {
      toast.error("Failed to update service");
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await removeOtherService(id);
      toast.info("Service removed");
      loadData();
    } catch {
      toast.error("Failed to delete service");
    }
  };

  // ── Create order & generate PDF ───────────────────────────────────────────
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) { toast.error("Select at least one service"); return; }
    if (!orderForm.patientName)      { toast.error("Enter patient details");        return; }

    setIsSubmitting(true);

    const serviceNames = selectedItems.map((i) => i.name);
    const serviceIds   = selectedItems.map((i) => i.serviceId);
    const billTitle    = getBillTitle(serviceNames);

    try {
      const order = await createOtherOrder({
        opId: orderForm.opId,
        patientName: orderForm.patientName,
        phone: orderForm.phone,
        serviceIds,
        serviceNames,
        amount: selectedTotal,
        referredBy: orderForm.referredBy,
        paymentMethod: orderForm.paymentMethod,
      });

      const billItems = selectedItems.map((item) => ({
        name: item.name,
        amount: item.price,
        paid: item.price,
      }));

      const patientRecord = {
        opId: orderForm.opId,
        name: orderForm.patientName,
        phone: orderForm.phone,
        age: orderForm.age,
        gender: orderForm.gender,
        doctorName: orderForm.doctorName,
      } as OPRecord;

      const freshReceipts = await getReceipts();
      setReceipts(freshReceipts);

      const sortedReceipts = [...freshReceipts].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const generatedReceipt = sortedReceipts.find(
        (r) => r.opId === order.opId && r.type === "treatment"
      );

      const receiptRecord = generatedReceipt || ({
        id: "REC-PROCESSING",
        receiptId: "REC-PROCESSING",
        opId: order.opId,
        patientName: order.patientName,
        phone: order.phone,
        type: "treatment",
        category: billTitle,
        amount: order.amount,
        method: order.paymentMethod,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      } as Receipt);

      generateServiceBillPDF(billTitle, patientRecord, receiptRecord, billItems, order.paymentMethod);
      toast.success("Service ordered successfully", { description: "Bill PDF generated" });

      setOrderForm({ phone: "", opId: "", patientName: "", referredBy: "", paymentMethod: "cash", age: "", gender: "", doctorName: "" });
      setSelectedItems([]);
      await loadData();
    } catch {
      toast.error("Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: OtherOrder["status"]) => {
    try {
      await updateOtherStatus(id, status);
      toast.success("Order marked as complete");
      loadData();
    } catch {
      toast.error("Failed to update order status");
    }
  };

  // ── Reprint bill from history ─────────────────────────────────────────────
  const handleReprint = (x: OtherOrder) => {
    const oid = x.id || x.orderId || "";
    const items = x.serviceNames.map((name, i) => {
      const svc = services.find((s) => (s.id || s.customId) === x.serviceIds[i]);
      const unitAmt = svc?.amount ?? x.amount / x.serviceNames.length;
      return { name, amount: unitAmt, paid: unitAmt };
    });

    const matchedPatient = opRecords.find((p) => p.opId === x.opId) || ({
      opId: x.opId,
      name: x.patientName,
      phone: x.phone,
    } as OPRecord);

    const rec = receipts.find((r) => r.opId === x.opId && r.type === "treatment");
    const historicalTitle = getBillTitle(x.serviceNames || []);

    const receiptRecord = rec || ({
      id: oid,
      receiptId: oid,
      opId: x.opId,
      patientName: x.patientName,
      phone: x.phone,
      type: "treatment",
      category: historicalTitle,
      amount: x.amount,
      method: x.paymentMethod,
      date: typeof x.date === "string" ? x.date.split("T")[0] : new Date().toLocaleDateString(),
      time: ""
    } as Receipt);

    generateServiceBillPDF(historicalTitle, matchedPatient, receiptRecord, items, x.paymentMethod);
    toast.info("Bill regenerated successfully");
  };

  const filteredOrders = orders.filter((o) => {
    if (!orderSearchQuery) return true;
    const q = orderSearchQuery.toLowerCase();
    const oid = (o.orderId || o.id || "").toLowerCase();
    return (
      o.patientName?.toLowerCase().includes(q) ||
      o.phone?.includes(q) ||
      oid.includes(q)
    );
  });

  // ── Group services by category for display ───────────────────────────────
  const servicesByCategory = services.reduce<Record<string, OtherService[]>>((acc, svc) => {
    const cat = svc.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(svc);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading Services module...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" /> Other Services
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage ECG, POP Casts, POP Slabs, Suturing, and other hospital services
          </p>
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

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders">Billing &amp; Orders</TabsTrigger>
          <TabsTrigger value="services">
            <Settings className="h-3 w-3 mr-1" /> Manage Services
          </TabsTrigger>
        </TabsList>

        {/* ════════════ BILLING & ORDERS TAB ════════════ */}
        <TabsContent value="orders" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-base">New Service Bill</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrder} className="space-y-4">
                {/* Patient fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Phone Number *</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Enter phone to find patient"
                        className="pl-8"
                        value={orderForm.phone}
                        onChange={(e) => handlePhoneLookup(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>OP/IP No.</Label>
                    <Input
                      placeholder="OP-1001"
                      value={orderForm.opId}
                      onChange={(e) => setOrderForm((p) => ({ ...p, opId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Patient Name *</Label>
                    <Input
                      placeholder="Name"
                      value={orderForm.patientName}
                      onChange={(e) => setOrderForm((p) => ({ ...p, patientName: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* ── TWO-PANEL: Service picker (left) + Selected items (right) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                  {/* LEFT — service catalogue */}
                  <div className="space-y-2">
                    <Label>Services Catalogue <span className="text-muted-foreground text-xs">(click to add)</span></Label>
                    {services.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No services available.</p>
                    ) : (
                      <div className="border rounded-lg p-3 max-h-72 overflow-y-auto space-y-4">
                        {Object.entries(servicesByCategory).map(([category, catServices]) => (
                          <div key={category}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                              {category}
                            </p>
                            <div className="space-y-1">
                              {catServices.map((s) => {
                                const sid = s.id || s.customId || "";
                                return (
                                  <button
                                    key={sid}
                                    type="button"
                                    onClick={() => addServiceToList(s)}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-sm hover:bg-primary/10 hover:border-primary/30 border border-transparent transition-colors text-left"
                                  >
                                    <span>{s.name}</span>
                                    <span className="text-muted-foreground font-medium ml-2 shrink-0">
                                      ₹{s.amount}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* RIGHT — selected items list with editable prices */}
                  <div className="space-y-2">
                    <Label>
                      Selected Items
                      {selectedItems.length > 0 && (
                        <span className="ml-1.5 text-muted-foreground text-xs">
                          ({selectedItems.length})
                        </span>
                      )}
                    </Label>
                    <div className="border rounded-lg min-h-[180px] max-h-72 overflow-y-auto">
                      {selectedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground text-sm gap-1">
                          <Plus className="h-5 w-5 opacity-40" />
                          <span>Click services to add them here</span>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {/* Header row */}
                          <div className="grid grid-cols-[1fr_90px_32px] gap-2 px-3 py-1.5 bg-muted/40">
                            <span className="text-xs font-medium text-muted-foreground">Service</span>
                            <span className="text-xs font-medium text-muted-foreground text-center">Price (₹)</span>
                            <span />
                          </div>
                          {selectedItems.map((item) => (
                            <div
                              key={item.uid}
                              className="grid grid-cols-[1fr_90px_32px] gap-2 items-center px-3 py-2"
                            >
                              <span className="text-sm leading-tight">{item.name}</span>
                              <Input
                                type="number"
                                min={0}
                                value={item.price}
                                onChange={(e) => updateItemPrice(item.uid, e.target.value)}
                                className="h-7 text-sm text-center px-1"
                              />
                              <button
                                type="button"
                                onClick={() => removeItem(item.uid)}
                                className="flex items-center justify-center h-7 w-7 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Running total bar */}
                    {selectedItems.length > 0 && (
                      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                        <span className="text-sm font-medium">
                          {selectedItems.length} service{selectedItems.length !== 1 ? "s" : ""}
                        </span>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground block leading-none mb-0.5">Total</span>
                          <span className="text-base font-bold text-primary">₹{selectedTotal.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Referred by + payment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Referred By</Label>
                    <Input
                      placeholder="Doctor name"
                      value={orderForm.referredBy}
                      onChange={(e) => setOrderForm((p) => ({ ...p, referredBy: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment</Label>
                    <Select
                      value={orderForm.paymentMethod}
                      onValueChange={(v) => setOrderForm((p) => ({ ...p, paymentMethod: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Bill title preview */}
                {selectedItems.length > 0 && (
                  <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                    Bill title: <span className="font-medium text-foreground">
                      {getBillTitle(selectedItems.map((i) => i.name))}
                    </span>
                  </div>
                )}

                <Button type="submit" disabled={isSubmitting || selectedItems.length === 0}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isSubmitting ? "Generating Bill..." : "Generate Bill"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Orders history */}
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-base">
                Service Orders ({filteredOrders.length})
              </CardTitle>
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
                  {orderSearchQuery ? "No matching orders found." : "No orders yet."}
                </p>
              ) : (
                <div className="space-y-3">
                  {[...filteredOrders].reverse().map((x) => {
                    const oid = x.id || x.orderId || "";
                    return (
                      <div
                        key={oid}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {x.patientName} — {x.serviceNames?.join(", ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {oid} · {x.opId} · {typeof x.date === "string" ? x.date.split("T")[0] : ""} · ₹{x.amount} · {x.paymentMethod.toUpperCase()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={x.status === "completed" ? "default" : "outline"}>
                            {x.status}
                          </Badge>
                          {x.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(oid, "completed")}
                            >
                              Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReprint(x)}
                          >
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

        {/* ════════════ MANAGE SERVICES TAB ════════════ */}
        <TabsContent value="services" className="space-y-6">

          {/* Add new service */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-base">Add New Service</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddService} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label>Service Name *</Label>
                    <Input
                      placeholder="e.g. ECG"
                      value={svcForm.name}
                      onChange={(e) => setSvcForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category *</Label>
                    <Input
                      placeholder="e.g. Cardiology"
                      value={svcForm.category}
                      onChange={(e) => setSvcForm((p) => ({ ...p, category: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (₹) *</Label>
                    <Input
                      type="number"
                      placeholder="500"
                      value={svcForm.amount}
                      onChange={(e) => setSvcForm((p) => ({ ...p, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Input
                      placeholder="Optional notes"
                      value={svcForm.description}
                      onChange={(e) => setSvcForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                </div>
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-1" /> Add Service
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* All services — grouped by category */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-base">
                All Services ({services.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No services added yet</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(servicesByCategory).map(([category, catServices]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {category}
                      </p>
                      <div className="space-y-2">
                        {catServices.map((s) => {
                          const sid = s.id || s.customId || "";
                          return (
                            <div
                              key={sid}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                              <div>
                                <p className="font-medium text-sm">{s.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  ₹{s.amount}
                                  {s.description ? ` · ${s.description}` : ""}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditSvc(sid);
                                    setEditForm({
                                      name: s.name,
                                      category: s.category,
                                      amount: String(s.amount),
                                      description: s.description
                                    });
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => handleDeleteService(sid)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Edit Service Dialog ── */}
      <Dialog open={!!editSvc} onOpenChange={(open) => !open && setEditSvc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <Button onClick={handleEditSave} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}