import { useState, useEffect } from 'react';
import { Copy, Check, Shield, Plug, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './Settings.css';

const BACKEND_URL = 'https://n8n-backend.v6mtnf.easypanel.host';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [openaiKey, setOpenaiKey] = useState('');
  const [firefliesKey, setFirefliesKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [openaiSaving, setOpenaiSaving] = useState(false);
  const [firefliesSaving, setFirefliesSaving] = useState(false);

  const webhookUrl = webhookSecret
    ? `${BACKEND_URL}/api/webhooks/fireflies/${webhookSecret}`
    : '';

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('openai_api_key, fireflies_api_key, fireflies_webhook_secret')
          .eq('id', user.id)
          .single();
        if (ignore) return;
        if (error) throw error;
        if (data) {
          setOpenaiKey(data.openai_api_key || '');
          setFirefliesKey(data.fireflies_api_key || '');
          setWebhookSecret(data.fireflies_webhook_secret || '');
        }
      } catch {
        toast.error('Não foi possível carregar as configurações.');
      }
    }

    loadProfile();
    return () => { ignore = true; };
  }, [user]);

  const saveKey = async (
    column: string,
    value: string,
    setSaving: (v: boolean) => void,
    label: string,
  ) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [column]: value })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(`${label} salva com sucesso!`);
    } catch (err: any) {
      toast.error(err.message || `Erro ao salvar ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const regenerateSecret = async () => {
    if (!user) return;
    const newSecret = crypto.randomUUID();
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ fireflies_webhook_secret: newSecret })
        .eq('id', user.id);
      if (error) throw error;
      setWebhookSecret(newSecret);
      toast.success('URL do webhook regenerada. Atualize no Fireflies.');
    } catch (err: any) {
      toast.error('Erro ao regenerar webhook.');
    }
  };

  const copyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.info('URL copiada para a área de transferência.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="page-title">Configurações</h1>
      </div>

      <div className="settings-content">
        {/* OpenAI */}
        <div className="card settings-card">
          <div className="settings-card-header">
            <div className="icon-container">
              <Plug size={20} className="settings-icon" />
            </div>
            <h3 className="section-title">Integração OpenAI</h3>
          </div>
          <p className="section-description">Configure sua chave de API para habilitar a análise de inteligência artificial.</p>
          <div className="model-badge">
            <span className="model-badge-dot" />
            Usando <strong>GPT-4o Mini</strong> para toda a análise de IA — resumos, decisões, itens de ação e avaliação de aproveitamento.
          </div>

          <form onSubmit={(e) => { e.preventDefault(); saveKey('openai_api_key', openaiKey, setOpenaiSaving, 'Chave OpenAI'); }}>
            <div className="form-group">
              <label className="label">Chave API OpenAI</label>
              <input
                type="password"
                className="input-field"
                placeholder="sk-••••••••••••••••••••••••••••••••••••••••••••••"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                required
              />
              <p className="help-text">Sua chave é armazenada de forma segura (RLS) no banco de dados. Apenas você tem acesso.</p>
            </div>
            <div className="button-container">
              <button type="submit" className="btn-primary" disabled={openaiSaving}>
                {openaiSaving ? 'Salvando...' : 'Salvar Chave'}
              </button>
            </div>
          </form>
        </div>

        {/* Fireflies */}
        <div className="card settings-card">
          <div className="settings-card-header">
            <div className="icon-container">
              <Plug size={20} className="settings-icon" />
            </div>
            <h3 className="section-title">Integração Fireflies</h3>
          </div>
          <p className="section-description">Configure sua chave do Fireflies.ai para buscar as transcrições das reuniões.</p>

          <form onSubmit={(e) => { e.preventDefault(); saveKey('fireflies_api_key', firefliesKey, setFirefliesSaving, 'Chave Fireflies'); }}>
            <div className="form-group">
              <label className="label">Chave API Fireflies</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••••••••••••••••••••••••••"
                value={firefliesKey}
                onChange={(e) => setFirefliesKey(e.target.value)}
                required
              />
              <p className="help-text">Encontre sua chave em fireflies.ai → Configurações → API.</p>
            </div>
            <div className="button-container">
              <button type="submit" className="btn-primary" disabled={firefliesSaving}>
                {firefliesSaving ? 'Salvando...' : 'Salvar Chave'}
              </button>
            </div>
          </form>
        </div>

        {/* Webhook — URL única por usuário */}
        <div className="card settings-card">
          <div className="settings-card-header">
            <div className="icon-container">
              <Shield size={20} className="settings-icon" />
            </div>
            <h3 className="section-title">Webhook Fireflies</h3>
          </div>
          <p className="section-description">Cole esta URL exclusiva no painel do Fireflies.ai para sincronizar suas reuniões automaticamente.</p>

          <div className="form-group">
            <label className="label">Sua URL exclusiva</label>
            <div className="webhook-field">
              <input
                type="text"
                className="input-field readonly"
                value={webhookUrl || 'Carregando...'}
                readOnly
              />
              <button type="button" className="btn-icon-only" onClick={copyWebhook} title="Copiar URL">
                {copied ? <Check size={18} className="success-icon" /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div className="webhook-actions">
            <button type="button" className="btn-secondary" onClick={regenerateSecret}>
              <RefreshCw size={14} />
              Regenerar URL
            </button>
          </div>

          <div className="alert-important">
            <p><strong>Importante:</strong> Esta URL é exclusiva sua — não compartilhe. Se comprometida, use "Regenerar URL" e atualize no Fireflies.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
