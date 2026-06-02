import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Login.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Painel esquerdo — visual */}
      <div className="login-panel-left">
        <div className="login-brand">
          <BrainCircuit size={48} className="brand-icon" />
          <h1 className="brand-name">ReuniãoAI</h1>
          <p className="brand-tagline">Transforme suas reuniões em insights acionáveis com inteligência artificial.</p>
        </div>
        <ul className="brand-features">
          <li>Resumos executivos automáticos</li>
          <li>Itens de ação com responsáveis e prazos</li>
          <li>Pontuação de aproveitamento da reunião</li>
          <li>Integração nativa com Fireflies.ai</li>
        </ul>
      </div>

      {/* Painel direito — formulário */}
      <div className="login-panel-right">
        <div className="login-card">
          <div className="login-header">
            <BrainCircuit className="logo-icon" size={28} />
            <h2>ReuniãoAI</h2>
          </div>
          <h3 className="login-title">{isSignUp ? 'Criar conta' : 'Bem-vindo de volta'}</h3>
          <p className="login-subtitle">
            {isSignUp ? 'Preencha os dados para começar.' : 'Entre com sua conta para continuar.'}
          </p>

          {/* Google OAuth */}
          <button
            type="button"
            className="btn-google"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
            </svg>
            {googleLoading ? 'Redirecionando...' : 'Continuar com Google'}
          </button>

          <div className="divider"><span>ou</span></div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="label">E-mail</label>
              <input
                type="email"
                className="input-field"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="label">Senha</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading || googleLoading}>
              {loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {isSignUp ? 'Já tem conta?' : 'Não tem conta?'}{' '}
              <button
                type="button"
                className="link font-semibold"
                onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              >
                {isSignUp ? 'Entrar' : 'Cadastre-se.'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
