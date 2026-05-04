"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<"loading" | "authorized" | "redirecting">("loading");

  useEffect(() => {
    const token = localStorage.getItem("medcare_token");

    const publicRoutes = ["/", "/login", "/register"];
    const isPublicRoute = publicRoutes.includes(pathname);

    if (!token && !isPublicRoute) {
      setStatus("redirecting");        // ✅ break out of loading
      router.replace("/");
      return;
    }

    if (token && isPublicRoute) {
      setStatus("redirecting");        // ✅ break out of loading
      router.replace("/dashboard");
      return;
    }

    setStatus("authorized");
  }, [pathname]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "redirecting") {
    return null; // or a small spinner
  }

  return <>{children}</>;
}