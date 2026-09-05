import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Building2, Plus, Key, Pencil, Trash2 } from 'lucide-react';

type Company = {
  id: string;
  name: string;
  api_token: string;
  created_at: string;
};

export function CompaniesManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state (used for both create and edit)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formName, setFormName] = useState('');
  const [formToken, setFormToken] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCompanies = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name');
    
    if (error) {
      toast.error('Erro ao buscar empresas: ' + error.message);
    } else {
      setCompanies(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const openCreateDialog = () => {
    setEditingCompany(null);
    setFormName('');
    setFormToken('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (company: Company) => {
    setEditingCompany(company);
    setFormName(company.name);
    setFormToken(company.api_token);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (editingCompany) {
      // --- EDIT ---
      const { error } = await supabase
        .from('companies')
        .update({ name: formName, api_token: formToken })
        .eq('id', editingCompany.id);

      if (error) {
        toast.error('Erro ao atualizar empresa: ' + error.message);
      } else {
        toast.success('Empresa atualizada com sucesso!');
      }
    } else {
      // --- CREATE ---
      const { data: newCompany, error } = await supabase
        .from('companies')
        .insert([{ name: formName, api_token: formToken }])
        .select()
        .single();

      if (error) {
        setIsSubmitting(false);
        toast.error('Erro ao criar empresa: ' + error.message);
        return;
      }

      toast.success('Empresa criada com sucesso! Iniciando sincronização...');

      // Trigger initial sync in the background
      supabase.functions.invoke('sync-erp', {
        body: { companyId: newCompany.id }
      }).then(({ error: syncError }) => {
        if (syncError) {
          console.error('Initial sync error:', syncError);
          toast.error('Empresa criada, mas ocorreu um erro na primeira sincronização.');
        } else {
          toast.success('Sincronização inicial concluída!');
        }
      });
    }

    setIsSubmitting(false);
    setIsDialogOpen(false);
    setFormName('');
    setFormToken('');
    setEditingCompany(null);
    fetchCompanies();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('Erro ao excluir empresa: ' + error.message);
    } else {
      toast.success(`Empresa "${deleteTarget.name}" excluída com sucesso.`);
    }

    setIsDeleting(false);
    setDeleteTarget(null);
    fetchCompanies();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Empresas</h2>
          <p className="text-muted-foreground">Gerencie as empresas e seus tokens de API.</p>
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus className="w-4 h-4" />
          Nova Empresa
        </Button>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setEditingCompany(null); } setIsDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Adicionar Nova Empresa'}</DialogTitle>
            <DialogDescription>
              {editingCompany
                ? 'Altere o nome ou o token de integração da empresa.'
                : 'Preencha os dados da nova empresa e o token da API para o ERP.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: Minha Loja Matriz" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">Token da API</Label>
                <Input 
                  id="token" 
                  placeholder="Insira o token de acesso da API" 
                  value={formToken}
                  onChange={(e) => setFormToken(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : (editingCompany ? 'Salvar Alterações' : 'Salvar Empresa')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação é irreversível. Todos os dados de vendas sincronizados, grupos e funcionários vinculados a essa empresa serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="text-center py-10">Carregando empresas...</div>
      ) : companies.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Building2 className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Nenhuma empresa encontrada</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Você ainda não possui empresas cadastradas. Clique no botão acima para adicionar a primeira.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(company => (
            <Card key={company.id} className="overflow-hidden">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-lg">
                    <Building2 className="w-4 h-4 text-primary" />
                    {company.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => openEditDialog(company)}
                      title="Editar empresa"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(company)}
                      title="Excluir empresa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Key className="w-3 h-3" />
                    Token da API
                  </div>
                  <div className="text-sm font-mono bg-muted p-2 rounded truncate" title={company.api_token}>
                    {company.api_token}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Adicionado em: {new Date(company.created_at).toLocaleDateString('pt-BR')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
