"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Stethoscope,
  BedDouble,
  Syringe,
  X,
  Receipt,
  CreditCard,
  ClipboardList,
  UserCog,
  Pill,
  Search,
  UserCheck,
  FlaskConical,
  ServerCog,
  TestTubes,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

// ─── Role type ────────────────────────────────────────────────────────────────
type Role = "admin" | "receptionist" | "pharmacist" | "lab" | string;

// ─── Nav item shape ───────────────────────────────────────────────────────────
interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  end?: boolean;
}

// ─── Role → landing page map ──────────────────────────────────────────────────
/**
 * Where each role should land after login (or on any visit to /dashboard).
 * Admin, Receptionist, Pharmacist keep the default /dashboard overview.
 * Lab goes straight to /dashboard/labreport — their only page.
 */
const ROLE_HOME: Record<string, string> = {
  lab:         "/dashboard/labreport",
  // All other roles stay on /dashboard (no entry needed, handled as fallback)
};

// ─── All nav items by group ───────────────────────────────────────────────────

const mainItems: NavItem[] = [
  { title: "Dashboard",         url: "/dashboard",               icon: LayoutDashboard, end: true },
  { title: "Outpatient (OP)",   url: "/dashboard/outpatient",    icon: Stethoscope },
  { title: "X-Ray",             url: "/dashboard/xray",          icon: X },
  { title: "Lab Investigation", url: "/dashboard/lab",           icon: FlaskConical, end: true },
  { title: "Lab Reports",       url: "/dashboard/labreport",     icon: TestTubes },
  { title: "Other Services",    url: "/dashboard/otherservices", icon: ServerCog },
  { title: "Pharmacy Billing",  url: "/dashboard/billing",       icon: CreditCard },
];

const clinicalItems: NavItem[] = [
  { title: "Inpatient (IP)",  url: "/dashboard/inpatient",  icon: BedDouble },
  { title: "Admission",       url: "/dashboard/addmission", icon: ClipboardList },
  { title: "Treatment Doses", url: "/dashboard/treatment",  icon: Syringe },
];

const managementItems: NavItem[] = [
  { title: "Doctors",   url: "/dashboard/doctors",   icon: UserCog },
  { title: "Medicines", url: "/dashboard/medicines", icon: Pill },
  { title: "RMP",       url: "/dashboard/rmp",       icon: UserCheck },
];

const billingItems: NavItem[] = [
  { title: "Receipts", url: "/dashboard/receipts", icon: Receipt },
];

const recordItems: NavItem[] = [
  { title: "Patient Records", url: "/dashboard/patients", icon: Search },
];

// ─── Role-based filter helpers ────────────────────────────────────────────────
/**
 * Normalise the stored role string so comparisons are case-insensitive.
 * Falls back to "admin" when nothing is stored (dev convenience).
 */
function normaliseRole(raw: string | null): Role {
  if (!raw) return "admin";
  return raw.toLowerCase() as Role;
}

/**
 * Returns only the nav items each role is allowed to see.
 *
 * Receptionist : OP, X-Ray, Lab Investigation, Lab Reports, Other Services
 * Pharmacist   : Pharmacy Billing, Inpatient, Admission, Treatment Doses,
 *                Medicines, Receipts
 * Lab          : Lab Reports only
 * Admin        : everything
 */
function getFilteredItems(role: Role) {
  const is = (r: Role) => role === r;

  // ── Main group ──────────────────────────────────────────────────────────────
  const RECEPTIONIST_MAIN = new Set([
    "Outpatient (OP)",
    "X-Ray",
    "Lab Investigation",
    "Lab Reports",
    "Other Services",
  ]);

  const PHARMACIST_MAIN = new Set(["Pharmacy Billing"]);
  const LAB_MAIN        = new Set(["Lab Reports"]);

  const filteredMain = mainItems.filter((item) => {
    if (is("admin"))        return true;
    if (is("receptionist")) return RECEPTIONIST_MAIN.has(item.title);
    if (is("pharmacist"))   return PHARMACIST_MAIN.has(item.title);
    if (is("lab"))          return LAB_MAIN.has(item.title);
    return false;
  });

  // ── Clinical group ──────────────────────────────────────────────────────────
  const filteredClinical = clinicalItems.filter(() =>
    is("admin") || is("pharmacist")
  );

  // ── Management group ────────────────────────────────────────────────────────
  const PHARMACIST_MGMT = new Set(["Medicines"]);

  const filteredManagement = managementItems.filter((item) => {
    if (is("admin"))      return true;
    if (is("pharmacist")) return PHARMACIST_MGMT.has(item.title);
    return false;
  });

  // ── Billing group ───────────────────────────────────────────────────────────
  const filteredBilling = billingItems.filter(() =>
    is("admin") || is("pharmacist")
  );

  // ── Records group ───────────────────────────────────────────────────────────
  const filteredRecords = recordItems.filter(() =>
    is("admin") || is("receptionist")
  );

  return {
    filteredMain,
    filteredClinical,
    filteredManagement,
    filteredBilling,
    filteredRecords,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AppSidebar() {
  const [role, setRole] = useState<Role | null>(null);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("medcare_role");
    const normRole = normaliseRole(stored);
    setRole(normRole);

    // ── Role-based landing redirect ──────────────────────────────────────────
    // If this role has a custom home page AND the user is currently sitting on
    // the plain /dashboard root, push them to their designated landing page.
    // This covers both initial login and any manual navigation to /dashboard.
    const roleHome = ROLE_HOME[normRole];
    if (roleHome && pathname === "/dashboard") {
      router.replace(roleHome);
    }
  }, [pathname, router]);

  // Loading skeleton — keeps header height stable
  if (!role) {
    return (
      <Sidebar
        collapsible="none"
        className="bg-transparent border-none w-full shadow-none text-slate-100"
      >
        <SidebarHeader className="p-3 border-b border-slate-800 h-[65px]" />
      </Sidebar>
    );
  }

  const {
    filteredMain,
    filteredClinical,
    filteredManagement,
    filteredBilling,
    filteredRecords,
  } = getFilteredItems(role);

  // ── Render helpers ───────────────────────────────────────────────────────────
  const renderGroup = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel className="text-slate-500 uppercase tracking-wider text-[11px] font-bold px-4 py-2">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <NavLink
                    href={item.url}
                    end={item.end ?? false}
                    className="flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-slate-300 hover:bg-slate-800 hover:text-white"
                    activeClassName="bg-primary text-primary-foreground font-medium"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar
      collapsible="none"
      className="bg-transparent border-none w-full shadow-none text-slate-100"
    >
      <SidebarHeader className="p-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Stethoscope className="h-4 w-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <h2 className="font-heading text-sm font-bold text-white truncate">
              NewLifeCare HMS
            </h2>
            <p className="text-[10px] text-slate-400 truncate">
              Hospital Management
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {renderGroup("Main",       filteredMain)}
        {renderGroup("Clinical",   filteredClinical)}
        {renderGroup("Management", filteredManagement)}
        {renderGroup("Billing",    filteredBilling)}
        {renderGroup("Records",    filteredRecords)}
      </SidebarContent>
    </Sidebar>
  );
}