"use client";

/**
 * LabInvestigationPage.tsx  (UPDATED)
 *
 * Changes:
 *  1. Orders list now shows per-investigation report completion status
 *     (e.g. "CBC ✓  |  RFT ⏳" with individual reportIds)
 *  2. Status badge shows X/Y done (e.g. "2/3 done")
 *  3. Clicking Complete only marks the ORDER as completed — individual
 *     report statuses are controlled from LabReportsPage.
 *  4. Enhanced design matching the lab reports page aesthetic.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FlaskConical, Printer, Plus, Trash2, Settings, Pencil,
  Loader2, Search, RefreshCw, CheckCircle2, Clock, Activity,
  FileText, TrendingUp,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getLabServices, getLabOrders, addLabService, updateLabService, removeLabService,
  createLabOrder, updateLabStatus, findPatientByPhone, findPatientByPhonePartial,
  getOPRecords, getReceipts, getLabReports,
  type OPRecord, type LabService, type LabOrder, type Receipt, type LabReportRecord,
} from "@/components/api";
import { generateServiceBillPDF } from "@/components/pdfGenerator";

export default function LabInvestigationPage() {
  const [labServices,   setLabServices]   = useState<LabService[]>([]);
  const [labOrders,     setLabOrders]     = useState<LabOrder[]>([]);
  const [labReports,    setLabReports]    = useState<LabReportRecord[]>([]);
  const [opRecords,     setOpRecords]     = useState<OPRecord[]>([]);
  const [receipts,      setReceipts]      = useState<Receipt[]>([]);

  const [isLoading,     setIsLoading]     = useState(true);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [userRole,      setUserRole]      = useState("admin");

  const [activeTab,         setActiveTab]         = useState("orders");
  const [orderSearchQuery,  setOrderSearchQuery]  = useState("");

  const [svcForm, setSvcForm] = useState({ name: "", category: "", amount: "", description: "" });
  const [editSvc, setEditSvc] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "", amount: "", description: "" });

  const [orderForm, setOrderForm] = useState({
    phone: "", opId: "", patientName: "", referredBy: "", paymentMethod: "cash",
    age: "", gender: "", doctorName: "",
  });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const loadData = async () => {
    try {
      const [servicesData, ordersData, opsData, receiptsData, reportsData] = await Promise.all([
        getLabServices(),
        getLabOrders(),
        getOPRecords(),
        getReceipts(),
        getLabReports(),
      ]);
      setLabServices(servicesData  || []);
      setLabOrders(ordersData      || []);
      setOpRecords(opsData         || []);
      setReceipts(receiptsData     || []);
      setLabReports(reportsData    || []);
    } catch {
      toast.error("Failed to load lab data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setUserRole(localStorage.getItem("medcare_role")?.toLowerCase() || "admin");
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success("Refreshed");
  };

  // ── Patient lookup ──────────────────────────────────────────────────────

  const handlePhoneLookup = async (phone: string) => {
    setOrderForm(p => ({ ...p, phone }));
    if (phone.length >= 10) {
      try {
        const patient =
          (await findPatientByPhone(phone)) ||
          (await findPatientByPhonePartial(phone));
        if (patient) {
          setOrderForm(p => ({
            ...p,
            opId:       patient.opId,
            patientName: patient.name,
            age:         patient.age    || "",
            gender:      patient.gender || "",
            doctorName:  patient.doctorName || "",
            referredBy:  patient.doctorName || "",
          }));
          toast.info(`Patient found: ${patient.name} (${patient.opId})`);
        }
      } catch { /* ignore */ }
    }
  };

  // ── Service selection ───────────────────────────────────────────────────

  const toggleService = (id: string) =>
    setSelectedServiceIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );

  const selectedTotal = selectedServiceIds.reduce((sum, id) => {
    const svc = labServices.find(s => (s.id || s.customId) === id);
    return sum + (svc?.amount || 0);
  }, 0);

  // ── Per-order report status helper ─────────────────────────────────────────

  function getOrderReportSummary(order: LabOrder): {
    reports: LabReportRecord[];
    completed: number;
    total: number;
  } {
    const orderId = order.orderId || order.id || "";
    const reports = labReports.filter(r => r.orderId === orderId);
    return {
      reports,
      completed: reports.filter(r => r.status === "completed").length,
      total:     reports.length,
    };
  }

  // ── Add service ─────────────────────────────────────────────────────────

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addLabService({
        name:        svcForm.name,
        category:    svcForm.category,
        amount:      Number(svcForm.amount),
        description: svcForm.description,
      });
      toast.success("Lab service added");
      setSvcForm({ name: "", category: "", amount: "", description: "" });
      loadData();
    } catch { toast.error("Failed to add test"); }
  };

  const handleEditSave = async () => {
    if (!editSvc) return;
    try {
      await updateLabService(editSvc, {
        name:        editForm.name,
        category:    editForm.category,
        amount:      Number(editForm.amount),
        description: editForm.description,
      });
      toast.success("Service updated");
      setEditSvc(null);
      loadData();
    } catch { toast.error("Failed to update test"); }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await removeLabService(id);
      toast.info("Test removed");
      loadData();
    } catch { toast.error("Failed to delete test"); }
  };

  // ── Create order ────────────────────────────────────────────────────────

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServiceIds.length === 0) { toast.error("Select at least one test"); return; }
    if (!orderForm.patientName)          { toast.error("Enter patient details");     return; }

    setIsSubmitting(true);

    const serviceNames = selectedServiceIds.map(id => {
      const svc = labServices.find(s => (s.id || s.customId) === id);
      return svc ? svc.name : "";
    });

    try {
      const order = await createLabOrder({
        opId:         orderForm.opId,
        patientName:  orderForm.patientName,
        phone:        orderForm.phone,
        serviceIds:   selectedServiceIds,
        serviceNames,
        amount:       selectedTotal,
        referredBy:   orderForm.referredBy,
        paymentMethod: orderForm.paymentMethod,
      });

      const billItems = selectedServiceIds.map(id => {
        const svc = labServices.find(s => (s.id || s.customId) === id)!;
        return { name: svc.name, amount: svc.amount, paid: svc.amount };
      });

      const patientRecord = {
        opId:       orderForm.opId,
        name:       orderForm.patientName,
        phone:      orderForm.phone,
        age:        orderForm.age,
        gender:     orderForm.gender,
        doctorName: orderForm.doctorName,
      } as OPRecord;

      const freshReceipts = await getReceipts();
      setReceipts(freshReceipts);
      const sortedR = [...freshReceipts].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const generatedReceipt = sortedR.find(r => r.opId === order.opId && r.type === "lab");
      const receiptRecord = generatedReceipt || {
        id: order.id || `REC-${Date.now().toString().slice(-6)}`,
        receiptId: order.id || `REC-${Date.now().toString().slice(-6)}`,
        opId: order.opId, patientName: order.patientName, phone: order.phone,
        type: "lab", category: "Lab Investigation Bill", amount: order.amount,
        method: order.paymentMethod,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      } as Receipt;

      generateServiceBillPDF("Lab Investigation Bill", patientRecord, receiptRecord, billItems, order.paymentMethod);

      toast.success("Lab order created", { description: `${serviceNames.length} test(s) — bill generated` });
      setOrderForm({ phone: "", opId: "", patientName: "", referredBy: "", paymentMethod: "cash", age: "", gender: "", doctorName: "" });
      setSelectedServiceIds([]);
      await loadData();
    } catch { toast.error("Failed to create order"); }
    finally { setIsSubmitting(false); }
  };

  // ── Update order status ─────────────────────────────────────────────────

  const handleUpdateStatus = async (id: string, status: LabOrder["status"]) => {
    try {
      await updateLabStatus(id, status);
      toast.success("Order updated");
      loadData();
    } catch { toast.error("Failed to update order status"); }
  };

  // ── Filter orders ───────────────────────────────────────────────────────

  const filteredOrders = labOrders.filter(o => {
    const oid = o.orderId || o.id || "";
    if (oid.startsWith("XR-")) return false;
    if (!orderSearchQuery) return true;
    const q = orderSearchQuery.toLowerCase();
    return (
      o.patientName?.toLowerCase().includes(q) ||
      o.phone?.includes(q) ||
      oid.toLowerCase().includes(q)
    );
  });

  // ── Stats ───────────────────────────────────────────────────────────────

  const pendingOrders   = filteredOrders.filter(o => o.status === "pending").length;
  const completedOrders = filteredOrders.filter(o => o.status === "completed").length;
  const todayOrders     = labOrders.filter(o => {
    const d = new Date(o.date || "");
    return d.toDateString() === new Date().toDateString();
  }).length;

  // ────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Loading Lab Investigation…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            Lab Investigation
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage lab tests, orders, and billing</p>
        </div>
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}
          className="rounded-xl h-10 w-10">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Orders",  value: filteredOrders.length, icon: FileText,     color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "Pending",       value: pendingOrders,         icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50"  },
          { label: "Completed",     value: completedOrders,       icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-50"  },
          { label: "Today",         value: todayOrders,           icon: Activity,      color: "text-purple-600", bg: "bg-purple-50" },
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-xl p-1 gap-1">
          <TabsTrigger value="orders" className="rounded-lg">Orders & Billing</TabsTrigger>
          {userRole === "admin" && (
            <TabsTrigger value="services" className="rounded-lg gap-1">
              <Settings className="h-3.5 w-3.5" /> Manage Tests
            </TabsTrigger>
          )}
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════
            ORDERS TAB
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="orders" className="space-y-6">

          {/* New Order */}
          <Card className="border shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" /> New Lab Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Phone *</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search by phone" className="pl-9 rounded-xl"
                        value={orderForm.phone}
                        onChange={e => handlePhoneLookup(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">OP/IP No.</Label>
                    <Input placeholder="OP-1001" className="rounded-xl"
                      value={orderForm.opId}
                      onChange={e => setOrderForm(p => ({ ...p, opId: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Patient Name *</Label>
                    <Input placeholder="Full name" className="rounded-xl"
                      value={orderForm.patientName}
                      onChange={e => setOrderForm(p => ({ ...p, patientName: e.target.value }))} required />
                  </div>
                </div>

                {/* Test selection grid */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Select Tests * <span className="normal-case text-muted-foreground/70">(multi-select)</span>
                  </Label>
                  {labServices.length === 0 ? (
                    <p className="text-muted-foreground text-sm bg-muted/40 rounded-xl p-4 text-center">
                      No tests added yet. Go to Manage Tests tab.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto rounded-xl border p-3 bg-muted/20">
                      {labServices.map(s => {
                        const sid = s.id || s.customId || "";
                        const checked = selectedServiceIds.includes(sid);
                        return (
                          <label key={sid} className={`
                            flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border
                            ${checked
                              ? "bg-blue-50 border-blue-300 shadow-sm"
                              : "bg-white border-transparent hover:border-muted-foreground/20 hover:bg-muted/30"
                            }
                          `}>
                            <Checkbox checked={checked} onCheckedChange={() => toggleService(sid)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{s.name}</p>
                              <p className="text-xs text-muted-foreground">₹{s.amount}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Referred By</Label>
                    <Input placeholder="Doctor name" className="rounded-xl"
                      value={orderForm.referredBy}
                      onChange={e => setOrderForm(p => ({ ...p, referredBy: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payment</Label>
                    <Select value={orderForm.paymentMethod}
                      onValueChange={v => setOrderForm(p => ({ ...p, paymentMethod: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedServiceIds.length > 0 && (
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex items-center justify-between">
                    <div className="flex gap-2 flex-wrap">
                      {selectedServiceIds.map(id => {
                        const svc = labServices.find(s => (s.id || s.customId) === id);
                        return (
                          <Badge key={id} variant="secondary" className="text-xs bg-white border">
                            {svc?.name}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="text-sm font-bold text-blue-700 ml-4 whitespace-nowrap">
                      ₹{selectedTotal}
                    </p>
                  </div>
                )}

                <Button type="submit" disabled={isSubmitting} className="rounded-xl gap-2">
                  {isSubmitting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <FlaskConical className="h-4 w-4" />}
                  {isSubmitting ? "Creating Order…" : "Order Lab Tests & Generate Bill"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Orders list */}
          <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                Lab Orders ({filteredOrders.length})
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search patient, OP…" className="pl-9 rounded-xl"
                  value={orderSearchQuery}
                  onChange={e => setOrderSearchQuery(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <FlaskConical className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground text-sm">
                    {orderSearchQuery ? "No matching orders." : "No lab orders yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...filteredOrders].reverse().map(order => {
                    const oid  = order.orderId || order.id || "";
                    const { reports, completed, total } = getOrderReportSummary(order);
                    const allDone = total > 0 && completed === total;

                    return (
                      <div key={oid} className={`
                        rounded-2xl border p-4 transition-all
                        ${allDone
                          ? "bg-green-50/60 border-green-200/60"
                          : "bg-white border-muted/60 hover:border-muted"
                        }
                      `}>
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">{order.patientName}</p>
                              <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded-lg">
                                {oid}
                              </span>
                              <span className="text-xs text-muted-foreground">{order.opId}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {typeof order.date === "string" ? order.date.split("T")[0] : ""}
                              {" · "}₹{order.amount}
                              {" · "}{order.paymentMethod?.toUpperCase()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Overall badge */}
                            <Badge className={
                              order.status === "completed"
                                ? "bg-green-600 text-white border-0 text-xs"
                                : "bg-amber-500 text-white border-0 text-xs"
                            }>
                              {order.status === "completed"
                                ? <CheckCircle2 className="h-3 w-3 mr-1" />
                                : <Clock className="h-3 w-3 mr-1" />}
                              {order.status}
                            </Badge>

                            {/* Report progress badge */}
                            {total > 0 && (
                              <Badge variant="outline" className={`text-xs ${allDone ? "border-green-400 text-green-700 bg-green-50" : "border-amber-400 text-amber-700 bg-amber-50"}`}>
                                {completed}/{total} reports
                              </Badge>
                            )}

                            {/* Complete order button */}
                            {order.status === "pending" && (
                              <Button size="sm" variant="outline"
                                className="h-8 rounded-xl text-xs"
                                onClick={() => handleUpdateStatus(oid, "completed")}>
                                Mark Complete
                              </Button>
                            )}

                            {/* Print bill */}
                            <Button size="sm" variant="outline"
                              className="h-8 w-8 p-0 rounded-xl"
                              onClick={() => {
                                const items = order.serviceNames.map((name, i) => {
                                  const svc = labServices.find(s => (s.id || s.customId) === order.serviceIds[i]);
                                  return { name, amount: svc?.amount || 0, paid: svc?.amount || 0 };
                                });
                                const matchedPatient = opRecords.find(p => p.opId === order.opId) || {
                                  opId: order.opId, name: order.patientName, phone: order.phone,
                                } as OPRecord;
                                const rec = receipts.find(r => r.opId === order.opId && r.type === "lab");
                                const receiptRecord = rec || {
                                  id: oid, receiptId: oid,
                                  opId: order.opId, patientName: order.patientName, phone: order.phone,
                                  type: "lab", category: "Lab Investigation Bill",
                                  amount: order.amount, method: order.paymentMethod,
                                  date: typeof order.date === "string" ? order.date.split("T")[0] : new Date().toLocaleDateString(),
                                  time: "",
                                } as Receipt;
                                generateServiceBillPDF("Lab Investigation Bill", matchedPatient, receiptRecord, items, order.paymentMethod);
                                toast.info("Bill generated");
                              }}>
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Per-investigation report status pills */}
                        {reports.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {reports.map(rep => (
                              <div key={rep.reportId} className={`
                                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border
                                ${rep.status === "completed"
                                  ? "bg-green-100 border-green-300 text-green-800"
                                  : "bg-amber-100 border-amber-300 text-amber-800"
                                }
                              `}>
                                {rep.status === "completed"
                                  ? <CheckCircle2 className="h-3 w-3" />
                                  : <Clock className="h-3 w-3" />}
                                <span>{rep.reportType}</span>
                                <span className="font-mono text-[10px] opacity-70">{rep.reportId}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Services as tags (when no reports yet) */}
                        {reports.length === 0 && order.serviceNames?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {order.serviceNames.map((name, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-muted/30">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            MANAGE TESTS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {userRole === "admin" && (
          <TabsContent value="services" className="space-y-6">
            <Card className="border shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-600" /> Add Lab Test
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddService} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Test Name *</Label>
                      <Input placeholder="e.g. CBC" className="rounded-xl"
                        value={svcForm.name} onChange={e => setSvcForm(p => ({ ...p, name: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category *</Label>
                      <Input placeholder="e.g. Hematology" className="rounded-xl"
                        value={svcForm.category} onChange={e => setSvcForm(p => ({ ...p, category: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Amount (₹) *</Label>
                      <Input type="number" placeholder="500" className="rounded-xl"
                        value={svcForm.amount} onChange={e => setSvcForm(p => ({ ...p, amount: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                      <Input placeholder="Optional" className="rounded-xl"
                        value={svcForm.description} onChange={e => setSvcForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                  </div>
                  <Button type="submit" className="rounded-xl gap-2">
                    <Plus className="h-4 w-4" /> Add Test
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Lab Tests ({labServices.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {labServices.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No tests added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {labServices.map(s => {
                      const sid = s.id || s.customId || "";
                      return (
                        <div key={sid} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                          <div>
                            <p className="font-medium text-sm">{s.name}
                              <span className="ml-2 text-xs text-muted-foreground">— {s.category}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sid} · ₹{s.amount}{s.description && ` · ${s.description}`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl"
                              onClick={() => {
                                setEditSvc(sid);
                                setEditForm({ name: s.name, category: s.category, amount: String(s.amount), description: s.description });
                              }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl text-destructive hover:bg-red-50"
                              onClick={() => handleDeleteService(sid)}>
                              <Trash2 className="h-3.5 w-3.5" />
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

      {/* Edit dialog */}
      <Dialog open={!!editSvc} onOpenChange={open => !open && setEditSvc(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold">Edit Lab Test</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label>
              <Input className="rounded-xl" value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Category</Label>
              <Input className="rounded-xl" value={editForm.category}
                onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Amount</Label>
              <Input type="number" className="rounded-xl" value={editForm.amount}
                onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label>
              <Input className="rounded-xl" value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
            <Button onClick={handleEditSave} className="w-full rounded-xl">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}