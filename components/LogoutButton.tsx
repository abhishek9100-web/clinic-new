"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    // Remove the tokens from localStorage
    localStorage.removeItem("medcare_token");
    localStorage.removeItem("token");
    
    // Redirect immediately to the login page
    router.push("/login");
  };

  return (
    <button 
      onClick={handleLogout}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors border border-red-100 shadow-sm"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}