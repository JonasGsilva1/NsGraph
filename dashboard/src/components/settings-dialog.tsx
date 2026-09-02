import { useEffect, useState } from "react";
import { Save } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getConfig, saveConfig, type AppConfig } from "@/lib/config";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [localConfig, setLocalConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (open) {
      setLocalConfig(getConfig());
    }
  }, [open]);

  if (!localConfig) return null;

  const handleSave = () => {
    saveConfig(localConfig);
    toast.success("Configurações salvas", {
      description: "A página será recarregada para aplicar as mudanças.",
    });
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configurações do Painel</DialogTitle>
          <DialogDescription>
            Ajuste a integração com o Meu ERP Online e preferências de exibição.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">
              Token de API
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={localConfig.apiToken}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, apiToken: e.target.value })
              }
              placeholder="Authentication {token}"
            />
            <p className="text-[0.8rem] text-muted-foreground">
              Deixe em branco para usar a variável de ambiente VITE_API_TOKEN.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Taxa de Conversão</label>
              <p className="text-[0.8rem] text-muted-foreground">
                Exibir card e métricas de taxa de conversão (exige carregar
                pedidos rascunho/cancelados).
              </p>
            </div>
            <Switch
              checked={localConfig.showConversionRate}
              onCheckedChange={(checked) =>
                setLocalConfig({ ...localConfig, showConversionRate: checked })
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
