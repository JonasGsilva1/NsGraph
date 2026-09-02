import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@supabase/supabase-js';

// Cliente secundário para registrar usuários sem deslogar o Admin atual
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const authSupabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

export function UsersManager() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<{id: string, name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // New user state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('none');

  const fetchData = async () => {
    setIsLoading(true);
    
    const [usersRes, companiesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('companies').select('id, name').order('name')
    ]);

    if (usersRes.error) toast.error('Erro ao buscar usuários: ' + usersRes.error.message);
    if (companiesRes.error) toast.error('Erro ao buscar empresas: ' + companiesRes.error.message);
    
    if (usersRes.data) setUsers(usersRes.data);
    if (companiesRes.data) setCompanies(companiesRes.data);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLinkCompany = async (userId: string, companyId: string) => {
    setIsUpdating(userId);
    
    // Using 'none' string as a flag to unassign
    const newCompanyId = companyId === 'none' ? null : companyId;
    
    const { error } = await supabase
      .from('profiles')
      .update({ company_id: newCompanyId })
      .eq('id', userId);

    if (error) {
      toast.error('Erro ao atualizar usuário: ' + error.message);
    } else {
      toast.success('Empresa vinculada com sucesso!');
      setUsers(users.map(u => u.id === userId ? { ...u, company_id: newCompanyId } : u));
    }
    
    setIsUpdating(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Criar o usuário no Auth
      const { data: authData, error: authError } = await authSupabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserName,
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const userId = authData.user?.id;

      if (!userId) {
        throw new Error("Erro desconhecido ao criar usuário (ID não retornado).");
      }

      // 2. Se uma empresa foi selecionada, atualizamos o profile (que foi criado via trigger)
      if (newUserCompany !== 'none') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ company_id: newUserCompany })
          .eq('id', userId);

        if (profileError) {
          toast.error("Usuário criado, mas houve um erro ao vincular a empresa.");
        }
      }

      toast.success('Usuário criado com sucesso!');
      setIsDialogOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserCompany('none');
      
      // Recarrega a tabela para mostrar o novo usuário
      fetchData();

    } catch (err: any) {
      toast.error('Erro ao criar usuário: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Usuários</h2>
          <p className="text-muted-foreground">Vincule os usuários às suas respectivas empresas.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Crie um usuário e senha para acessar o painel.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input 
                    id="nome" 
                    placeholder="Ex: João da Silva" 
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="joao@empresa.com" 
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha Temporária</Label>
                  <Input 
                    id="password" 
                    type="password"
                    placeholder="Mínimo de 6 caracteres" 
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vincular à Empresa</Label>
                  <Select 
                    value={newUserCompany}
                    onValueChange={setNewUserCompany}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (Apenas Cadastro)</SelectItem>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Carregando usuários...</div>
      ) : users.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Nenhum usuário encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Os usuários aparecerão aqui assim que criarem suas contas.
          </p>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Nome / E-mail</th>
                <th className="px-6 py-4 font-medium">Nível de Acesso</th>
                <th className="px-6 py-4 font-medium">Empresa Vinculada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">{user.full_name || 'Sem nome'}</div>
                    <div className="text-xs text-muted-foreground">{user.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-primary/20 text-primary border border-primary/30' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {user.role === 'admin' ? 'Administrador' : 'Usuário Comum'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 max-w-[250px]">
                      {user.role === 'admin' ? (
                        <span className="text-xs text-muted-foreground">Possui acesso a todas</span>
                      ) : (
                        <Select 
                          disabled={isUpdating === user.id} 
                          value={user.company_id || 'none'}
                          onValueChange={(val) => handleLinkCompany(user.id, val)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecione uma empresa" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {companies.map(company => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
