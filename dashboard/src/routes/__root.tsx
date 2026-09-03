import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Outlet />
        <Toaster richColors position="top-right" />
      </div>
    </AuthProvider>
  ),
});

