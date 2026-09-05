import { useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  Settings,
  LogOut,
  X,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

import { type DateRange, formatDateRange, type Preset } from "@/lib/date-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsDialog } from "./settings-dialog";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  range: DateRange;
  preset: Preset;
  onRangeChange: (range: DateRange, preset: Preset) => void;
  isAdmin?: boolean;
  companies?: { id: string, name: string }[];
  selectedCompanyId?: string | null;
  onCompanyChange?: (id: string) => void;
  onAdminPanelClick?: () => void;
}

export function DashboardHeader({
  range,
  preset,
  onRangeChange,
  isAdmin,
  companies = [],
  selectedCompanyId,
  onCompanyChange,
  onAdminPanelClick,
}: DashboardHeaderProps) {
  const { signOut } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: range.from,
    to: range.to,
  });

  const handlePresetClick = (p: Preset) => {
    onRangeChange(range, p);
  };

  const handleCustomApply = () => {
    if (customRange.from && customRange.to) {
      onRangeChange(
        {
          from: startOfDay(customRange.from),
          to: endOfDay(customRange.to),
        },
        "custom"
      );
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-6 animate-fade-in border-b border-border mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.jpg" 
            alt="Next Soluções" 
            className="h-10 w-auto rounded-lg object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight">Painel de Vendas</h1>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateRange(range)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <div className="flex items-center gap-2 mr-2">
            <Select 
              value={selectedCompanyId || ''} 
              onValueChange={onCompanyChange}
            >
              <SelectTrigger className="w-[250px] h-10 bg-card">
                <SelectValue placeholder="Selecione uma empresa">
                  {companies.find(c => c.id === selectedCompanyId)?.name || 'Carregando...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-10 border-primary/20 text-primary" onClick={onAdminPanelClick}>
              Painel Admin
            </Button>
          </div>
        )}

        <div className="period-buttons bg-card border border-border p-1 rounded-lg">
          <Button
            variant={preset === "today" ? "default" : "ghost"}
            size="sm"
            onClick={() => handlePresetClick("today")}
            className="rounded-md px-3 h-8 text-xs font-medium"
          >
            Hoje
          </Button>
          <Button
            variant={preset === "7d" ? "default" : "ghost"}
            size="sm"
            onClick={() => handlePresetClick("7d")}
            className="rounded-md px-3 h-8 text-xs font-medium"
          >
            7 dias
          </Button>
          <Button
            variant={preset === "30d" ? "default" : "ghost"}
            size="sm"
            onClick={() => handlePresetClick("30d")}
            className="rounded-md px-3 h-8 text-xs font-medium"
          >
            30 dias
          </Button>
          <Button
            variant={preset === "90d" ? "default" : "ghost"}
            size="sm"
            onClick={() => handlePresetClick("90d")}
            className="rounded-md px-3 h-8 text-xs font-medium"
          >
            90 dias
          </Button>
          <Button
            variant={preset === "1y" ? "default" : "ghost"}
            size="sm"
            onClick={() => handlePresetClick("1y")}
            className="rounded-md px-3 h-8 text-xs font-medium"
          >
            1 ano
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={preset === "custom" ? "default" : "ghost"}
                size="sm"
                className="rounded-md px-3 h-8 text-xs font-medium gap-1"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Personalizado
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <span className="font-medium text-sm">Período Customizado</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 p-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Data Inicial</div>
                  <Calendar
                    mode="single"
                    selected={customRange.from}
                    onSelect={(d) => setCustomRange((prev) => ({ ...prev, from: d }))}
                    className="border rounded-md pointer-events-auto"
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Data Final</div>
                  <Calendar
                    mode="single"
                    selected={customRange.to}
                    onSelect={(d) => setCustomRange((prev) => ({ ...prev, to: d }))}
                    className="border rounded-md pointer-events-auto"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button
                  size="sm"
                  onClick={handleCustomApply}
                  disabled={!customRange.from || !customRange.to}
                >
                  Aplicar Filtro
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setIsSettingsOpen(true)}
          title="Configurações"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
          onClick={signOut}
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
}
