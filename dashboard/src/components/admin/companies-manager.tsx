import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Building2, Plus, Key } from 'lucide-react';

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
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyToken, setNewCompanyToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase
      .from('companies')
      .insert([
        { name: newCompanyName, api_token: newCompanyToken }
      ]);

    setIsSubmitting(false);

    if (error) {
      toast.error('Erro ao criar empresa: ' + error.message);
      return;
    }

    toast.success('Empresa criada com sucesso!');
    setIsDialogOpen(false);
    setNewCompanyName('');
    setNewCompanyToken('');
    fetchCompanies();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Empresas</h2>
          <p className="text-muted-foreground">Gerencie as empresas e seus tokens de API.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Nova Empresa</DialogTitle>
              <DialogDescription>
                Preencha os dados da nova empresa e o token da API para o ERP.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCompany}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Empresa</Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: Minha Loja Matriz" 
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token">Token da API</Label>
                  <Input 
                    id="token" 
                    placeholder="Insira o token de acesso da API" 
                    value={newCompanyToken}
                    onChange={(e) => setNewCompanyToken(e.target.value)}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar Empresa'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="w-4 h-4 text-primary" />
                  {company.name}
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
