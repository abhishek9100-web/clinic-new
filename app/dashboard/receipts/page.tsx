"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt as ReceiptIcon, Printer, Search, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { 
  getReceipts, getOPRecords, getIPRecords, getMedicines, 
  type Receipt, type OPRecord, type IPRecord, type Medicine 
} from "@/components/api";
import { generateReceiptPDF, generateServiceBillPDF, type ServiceBillItem } from "@/components/pdfGenerator";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  op: "OP Consultation",
  payment: "OP Payment", // Legacy records
  medicine: "Pharmacy",
  xray: "X-Ray",
  treatment: "Treatment",
  surgery: "Surgery",
  ip: "Inpatient Advance",
  lab: "Lab Investigation",
  scan: "Scan",
};

const typeColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  op: "default",
  payment: "secondary",
  medicine: "outline",
  xray: "default",
  treatment: "secondary",
  surgery: "destructive",
  ip: "outline",
  lab: "default",
  scan: "default",
};

export default function ReceiptsPage() {
  const [receiptList, setReceiptList] = useState<Receipt[]>([]);
  const [opRecords, setOpRecords] = useState<OPRecord[]>([]);
  const [ipRecords, setIpRecords] = useState<IPRecord[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]); // CRITICAL FIX: Added medicines state
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Load data from Backend API
  const loadData = async () => {
    try {
      const [recs, ops, ips, meds] = await Promise.all([
        getReceipts(),
        getOPRecords(),
        getIPRecords(),
        getMedicines() // Fetch live medicines to map missing receipt details
      ]);
      setReceiptList(recs || []);
      setOpRecords(ops || []);
      setIpRecords(ips || []);
      setMedicines(meds || []);
    } catch (error) {
      toast.error("Failed to load receipts from server");
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
    toast.success("Receipts refreshed");
  };

  // Format date helper for the table view
  const formatTableDate = (dateStr: any) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const filtered = receiptList.filter((r) => {
    const rid = r.receiptId || r.id || "";
    const matchesSearch = !searchQuery ||
      r.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.opId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone?.includes(searchQuery) ||
      rid.toLowerCase().includes(searchQuery.toLowerCase());

    const recType = r.type?.toLowerCase() || "";
    // Allow the OP tab to match both legacy "payment" types and modern "op" types
    const matchesTab = activeTab === "all" || recType === activeTab || (activeTab === "op" && recType === "payment");
    return matchesSearch && matchesTab;
  });

  const handlePrint = (receipt: Receipt) => {
    // Crucial: Find the patient in OP or IP records to get Age/Gender/Doctor for the PDF
    const patientOp = opRecords.find(p => p.opId === receipt.opId);
    const patientIp = ipRecords.find(p => p.opId === receipt.opId || p.ipId === receipt.opId);
    const patient = patientOp || (patientIp as unknown as OPRecord);
    
    // Format receipt securely
    const formattedReceipt = {
      ...receipt,
      id: receipt.receiptId || receipt.id || "N/A"
    };

    // CRITICAL FIX: Intercept medicine receipts and map the missing data from the live medicines table
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
        return item; // Return as-is if deleted from DB
      });

      generateReceiptPDF(formattedReceipt, patient);
      toast.info("Downloading Pharmacy Receipt...");
      return;
    }

    // If it's a Lab, X-Ray, Surgery, Treatment, or Scan, route it to the Service Bill generator
    if (["lab", "xray", "surgery", "treatment", "scan"].includes(receipt.type?.toLowerCase())) {
      
      // 1. Try to get items from the correct itemDetails array
      let items: ServiceBillItem[] = (receipt.itemDetails || []).map(item => ({
        name: item.name,
        amount: item.amount,
        paid: item.amount 
      }));

      // 2. CRITICAL FIX: If itemDetails is empty (due to older Lab/Xray API saves), rescue the data from the 'details' string!
      if (items.length === 0) {
        if (receipt.details && receipt.details.includes(",")) {
          // Split multiple services and divide the cost evenly
          const names = receipt.details.split(",").map(n => n.trim());
          const splitAmount = receipt.amount / names.length;
          items = names.map(name => ({
            name: name,
            amount: splitAmount,
            paid: splitAmount
          }));
        } else {
          // Single service fallback
          items = [{
            name: receipt.details || receipt.category || "Service",
            amount: receipt.amount,
            paid: receipt.amount
          }];
        }
      }
      
      const billTitle = typeLabels[receipt.type?.toLowerCase()] ? `${typeLabels[receipt.type?.toLowerCase()]} Bill` : "Service Bill";
      generateServiceBillPDF(billTitle, patient, formattedReceipt, items, receipt.method || "CASH");
      toast.info(`Downloading ${billTitle} PDF...`);
    } else {
      // Standard OP Registration, Payments fall back to the generic generator
      generateReceiptPDF(formattedReceipt, patient);
      toast.info("Downloading receipt PDF...");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading receipts database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <ReceiptIcon className="h-6 w-6 text-primary" /> Billing Receipts
          </h2>
          <p className="text-muted-foreground text-sm mt-1">View, search, and reprint all hospital transactions</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patient, OP ID, receipt no..."
              className="pl-8 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex-wrap h-auto p-1 bg-muted/50 border border-border/50">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="op">OP Consultation</TabsTrigger>
          <TabsTrigger value="medicine">Pharmacy</TabsTrigger>
          <TabsTrigger value="lab">Lab</TabsTrigger>
          <TabsTrigger value="xray">X-Ray</TabsTrigger>
          <TabsTrigger value="treatment">Treatment</TabsTrigger>
          <TabsTrigger value="surgery">Surgery</TabsTrigger>
          <TabsTrigger value="ip">IP Advance</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b pb-4">
              <CardTitle className="font-heading text-base flex items-center justify-between">
                <span>{activeTab === "all" ? "Master" : typeLabels[activeTab]} Receipts</span>
                <Badge variant="outline" className="bg-background">{filtered.length} Records</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-muted-foreground text-sm">
                    {searchQuery ? "No matching receipts found." : "No records in this category yet."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10 text-left">
                        <th className="p-4 font-medium text-muted-foreground">Receipt ID</th>
                        <th className="p-4 font-medium text-muted-foreground">Patient Details</th>
                        <th className="p-4 font-medium text-muted-foreground">Category</th>
                        <th className="p-4 font-medium text-muted-foreground">Amount</th>
                        <th className="p-4 font-medium text-muted-foreground">Mode</th>
                        <th className="p-4 font-medium text-muted-foreground">Date & Time</th>
                        <th className="p-4 font-medium text-muted-foreground text-right">Print</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...filtered].reverse().map((r) => {
                        const rid = r.receiptId || r.id || "N/A";
                        return (
                          <tr key={r.id || rid} className="hover:bg-muted/20 transition-colors">
                            <td className="p-4 font-mono text-xs font-bold text-primary">{rid}</td>
                            <td className="p-4">
                              <p className="font-medium text-foreground">{r.patientName}</p>
                              <p className="text-[11px] text-muted-foreground">{r.opId} · {r.phone}</p>
                            </td>
                            <td className="p-4">
                              <Badge variant={typeColors[r.type?.toLowerCase()] || "outline"} className="text-[10px] uppercase font-bold px-2 py-0">
                                {typeLabels[r.type?.toLowerCase()] || r.type}
                              </Badge>
                            </td>
                            <td className="p-4 font-bold">₹{(r.amount || 0).toFixed(2)}</td>
                            <td className="p-4 uppercase text-xs font-medium">{r.method}</td>
                            <td className="p-4 text-xs text-muted-foreground">
                              {formatTableDate(r.date)}<br/>{r.time}
                            </td>
                            <td className="p-4 text-right">
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-primary hover:bg-primary/10" onClick={() => handlePrint(r)}>
                                <Printer className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}