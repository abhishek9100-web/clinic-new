"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Plus, Trash2, Eye, Phone, Users, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getRMPs, addRMP, removeRMP, getOPRecords, type RMP, type OPRecord } from "@/components/api";

export default function RMPManagementPage() {
  const [rmps, setRmps] = useState<RMP[]>([]);
  const [opRecords, setOpRecords] = useState<OPRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [selectedRMP, setSelectedRMP] = useState<RMP | null>(null);
  const [selectedRMPReferrals, setSelectedRMPReferrals] = useState<OPRecord[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    name: "", phone: "", specialization: "", clinicName: "", address: "", discountPercent: "",
  });

  const loadData = async () => {
    try {
      const [rmpData, opData] = await Promise.all([
        getRMPs(),
        getOPRecords()
      ]);
      setRmps(rmpData || []);
      setOpRecords(opData || []);
    } catch (error) {
      toast.error("Failed to load RMP data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) { toast.error("Name and phone required"); return; }
    try {
      await addRMP({
        name: form.name, 
        phone: form.phone, 
        specialization: form.specialization,
        clinicName: form.clinicName, 
        address: form.address,
        discountPercent: Number(form.discountPercent) || 0,
      });
      toast.success(`RMP added: ${form.name}`);
      setForm({ name: "", phone: "", specialization: "", clinicName: "", address: "", discountPercent: "" });
      setShowForm(false);
      loadData();
    } catch (error) {
      toast.error("Failed to add RMP");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeRMP(id);
      toast.info("RMP removed");
      loadData();
    } catch (error) {
      toast.error("Failed to remove RMP");
    }
  };

  const openDetails = (rmp: RMP) => {
    setSelectedRMP(rmp);
    const rid = rmp.id || rmp.customId || "";
    // Filter referrals locally using the already fetched OP records
    const refs = opRecords.filter(op => op.referredByRmpId === rid);
    setSelectedRMPReferrals(refs);
    setShowDetails(true);
  };

  const filtered = searchQuery
    ? rmps.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.phone.includes(searchQuery))
    : rmps;

  // Calculate total referrals across all RMPs
  const totalReferrals = opRecords.filter(op => rmps.some(r => (r.id || r.customId) === op.referredByRmpId)).length;

  const formatDate = (d: string | Date | undefined) => {
    if (!d) return "";
    return new Date(d).toISOString().split("T")[0];
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading RMP Directory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" /> RMP Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage Registered Medical Practitioners and referral discounts</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Add RMP</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-primary">{rmps.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Total RMPs</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-accent-foreground">
              {rmps.filter(r => r.discountPercent > 0).length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">With Discounts</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-heading font-bold text-muted-foreground">
              {totalReferrals}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Total Referrals</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & List */}
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="font-heading text-base">RMP Directory ({filtered.length})</CardTitle>
          <div className="relative w-full sm:w-64">
            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name or phone..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {searchQuery ? "No RMPs found" : "No RMPs added yet. Click 'Add RMP' to get started."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">ID</th>
                    <th className="pb-3 font-medium text-muted-foreground">Name</th>
                    <th className="pb-3 font-medium text-muted-foreground">Phone</th>
                    <th className="pb-3 font-medium text-muted-foreground">Clinic</th>
                    <th className="pb-3 font-medium text-muted-foreground">Specialization</th>
                    <th className="pb-3 font-medium text-muted-foreground">Discount</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">Referrals</th>
                    <th className="pb-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rmp) => {
                    const rid = rmp.id || rmp.customId || "";
                    const refCount = opRecords.filter(op => op.referredByRmpId === rid).length;
                    return (
                      <tr key={rid} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 font-mono text-xs">{rid}</td>
                        <td className="py-3 font-medium">{rmp.name}</td>
                        <td className="py-3 text-muted-foreground">{rmp.phone}</td>
                        <td className="py-3 text-muted-foreground">{rmp.clinicName || "—"}</td>
                        <td className="py-3 text-muted-foreground">{rmp.specialization || "—"}</td>
                        <td className="py-3">
                          {rmp.discountPercent > 0 ? (
                            <Badge variant="secondary">{rmp.discountPercent}%</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 text-center">{refCount}</td>
                        <td className="py-3 flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openDetails(rmp)}>
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(rid)}>
                            <Trash2 className="h-3 w-3" />
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

      {/* Add RMP Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add New RMP</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="Dr. Name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input placeholder="Mobile number" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Specialization</Label>
                <Input placeholder="e.g. General Practice" value={form.specialization} onChange={(e) => setForm(f => ({ ...f, specialization: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Clinic Name</Label>
                <Input placeholder="Clinic / Hospital" value={form.clinicName} onChange={(e) => setForm(f => ({ ...f, clinicName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="Full address" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Discount Percentage (%)</Label>
              <Input type="number" min={0} max={100} placeholder="e.g. 10" value={form.discountPercent}
                onChange={(e) => setForm(f => ({ ...f, discountPercent: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Discount applied to OP consultation fee when patient is referred by this RMP</p>
            </div>
            <Button type="submit" className="w-full">Add RMP</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* RMP Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> RMP Details
            </DialogTitle>
          </DialogHeader>
          {selectedRMP && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium text-sm">{selectedRMP.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium text-sm">{selectedRMP.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Specialization</p>
                  <p className="font-medium text-sm">{selectedRMP.specialization || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Clinic</p>
                  <p className="font-medium text-sm">{selectedRMP.clinicName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium text-sm">{selectedRMP.address || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Discount</p>
                  <p className="font-medium text-sm text-primary">{selectedRMP.discountPercent}%</p>
                </div>
              </div>

              {/* Referred Patients */}
              <div>
                <h4 className="font-heading font-medium text-sm mb-2 flex items-center gap-1">
                  <Users className="h-4 w-4" /> Referred Patients ({selectedRMPReferrals.length})
                </h4>
                {selectedRMPReferrals.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No patients referred by this RMP yet</p>
                ) : (
                  <div className="space-y-2">
                    {[...selectedRMPReferrals].reverse().map((op) => (
                      <div key={op.opId} className="p-3 rounded-lg border flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">{op.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {op.opId} · Phone: {op.phone} · Doctor: {op.doctorName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">₹{op.finalAmount}</p>
                          {op.referredByRmpName && (
                            <p className="text-xs text-muted-foreground">Ref: {op.referredByRmpName}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{formatDate(op.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}