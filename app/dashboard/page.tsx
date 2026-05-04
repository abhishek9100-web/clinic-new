"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BedDouble, Stethoscope, TrendingUp, Activity, Loader2, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

// Import your API helpers and interfaces from the centralized store
import { 
  getOPRecords, 
  getReceipts, 
  getDoctors, 
  getIPRecords, 
  getSurgeries,
  type OPRecord, 
  type Receipt, 
  type Doctor, 
  type IPRecord, 
  type SurgeryRecord 
} from "@/components/api";

const COLORS = ["hsl(174,62%,32%)", "hsl(210,80%,52%)", "hsl(38,92%,50%)", "hsl(152,60%,40%)", "hsl(0,72%,51%)"];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    opRecords: OPRecord[];
    receipts: Receipt[];
    doctors: Doctor[];
    ipRecords: IPRecord[];
    surgeries: SurgeryRecord[];
  }>({
    opRecords: [],
    receipts: [],
    doctors: [],
    ipRecords: [],
    surgeries: [],
  });

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel using the centralized store helpers
        const [opRes, recRes, docRes, ipRes, surgRes] = await Promise.all([
          getOPRecords(),
          getReceipts(),
          getDoctors(),
          getIPRecords(),
          getSurgeries(),
        ]);

        // Validate that responses are arrays before setting state
        setData({
          opRecords: Array.isArray(opRes) ? opRes : [],
          receipts: Array.isArray(recRes) ? recRes : [],
          doctors: Array.isArray(docRes) ? docRes : [],
          ipRecords: Array.isArray(ipRes) ? ipRes : [],
          surgeries: Array.isArray(surgRes) ? surgRes : [],
        });
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
        setError("Failed to load dashboard data. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading Hospital Analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 text-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Oops! Something went wrong</h2>
        <p className="text-muted-foreground">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // --- Calculations ---
  const { opRecords, receipts, doctors, ipRecords, surgeries } = data;

  // Helper to safely format dates from the DB
  const getFormatDate = (d: string | Date) => new Date(d).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const todayOPs = opRecords.filter(r => getFormatDate(r.date) === today);
  const todayReceipts = receipts.filter(r => getFormatDate(r.date) === today);
  const todayRevenue = todayReceipts.reduce((s, r) => s + (r.amount || 0), 0);
  const totalPatients = new Set(opRecords.map(r => r.phone)).size;
  const admittedCount = ipRecords.filter(r => r.status !== "discharged").length;

  const stats = [
    { label: "Total Patients", value: String(totalPatients), icon: Users, change: `${opRecords.length} Total OPs` },
    { label: "OP Today", value: String(todayOPs.length), icon: Stethoscope, change: `${todayOPs.filter(r => r.status === "waiting").length} waiting` },
    { label: "Admitted (IP)", value: String(admittedCount), icon: BedDouble, change: `${ipRecords.length} total · ${surgeries.filter(s => s.status === "scheduled").length} surgeries` },
    { label: "Revenue Today", value: `₹${todayRevenue.toLocaleString()}`, icon: TrendingUp, change: `${todayReceipts.length} txns` },
  ];

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split("T")[0];
    
    const dayOPs = opRecords.filter(r => getFormatDate(r.date) === ds).length;
    const dayRev = receipts.filter(r => getFormatDate(r.date) === ds).reduce((s, r) => s + (r.amount || 0), 0);
    
    return { day: d.toLocaleDateString("en-IN", { weekday: "short" }), ops: dayOPs, revenue: dayRev };
  });

  const specMap = new Map<string, number>();
  for (const op of opRecords) {
    const doc = doctors.find(d => (d.id || d.customId) === op.doctorId);
    const spec = doc?.specialization || "General";
    specMap.set(spec, (specMap.get(spec) || 0) + 1);
  }
  const departmentData = Array.from(specMap.entries()).map(([name, value]) => ({ name, value }));

  const recentOPs = [...opRecords].reverse().slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Hospital overview — live MongoDB data</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-heading font-bold mt-1">{stat.value}</p>
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" /> {stat.change}
                  </span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> OP Visits (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {last7.some(d => d.ops > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,90%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="ops" fill="hsl(174,62%,32%)" name="OPs" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-16">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Revenue (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {last7.some(d => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,90%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(val: number) => `₹${val.toLocaleString()}`} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(174,62%,32%)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-16">No revenue data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-base">Department Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {departmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={departmentData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {departmentData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">No department data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-base">Recent OP Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOPs.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No registrations yet</p>
            ) : (
              <div className="space-y-3">
                {recentOPs.map((p) => (
                  <div key={p.opId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.opId} · {p.doctorName} · ₹{p.consultationFee}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}