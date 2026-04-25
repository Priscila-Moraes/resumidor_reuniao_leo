-- ============================================================
-- AI Meet - Schema Completo do Banco de Dados (Supabase)
-- ============================================================
-- Execute este script no SQL Editor do Supabase para criar
-- toda a estrutura necessária para rodar o projeto.
-- ============================================================

-- 1. EXTENSÕES NECESSÁRIAS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA: profiles
-- ============================================================
-- Armazena configurações do usuário (chaves de API, webhook secret)
-- O campo `id` é o mesmo UUID do auth.users (FK)

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  openai_api_key TEXT DEFAULT NULL,
  fireflies_api_key TEXT DEFAULT NULL,
  fireflies_webhook_secret TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: meetings
-- ============================================================
-- Armazena reuniões com transcrições e análises da IA

CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fireflies_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER NOT NULL DEFAULT 0,
  meeting_type TEXT,
  objective TEXT,
  executive_summary TEXT,
  decisions TEXT,
  action_items JSONB,
  transcript JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  productivity_score INTEGER,
  productivity_reason TEXT,
  topics_discussed JSONB,
  pendencies JSONB,
  productivity_criteria JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_fireflies_id UNIQUE (user_id, fireflies_id)
);

-- Índice para queries filtradas por usuário
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON public.meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON public.meetings(date DESC);

-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles: usuário só acessa seu próprio perfil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Políticas para meetings: usuário só acessa suas próprias reuniões
CREATE POLICY "meetings_select_own" ON public.meetings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "meetings_insert_own" ON public.meetings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meetings_update_own" ON public.meetings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "meetings_delete_own" ON public.meetings
  FOR DELETE USING (auth.uid() = user_id);

-- 5. TRIGGER: Criar perfil automaticamente ao registrar usuário
-- ============================================================
-- Quando um novo usuário se cadastra via Supabase Auth,
-- este trigger cria automaticamente um registro na tabela profiles
-- com um webhook secret único gerado por UUID.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, fireflies_webhook_secret)
  VALUES (
    NEW.id,
    gen_random_uuid()::text
  );
  RETURN NEW;
END;
$$;

-- Criar o trigger (DROP primeiro para evitar duplicação)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. RPC: get_profile_by_webhook_secret
-- ============================================================
-- Usada pelo backend para validar o webhook do Fireflies.
-- Contorna RLS (SECURITY DEFINER) para buscar o perfil
-- pelo secret da URL sem precisar de autenticação.

DROP FUNCTION IF EXISTS public.get_profile_by_webhook_secret;

CREATE OR REPLACE FUNCTION public.get_profile_by_webhook_secret(p_secret TEXT)
RETURNS TABLE(
  id UUID,
  openai_api_key TEXT,
  fireflies_api_key TEXT,
  fireflies_webhook_secret TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.openai_api_key,
    p.fireflies_api_key,
    p.fireflies_webhook_secret
  FROM public.profiles p
  WHERE p.fireflies_webhook_secret = p_secret;
END;
$$;

-- 7. RPC: process_webhook_meeting
-- ============================================================
-- Usada pelo backend para inserir ou atualizar reuniões.
-- Faz UPSERT por usuário e fireflies_id (ON CONFLICT).
-- Contorna RLS (SECURITY DEFINER) para permitir que o backend
-- insira/atualize sem autenticação de usuário.
--
-- Fluxo:
--   1ª chamada: status='processing' (metadados básicos)
--   2ª chamada: status='completed' (com análise da IA)
--   Em caso de erro: status='error'

DROP FUNCTION IF EXISTS public.process_webhook_meeting;

CREATE OR REPLACE FUNCTION public.process_webhook_meeting(
  p_user_id UUID,
  p_fireflies_id TEXT,
  p_title TEXT,
  p_date TIMESTAMPTZ,
  p_duration INTEGER,
  p_meeting_type TEXT DEFAULT NULL,
  p_objective TEXT DEFAULT NULL,
  p_executive_summary TEXT DEFAULT NULL,
  p_decisions TEXT DEFAULT NULL,
  p_action_items JSONB DEFAULT NULL,
  p_transcript JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'processing',
  p_productivity_score INTEGER DEFAULT NULL,
  p_productivity_reason TEXT DEFAULT NULL,
  p_topics_discussed JSONB DEFAULT NULL,
  p_pendencies JSONB DEFAULT NULL,
  p_productivity_criteria JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting_id UUID;
BEGIN
  INSERT INTO public.meetings (
    user_id, fireflies_id, title, date, duration,
    meeting_type, objective, executive_summary, decisions,
    action_items, transcript, status,
    productivity_score, productivity_reason,
    topics_discussed, pendencies, productivity_criteria
  )
  VALUES (
    p_user_id, p_fireflies_id, p_title, p_date, p_duration,
    p_meeting_type, p_objective, p_executive_summary, p_decisions,
    p_action_items, p_transcript, p_status,
    p_productivity_score, p_productivity_reason,
    p_topics_discussed, p_pendencies, p_productivity_criteria
  )
  ON CONFLICT (user_id, fireflies_id) DO UPDATE SET
    title = EXCLUDED.title,
    date = EXCLUDED.date,
    duration = EXCLUDED.duration,
    meeting_type = EXCLUDED.meeting_type,
    objective = EXCLUDED.objective,
    executive_summary = EXCLUDED.executive_summary,
    decisions = EXCLUDED.decisions,
    action_items = EXCLUDED.action_items,
    transcript = EXCLUDED.transcript,
    status = EXCLUDED.status,
    productivity_score = EXCLUDED.productivity_score,
    productivity_reason = EXCLUDED.productivity_reason,
    topics_discussed = EXCLUDED.topics_discussed,
    pendencies = EXCLUDED.pendencies,
    productivity_criteria = EXCLUDED.productivity_criteria
  RETURNING id INTO v_meeting_id;

  RETURN v_meeting_id;
END;
$$;

-- 8. RPC: get_meeting_for_reprocess
-- ============================================================
-- Usada pelo backend para buscar reunião com transcrição salva
-- para reprocessar a análise da IA sem chamar o Fireflies.

DROP FUNCTION IF EXISTS public.get_meeting_for_reprocess;

CREATE OR REPLACE FUNCTION public.get_meeting_for_reprocess(p_meeting_id UUID, p_user_id UUID)
RETURNS TABLE(
  id UUID,
  fireflies_id TEXT,
  title TEXT,
  date TIMESTAMPTZ,
  duration INTEGER,
  transcript JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.fireflies_id,
    m.title,
    m.date,
    m.duration,
    m.transcript
  FROM public.meetings m
  WHERE m.id = p_meeting_id AND m.user_id = p_user_id;
END;
$$;

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
--
-- RESUMO:
--   Tabelas:   profiles, meetings
--   Triggers:  on_auth_user_created → handle_new_user()
--   RPCs:      get_profile_by_webhook_secret, process_webhook_meeting, get_meeting_for_reprocess
--   RLS:       Habilitado em ambas as tabelas
--   Políticas: Usuário só acessa seus próprios dados
--
-- APÓS EXECUTAR:
--   1. Configure as variáveis de ambiente no backend (.env):
--      - SUPABASE_URL
--      - SUPABASE_ANON_KEY
--   2. Configure as variáveis no frontend (.env):
--      - VITE_SUPABASE_URL
--      - VITE_SUPABASE_ANON_KEY
--      - VITE_API_URL (URL do backend)
--   3. No Supabase Dashboard → Authentication → Settings:
--      - Habilite Email/Password como provider
-- ============================================================
