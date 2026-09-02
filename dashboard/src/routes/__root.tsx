import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Outlet />
      </div>
    </AuthProvider>
  ),
});

