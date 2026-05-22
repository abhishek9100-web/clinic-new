"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Stethoscope, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ─── Role → landing page map ──────────────────────────────────────────────────
// ALL keys must be lowercase — getLandingPage lowercases the role before lookup.
const ROLE_LANDING: Record<string, string> = {
  lab:         "/dashboard/labreport",   // ← key is lowercase "lab"
  // pharmacist: "/dashboard/billing",
};

function getLandingPage(rawRole: string): string {
  const role = rawRole.toLowerCase().trim();   // "Lab" → "lab", " Lab " → "lab"

  // ── Debug logs — remove once confirmed working ────────────────────────────
  console.log("[LOGIN] raw role from API  :", rawRole);
  console.log("[LOGIN] normalised role     :", role);
  console.log("[LOGIN] ROLE_LANDING map   :", ROLE_LANDING);
  console.log("[LOGIN] matched landing    :", ROLE_LANDING[role] ?? "/dashboard (fallback)");

  return ROLE_LANDING[role] ?? "/dashboard";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      console.log("[LOGIN] full API response:", data);

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // ── Persist auth ────────────────────────────────────────────────────
      localStorage.setItem("medcare_token", data.token);
      localStorage.setItem("medcare_user",  JSON.stringify(data.user));
      localStorage.setItem("medcare_role",  data.user.role);   // e.g. "Lab"

      console.log("[LOGIN] stored role in localStorage:", data.user.role);

      toast.success(`Welcome back, ${data.user.fullName}!`);

      // ── Role-based redirect ─────────────────────────────────────────────
      const destination = getLandingPage(data.user.role);
      console.log("[LOGIN] navigating to:", destination);

      router.replace(destination);

    } catch (error: any) {
      console.error("[LOGIN] error:", error);
      toast.error(error.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-4">
      {/* Brand header */}
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
          <Stethoscope className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">New Life Care HMS</h1>
        <p className="text-sm text-slate-500">Hospital Management System</p>
      </div>

      {/* Login card */}
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-xl text-center">Sign in to your account</CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="doctor@medcare.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}