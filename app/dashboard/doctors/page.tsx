"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserCog, Plus, Trash2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getDoctors, addDoctor, removeDoctor, type Doctor } from "@/components/api";

export default function DoctorManagementPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", specialization: "", fee: "", phone: "" });

  const loadDoctors = async () => {
    try {
      const data = await getDoctors();
      setDoctors(data || []);
    } catch (error) {
      toast.error("Failed to load doctors");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoctor({
        name: form.name,
        specialization: form.specialization,
        fee: Number(form.fee),
        phone: form.phone,
        available: true,
      });
      toast.success("Doctor added");
      setForm({ name: "", specialization: "", fee: "", phone: "" });
      setOpen(false);
      loadDoctors(); // Refresh the list from the server
    } catch (error) {
      toast.error("Failed to add doctor");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeDoctor(id);
      toast.success("Doctor removed");
      loadDoctors(); // Refresh the list from the server
    } catch (error) {
      toast.error("Failed to remove doctor");
    }
  };

  const handleToggleAvailability = (id: string, isAvailable: boolean, name: string) => {
    // Optimistically update the UI so it feels instant
    setDoctors((prev) => 
      prev.map((doc) => ((doc.id || doc.customId) === id ? { ...doc, available: isAvailable } : doc))
    );
    toast.info(`${name} marked as ${isAvailable ? "available" : "unavailable"}`);
    
    // NOTE: To persist this to your DB, you will need to add an updateDoctor API endpoint 
    // to your store.ts and call it here.
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading doctors...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" /> Doctor Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage doctors, fees, and availability</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Doctor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Doctor</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Specialization *</Label>
                  <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Consultation Fee (₹) *</Label>
                  <Input type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full">Add Doctor</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {doctors.length === 0 ? (
           <p className="text-muted-foreground text-sm col-span-full py-8 text-center">No doctors found. Please add a doctor.</p>
        ) : (
          doctors.map((doc) => {
            const identifier = doc.id || doc.customId || "";
            return (
              <Card key={identifier} className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-heading font-bold text-sm">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{identifier}</p>
                      <Badge variant="secondary" className="mt-2">{doc.specialization}</Badge>
                      <p className="text-sm mt-2 font-medium">₹{doc.fee} <span className="text-muted-foreground font-normal">/ consultation</span></p>
                      {doc.phone && <p className="text-xs text-muted-foreground mt-1">📞 {doc.phone}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{doc.available ? "Available" : "Unavailable"}</span>
                        <Switch 
                          checked={doc.available} 
                          onCheckedChange={(v) => handleToggleAvailability(identifier, v, doc.name)} 
                        />
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(identifier)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}