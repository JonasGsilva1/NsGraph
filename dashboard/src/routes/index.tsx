// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { AlertCircle } from "lucide-react";
import { Toaster } from "sonner";

import { DashboardHeader } from "@/components/dashboard-header";
import { KpiCards } from "@/components/kpi-cards";
import { RevenueChart } from "@/components/revenue-chart";
import { TopProductsChart } from "@/components/top-products-chart";
import { CategoryChart } from "@/components/category-chart";
import { SellerChart } from "@/components/seller-chart";
import { PdvChart } from "@/components/pdv-chart";
import { PaymentChart } from "@/components/payment-chart";

import { useDashboardData } from "@/lib/api-hooks";
import { getPresetRange, type Preset } from "@/lib/date-utils";
import { getConfig } from "@/lib/config";

export const Route = createFileRoute("/")({
  component: Dashboard,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      from: search.from as string | undefined,
      to: search.to as string | undefined,
      preset: (search.preset as Preset) || "7d",
    };
  },
});

type CompanyData = {
  id: string;
  name: string;
};

function Dashboard() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();
  const config = getConfig();
  
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login', replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user) return;
      setLoadingCompanies(true);
      const { data } = await supabase.from('companies').select('id, name').order('name');
      if (data && data.length > 0) {
        setCompanies(data);
        if (!selectedCompanyId) {
          setSelectedCompanyId(data[0].id);
        }
      }
      setLoadingCompanies(false);
    };

    if (user && !authLoading) {
      fetchCompanies();
    }
  }, [user, authLoading]);

  // Determine current range
  const range =
    search.preset === "custom" && search.from && search.to
      ? { from: new Date(search.from), to: new Date(search.to) }
      : getPresetRange(search.preset as Preset);

  // We pass selectedCompanyId to our edge function proxy hook
  const { data, loading: dataLoading, error, isSyncing } = useDashboardData(range, selectedCompanyId);
  
  const loading = loadingCompanies || dataLoading;

  const handleRangeChange = (newRange: { from: Date; to: Date }, preset: Preset) => {
    navigate({
      search: {
        from: newRange.from.toISOString(),
        to: newRange.to.toISOString(),
        preset,
      },
    });
  };

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Carregando dashboard...</div>;
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-[1920px] mx-auto">
      <DashboardHeader
        range={range}
        preset={search.preset as Preset}
        onRangeChange={handleRangeChange}
        isAdmin={profile?.role === 'admin'}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onCompanyChange={setSelectedCompanyId}
        onAdminPanelClick={() => navigate({ to: '/admin' })}
      />

      {error ? (
        <div className="mb-6 animate-fade-in p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-lg flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold mb-1">Erro ao carregar dados</h4>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      ) : null}

      {!loadingCompanies && companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2 rounded-xl mt-12 bg-muted/20">
          <h3 className="text-xl font-medium mb-2">Nenhuma empresa encontrada</h3>
          <p className="text-muted-foreground">
            {profile?.role === 'admin' 
              ? 'Acesse o Painel Administrativo para cadastrar a primeira empresa.'
              : 'Seu usuário ainda não foi vinculado a nenhuma empresa. Contate o administrador.'}
          </p>
        </div>
      ) : (
        <>
          <KpiCards
            data={data?.kpi}
            loading={loading}
            showOrders={config.showOrders}
            showConversionRate={config.showConversionRate}
          />

          {!loading && data && (
            <div className="flex flex-col gap-6 animate-fade-in-delay-1">
              <RevenueChart data={data.revenueTimeline} />
              
              <div className="dashboard-grid">
                <TopProductsChart data={data.topProducts} />
                <CategoryChart data={data.categorySales} />
                <SellerChart data={data.sellerSales} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PdvChart data={data.pdvSales} />
                <PaymentChart data={data.paymentSales} />
              </div>
            </div>
          )}

          {loading && !data && (
            <div className="flex flex-col gap-6 animate-fade-in-delay-1">
              {isSyncing && (
                <div className="bg-primary/10 border border-primary/20 text-primary p-4 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <h3 className="font-medium">Sincronizando dados iniciais da empresa...</h3>
                  <p className="text-sm opacity-80">Isso pode levar alguns minutos. O painel será atualizado automaticamente.</p>
                </div>
              )}
              <div className="h-[400px] bg-card/50 rounded-xl skeleton"></div>
              <div className="dashboard-grid">
                <div className="h-[400px] bg-card/50 rounded-xl skeleton"></div>
                <div className="h-[400px] bg-card/50 rounded-xl skeleton"></div>
                <div className="h-[400px] bg-card/50 rounded-xl skeleton"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-[400px] bg-card/50 rounded-xl skeleton"></div>
                <div className="h-[400px] bg-card/50 rounded-xl skeleton"></div>
              </div>
            </div>
          )}
        </>
      )}

      <Toaster theme="dark" position="top-right" />
    </div>
  );
}
