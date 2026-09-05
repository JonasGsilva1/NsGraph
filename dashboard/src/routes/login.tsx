import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (user && !authLoading) {
      navigate({ to: '/' });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          toast.error('E-mail ou senha incorretos.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('Login efetuado com sucesso!');
      navigate({ to: '/' });
    } catch (error) {
      toast.error('Ocorreu um erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };


  if (authLoading) {
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F1A] p-4 relative overflow-hidden">
      {/* Subtle ambient glow behind the card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00C98B]/5 blur-[120px] rounded-full pointer-events-none" />
      
      <Card className="w-full max-w-[440px] bg-[#0F1522] border-[#1F2937] shadow-2xl relative z-10 sm:p-4">
        <CardHeader className="space-y-8 pt-8 pb-4">
          {/* Custom NeXT Logo */}
          <div className="flex flex-col items-center justify-center select-none">
            <div className="flex items-center gap-1.5">
              <div className="flex text-[#00C98B] font-black text-5xl tracking-tighter" style={{ textShadow: '0 0 20px rgba(0, 201, 139, 0.3)' }}>
                <span>&gt;</span>
                <span className="-ml-2.5">&gt;</span>
              </div>
              <span className="text-white font-extrabold text-5xl tracking-tight">NeXT</span>
            </div>
            <span className="text-[#00C98B] font-bold text-[0.7rem] tracking-[0.4em] uppercase ml-12 opacity-90">
              Soluções
            </span>
          </div>

          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-[#F8FAFC]">
              Bem-vindo de volta
            </CardTitle>
            <CardDescription className="text-[#8FA3BF] text-sm">
              Entre com suas credenciais para acessar o dashboard
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-5 pb-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#F8FAFC] font-medium text-sm">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[#0B0F1A] border-[#1F2937] text-white placeholder:text-[#8FA3BF]/50 hover:border-[#374151] focus:border-[#00C98B] focus:ring-1 focus:ring-[#00C98B]/50 transition-all h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[#F8FAFC] font-medium text-sm">Senha</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#0B0F1A] border-[#1F2937] text-white placeholder:text-[#8FA3BF]/50 hover:border-[#374151] focus:border-[#00C98B] focus:ring-1 focus:ring-[#00C98B]/50 transition-all h-11"
              />
            </div>
          </CardContent>
          <CardFooter className="pb-8">
            <Button 
              className="w-full bg-[#00C98B] hover:bg-[#00AFA0] text-[#0B0F1A] font-semibold h-12 text-base transition-all shadow-[0_0_15px_rgba(0,201,139,0.2)] hover:shadow-[0_0_25px_rgba(0,201,139,0.3)]" 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
