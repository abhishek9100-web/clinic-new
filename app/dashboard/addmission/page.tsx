"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Search, Printer, Users, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  admitPatient, findPatientByPhoneAll, getDoctors, getIPRecords, 
  type Doctor, type IPRecord, type Receipt
} from "@/components/api";
import { generateAdmissionPDF } from "@/components/pdfGenerator";

export default function AdmissionPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [ipRecords, setIpRecords] = useState<IPRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [admissionType, setAdmissionType] = useState<"General Admission" | "Surgical Admission">("General Admission");

  const [formData, setFormData] = useState({
    name: "", age: "", gender: "", phone: "", village: "",
    disease: "", room: "", bed: "", doctor: "", notes: "",
    department: "", management: "Medical Management" as "Medical Management" | "Surgical Management",
    admissionCharges: "", paymentMethod: "cash", dateOfAdmission: new Date().toISOString().split("T")[0],
    dateOfDischarge: "", diagnosis: "",
  });

  const loadData = async () => {
    try {
      const [docsData, ipData] = await Promise.all([
        getDoctors(),
        getIPRecords()
      ]);
      setDoctors(docsData || []);
      setIpRecords(ipData || []);
    } catch (error) {
      toast.error("Failed to load admission data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const set = (key: string, val: string) => setFormData((p) => ({ ...p, [key]: val }));

  const handlePhoneLookup = async (phoneStr: string) => {
    // Update the phone immediately so typing feels perfectly smooth
    set("phone", phoneStr);
    
    if (phoneStr.length >= 4) {
      try {
        const patient = await findPatientByPhoneAll(phoneStr);
        if (patient) {
          setFormData((p) => ({
            ...p,
            // CRITICAL FIX: Do NOT overwrite the phone number here. 
            // It prevents the stuttering/stuck input issue while the user is actively typing.
            name: patient.name || p.name,
            age: patient.age || p.age,
            gender: patient.gender || p.gender,
            village: patient.village || p.village,
          }));
          if (phoneStr === patient.phone) {
            toast.info(`Patient found: ${patient.name} (${patient.opId})`);
          }
        }
      } catch (error) {
        console.error("Error finding patient:", error);
      }
    }
  };

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error("Please fill patient name and phone");
      return;
    }
    if (!formData.disease || !formData.room) {
      toast.error("Please fill disease and room");
      return;
    }
    if (!formData.doctor) {
      toast.error("Please select a doctor");
      return;
    }

    try {
      const ip = await admitPatient({
        name: formData.name,
        age: formData.age,
        gender: formData.gender,
        phone: formData.phone,
        village: formData.village,
        room: formData.room,
        bed: formData.bed,
        doctor: formData.doctor,
        disease: formData.disease,
        department: formData.department,
        admissionType,
        management: formData.management,
        admissionCharges: Number(formData.admissionCharges) || 0,
        dateOfAdmission: formData.dateOfAdmission,
        dateOfDischarge: formData.dateOfDischarge,
        diagnosis: formData.diagnosis || formData.disease,
        type: "Full Treatment",
        notes: formData.notes,
      });
      
      // Pass a constructed Receipt object to prevent the PDF generator from crashing
      const advanceReceipt = {
        id: `REC-${Date.now().toString().slice(-6)}`,
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        method: formData.paymentMethod,
      } as Receipt;

      generateAdmissionPDF(ip, advanceReceipt);
      
      toast.success("Patient admitted successfully!", { description: `IP Number: ${ip.ipId} — PDF downloaded` });
      
      setFormData({
        name: "", age: "", gender: "", phone: "", village: "",
        disease: "", room: "", bed: "", doctor: "", notes: "",
        department: "", management: "Medical Management",
        admissionCharges: "", paymentMethod: "cash", dateOfAdmission: new Date().toISOString().split("T")[0],
        dateOfDischarge: "", diagnosis: "",
      });

      loadData();
    } catch (error) {
      toast.error("Failed to admit patient");
    }
  };

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return "";
    return new Date(dateString).toISOString().split("T")[0];
  };

  const recentAdmissions = [...ipRecords].reverse();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading Admission module...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Admission
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Admit patients — General or Surgical admission</p>
      </div>

      <Card className="border-none shadow-sm max-w-5xl w-full">
        <CardHeader>
          <CardTitle className="font-heading text-base">New Admission</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Type of Admission *</Label>
              <Select value={admissionType} onValueChange={(v) => setAdmissionType(v as typeof admissionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="General Admission">General Admission</SelectItem>
                  <SelectItem value="Surgical Admission">Surgical Admission</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Enter phone to auto-fill" className="pl-8"
                    value={formData.phone} onChange={(e) => handlePhoneLookup(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="Patient name" value={formData.name} onChange={(e) => set("name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Age *</Label>
                <Input type="number" placeholder="Age" value={formData.age} onChange={(e) => set("age", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Village</Label>
                <Input placeholder="Village name" value={formData.village} onChange={(e) => set("village", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input placeholder="e.g. Orthopedics, General" value={formData.department} onChange={(e) => set("department", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-border">
              <div className="space-y-1.5">
                <Label>Disease / Diagnosis *</Label>
                <Input placeholder="e.g. Fracture, Diabetes" required value={formData.disease} onChange={(e) => set("disease", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Diagnosis</Label>
                <Input placeholder="Detailed diagnosis" value={formData.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Management</Label>
                <Select value={formData.management} onValueChange={(v) => set("management", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Medical Management">Medical Management</SelectItem>
                    <SelectItem value="Surgical Management">Surgical Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Doctor *</Label>
                <Select value={formData.doctor} onValueChange={(v) => set("doctor", v)}>
                  <SelectTrigger><SelectValue placeholder="Select Doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id || d.customId} value={d.name}>{d.name} ({d.specialization})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Room / Ward *</Label>
                <Input placeholder="e.g. ICU-3, W-12" required value={formData.room} onChange={(e) => set("room", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bed Number</Label>
                <Input placeholder="e.g. B-4" value={formData.bed} onChange={(e) => set("bed", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-border">
              <div className="space-y-1.5">
                <Label>Date of Admission</Label>
                <Input type="date" value={formData.dateOfAdmission} onChange={(e) => set("dateOfAdmission", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date of Discharge</Label>
                <Input type="date" value={formData.dateOfDischarge} onChange={(e) => set("dateOfDischarge", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Admission Charges (₹)</Label>
                <Input type="number" placeholder="0" value={formData.admissionCharges} onChange={(e) => set("admissionCharges", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={formData.paymentMethod} onValueChange={(v) => set("paymentMethod", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Additional notes..." value={formData.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            <Button type="submit"><Printer className="h-4 w-4 mr-1" /> Admit Patient & Print</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm max-w-5xl w-full">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Admissions History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {recentAdmissions.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">No patients have been admitted yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">IP ID</th>
                    <th className="px-4 py-3 font-medium">Patient Name</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Room/Bed</th>
                    <th className="px-4 py-3 font-medium">Doctor</th>
                    <th className="px-4 py-3 font-medium">Admitted On</th>
                    <th className="px-4 py-3 font-medium">Discharged On</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentAdmissions.map((ip) => {
                    // Calculate dynamic status based on discharge date existence
                    const isDischarged = ip.status === "Discharged" || !!ip.dateOfDischarge;
                    return (
                      <tr key={ip.ipId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-primary">{ip.ipId}</td>
                        <td className="px-4 py-3">{ip.name}</td>
                        <td className="px-4 py-3">{ip.phone}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{ip.room}</span> {ip.bed && `/ ${ip.bed}`}
                        </td>
                        <td className="px-4 py-3">{ip.doctor}</td>
                        <td className="px-4 py-3">{formatDate(ip.dateOfAdmission || (ip as any).admitted)}</td>
                        <td className="px-4 py-3">{ip.dateOfDischarge ? formatDate(ip.dateOfDischarge) : "-"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={isDischarged ? "outline" : "default"}>
                            {isDischarged ? "Discharged" : "Admitted"}
                          </Badge>
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