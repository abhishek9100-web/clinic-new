import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogoutButton } from "@/components/LogoutButton"; // Import the new button
import "../globals.css";

export const metadata = {
  title: "new life care",
  description: "Hospital Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* SidebarProvider is kept only so inner shadcn components don't crash, but we ignore its layout features */}
        <SidebarProvider>
          <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
            
            {/* STRICT FIXED WIDTH SIDEBAR */}
            <div className="w-50 shrink-0 h-full border-r border-slate-800 bg-slate-950">
              <AppSidebar />
            </div>

            {/* STRICT FLEX-1 CONTENT (Takes all remaining space) */}
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
              
              {/* ADDED justify-between to push the title to the left and button to the right */}
              <header className="h-14 flex items-center justify-between border-b bg-white px-6 shrink-0 shadow-sm z-10">
                <h1 className="text-lg font-semibold text-slate-800">
                  New Life Care Hospital Management
                </h1>
                
                {/* LOGOUT BUTTON */}
                <LogoutButton />
              </header>

              <div className="flex-1 p-6 overflow-y-auto">
                {children}
              </div>
            </main>
            
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}