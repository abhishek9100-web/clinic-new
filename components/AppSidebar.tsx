"use client";

import { useEffect, useState } from "react";
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

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Outpatient (OP)", url: "/dashboard/outpatient", icon: Stethoscope },
  { title: "X-Ray", url: "/dashboard/xray", icon: X },
  { title: "Lab Investigation", url: "/dashboard/lab", icon: FlaskConical },
  { title: "Pharmacy Billing", url: "/dashboard/billing", icon: CreditCard },
];

const clinicalItems = [
  { title: "Inpatient (IP)", url: "/dashboard/inpatient", icon: BedDouble },
  { title: "Admission", url: "/dashboard/addmission", icon: ClipboardList },
  { title: "Treatment Doses", url: "/dashboard/treatment", icon: Syringe },
];

const managementItems = [
  { title: "Doctors", url: "/dashboard/doctors", icon: UserCog },
  { title: "Medicines", url: "/dashboard/medicines", icon: Pill },
  { title: "RMP", url: "/dashboard/rmp", icon: UserCheck },
];

const billingItems = [
  { title: "Receipts", url: "/dashboard/receipts", icon: Receipt },
];

const recordItems = [
  { title: "Patient Records", url: "/dashboard/patients", icon: Search },
];

export function AppSidebar() {
  const [role, setRole] = useState<string | null>(null);

  // Read the role from localStorage as soon as the sidebar mounts
  useEffect(() => {
    const storedRole = localStorage.getItem("medcare_role");
    setRole(storedRole ? storedRole.toLowerCase() : "admin"); // Default fallback
  }, []);

  // Filter logic based on role
  const isMedicalRole = role === "medical" || role === "billing" || role === "pharmacy";
  const isOpRole = role === "op";
  const isAdmin = role === "admin";

  const filteredMainItems = mainItems.filter((item) => {
    if (isAdmin) return true;
    if (isOpRole) return item.title !== "Pharmacy Billing";
    if (isMedicalRole) return item.title === "Pharmacy Billing";
    return false;
  });

  const filteredClinicalItems = clinicalItems.filter((item) => {
    if (isAdmin) return true;
    if (isOpRole) return true;
    return false;
  });

  const filteredManagementItems = managementItems.filter((item) => {
    if (isAdmin) return true;
    return false;
  });

  const filteredBillingItems = billingItems.filter((item) => {
    if (isAdmin) return true;
    if (isMedicalRole) return true;
    return false;
  });

  const filteredRecordItems = recordItems.filter((item) => {
    if (isAdmin) return true;
    if (isOpRole) return true;
    return false;
  });

  // Hide the group completely if there are no items for this role
  const renderGroup = (label: string, items: any[]) => {
    if (items.length === 0) return null;

    return (
      <SidebarGroup>
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
                    end={item.url === "/" || item.url === "/dashboard"}
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

  // Prevent flashing of wrong menu items while role is loading from storage
  if (!role) {
    return (
      <Sidebar collapsible="none" className="bg-transparent border-none w-full shadow-none text-slate-100">
        <SidebarHeader className="p-3 border-b border-slate-800 h-[65px]" />
      </Sidebar>
    );
  }

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
            <h2 className="font-heading text-sm font-bold text-white truncate">NewLifeCare HMS</h2>
            <p className="text-[10px] text-slate-400 truncate">Hospital Management</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="pt-2">
        {renderGroup("Main", filteredMainItems)}
        {renderGroup("Clinical", filteredClinicalItems)}
        {renderGroup("Management", filteredManagementItems)}
        {renderGroup("Billing", filteredBillingItems)}
        {renderGroup("Records", filteredRecordItems)}
      </SidebarContent>
    </Sidebar>
  );
}