import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { CompaniesManager } from '@/components/admin/companies-manager';
import { UsersManager } from '@/components/admin/users-manager';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Building2, Users } from 'lucide-react';

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const { profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'companies' | 'users'>('companies');

  useEffect(() => {
    if (!isLoading) {
      if (!profile || profile.role !== 'admin') {
        navigate({ to: '/', replace: true });
      }
    }
  }, [profile, isLoading, navigate]);

  if (isLoading || !profile || profile.role !== 'admin') {
    return <div className="flex h-screen items-center justify-center">Verificando permissões...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Admin Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center font-bold">
              A
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Painel Administrativo</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: '/' })} className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Voltar ao Dashboard
          </Button>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col gap-1">
            <Button 
              variant={activeTab === 'companies' ? 'default' : 'ghost'} 
              className="justify-start gap-3"
              onClick={() => setActiveTab('companies')}
            >
              <Building2 className="w-4 h-4" />
              Empresas
            </Button>
            <Button 
              variant={activeTab === 'users' ? 'default' : 'ghost'} 
              className="justify-start gap-3"
              onClick={() => setActiveTab('users')}
            >
              <Users className="w-4 h-4" />
              Usuários
            </Button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-card rounded-xl border shadow-sm p-6">
          {activeTab === 'companies' ? <CompaniesManager /> : <UsersManager />}
        </main>
      </div>
    </div>
  );
}
