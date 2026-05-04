"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scissors, Plus, Eye, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getSurgeries, scheduleSurgery, updateSurgeryStatus, findIPByIpId,
  type SurgeryRecord, type IPRecord,
} from "@/components/api";

export default function SurgeryPage() {
  const [surgeriesList, setSurgeriesList] = useState<SurgeryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<SurgeryRecord | null>(null);

  // Form State
  const [ipIdInput, setIpIdInput] = useState("");
  const [foundIP, setFoundIP] = useState<IPRecord | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const [surgeryName, setSurgeryName] = useState("");
  const [surgeon, setSurgeon] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [preOpNotes, setPreOpNotes] = useState("");

  const loadData = async () => {
    try {
      const data = await getSurgeries();
      setSurgeriesList(data || []);
    } catch (error) {
      toast.error("Failed to load surgeries from server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearchIP = async () => {
    if (!ipIdInput.trim()) {
      toast.error("Enter an IP number to search");
      return;
    }
    
    setIsSearching(true);
    setFoundIP(null);
    try {
      const normalized = ipIdInput.toUpperCase().startsWith("IP-") ? ipIdInput.toUpperCase() : `IP-${ipIdInput}`;
      const found = await findIPByIpId(normalized);
      
      if (found && found.ipId) {
        setFoundIP(found);
        toast.success(`Patient Verified: ${found.name}`);
      } else {
        toast.error("No admitted patient found with this IP number.");
      }
    } catch (error) {
      toast.error("Error looking up patient.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundIP) {
      toast.error("Invalid IP number. Patient must be verified first.");
      return;
    }
    if (!surgeryName || !surgeon || !scheduledDate) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const s = await scheduleSurgery({
        ipId: foundIP.ipId,
        patientName: foundIP.name,
        phone: foundIP.phone,
        surgery: surgeryName,
        surgeon,
        date: scheduledDate,
        preOpNotes,
      });

      toast.success("Surgery scheduled", { description: `${s.id} - ${foundIP.name}` });
      
      // Reset form
      setShowForm(false);
      setIpIdInput("");
      setFoundIP(null);
      setSurgeryName("");
      setSurgeon("");
      setScheduledDate("");
      setPreOpNotes("");
      
      // Refresh list
      loadData();
    } catch (error) {
      toast.error("Failed to schedule surgery on the server.");
    }
  };

  const handleStatusChange = async (id: string, status: SurgeryRecord["status"]) => {
    try {
      await updateSurgeryStatus(id, status);
      toast.success("Surgery status updated");
      loadData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // Date formatter for display
  const formatDate = (dateStr: string | Date) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading surgeries data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Scissors className="h-6 w-6 text-primary" /> Surgery
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Schedule and track surgeries for admitted patients</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> {showForm ? "Cancel" : "Schedule Surgery"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-none shadow-sm max-w-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader><CardTitle className="font-heading text-base">Schedule New Surgery</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div className="space-y-2">
                <Label>Patient IP No. *</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. IP-123456" 
                    value={ipIdInput} 
                    onChange={(e) => {
                      setIpIdInput(e.target.value);
                      if (foundIP) setFoundIP(null); // Clear verification if they type something new
                    }} 
                  />
                  <Button type="button" variant="secondary" onClick={handleSearchIP} disabled={isSearching || !ipIdInput}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify IP"}
                  </Button>
                </div>
                
                {foundIP && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm border border-primary/20">
                    <p><span className="font-medium">{foundIP.name}</span> · Age {foundIP.age} · {foundIP.phone}</p>
                    <p className="text-xs text-muted-foreground">Disease: {foundIP.disease} · Room: {foundIP.room} · Doctor: {foundIP.doctor}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Surgery Name *</Label>
                  <Input placeholder="e.g. Appendectomy" required value={surgeryName} onChange={(e) => setSurgeryName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Lead Surgeon *</Label>
                  <Input placeholder="Doctor name" required value={surgeon} onChange={(e) => setSurgeon(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Scheduled Date *</Label>
                  <Input type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pre-Op Notes</Label>
                <Input placeholder="Notes..." value={preOpNotes} onChange={(e) => setPreOpNotes(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={!foundIP}>Schedule Surgery</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="font-heading text-base">Scheduled Surgeries ({surgeriesList.length})</CardTitle></CardHeader>
        <CardContent>
          {surgeriesList.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8 bg-muted/10 rounded-lg border border-dashed">No surgeries scheduled yet</p>
          ) : (
            <div className="space-y-3">
              {[...surgeriesList].reverse().map((s) => (
                <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card gap-4 hover:border-primary/40 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-base text-foreground">{s.surgery}</p>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">{s.id}</Badge>
                    </div>
                    <p className="text-sm font-medium text-primary">{s.patientName} <span className="text-muted-foreground text-xs font-mono ml-1">({s.ipId})</span></p>
                    <p className="text-xs text-muted-foreground mt-1">Surgeon: Dr. {s.surgeon} · Date: {formatDate(s.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={s.status} onValueChange={(v) => handleStatusChange(s.id, v as SurgeryRecord["status"])}>
                      <SelectTrigger className="h-9 text-xs w-[130px] font-medium shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedSurgery(s)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Surgery Details Dialog */}
      <Dialog open={!!selectedSurgery} onOpenChange={(open) => !open && setSelectedSurgery(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Surgery Details — {selectedSurgery?.id}</DialogTitle>
          </DialogHeader>
          {selectedSurgery && (
            <div className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 border border-border/50 rounded-xl">
                <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Patient</p><p className="font-medium text-base">{selectedSurgery.patientName}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">IP No.</p><p className="font-medium font-mono text-primary">{selectedSurgery.ipId}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Surgery</p><p className="font-medium">{selectedSurgery.surgery}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Lead Surgeon</p><p className="font-medium">Dr. {selectedSurgery.surgeon}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Date</p><p className="font-medium">{formatDate(selectedSurgery.date)}</p></div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Status</p>
                  <Badge variant={selectedSurgery.status === "completed" ? "default" : selectedSurgery.status === "cancelled" ? "destructive" : "secondary"} className="uppercase text-[10px]">
                    {selectedSurgery.status}
                  </Badge>
                </div>
              </div>
              {selectedSurgery.preOpNotes && (
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <p className="text-xs text-primary font-bold mb-1 uppercase tracking-wide">Pre-Op Notes</p>
                  <p className="text-muted-foreground leading-relaxed">{selectedSurgery.preOpNotes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}