-- ============================================================
-- AI Meet — Schema Completo e Atualizado
-- Estado atual após todas as migrations (v1 a v6)
-- Execute do zero para recriar o banco do zero corretamente
-- ============================================================
--
-- Registro técnico mais recente:
--   v6 (25/04/2026)
--   - Corrige unicidade multi-tenant de reuniões:
--     de UNIQUE(fireflies_id) para UNIQUE(user_id, fireflies_id).
--   - Atualiza os UPSERTs das RPCs process_webhook_meeting e
--     create_processing_meeting para ON CONFLICT (user_id, fireflies_id).
--   - Complementa ajustes de segurança/UX feitos no backend e frontend:
--     CORS_ORIGIN configurável, rate limit básico, badges de status
--     processing/error e texto honesto sobre proteção de API keys via RLS.
--   - Commit relacionado: 8a929a0 Improve meeting processing security and UX
--

-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  openai_api_key TEXT DEFAULT NULL,
  fireflies_api_key TEXT DEFAULT NULL,
  fireflies_webhook_secret TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: meetings
-- Colunas em inglês (usadas pelo código atual)
-- Colunas em português (legadas, mantidas por compatibilidade)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fireflies_id TEXT NOT NULL,
  CONSTRAINT unique_user_fireflies_id UNIQUE (user_id, fireflies_id),

  -- Colunas em inglês (usadas pelo backend e frontend)
  title TEXT NOT NULL DEFAULT 'Reunião Importada',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  meeting_type TEXT,
  objective TEXT,
  executive_summary TEXT,
  decisions TEXT,
  action_items JSONB,
  transcript JSONB,
  productivity_score INTEGER,
  productivity_reason TEXT,
  topics_discussed JSONB,
  pendencies JSONB,
  productivity_criteria JSONB,

  -- Colunas em português (legadas, criadas originalmente)
  titulo TEXT,
  data TIMESTAMPTZ,
  tipo_reuniao TEXT,
  objetivo TEXT,
  resumo TEXT,
  resumo_executivo TEXT,
  pontos_importantes JSONB,
  topicos_discutidos JSONB,
  transcricao_bruta TEXT,
  itens_acao JSONB,
  aproveitamento_nota INTEGER,
  aproveitamento_motivo TEXT,
  aproveitamento_criterios JSONB,
  pendencias JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON public.meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON public.meetings(date DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "meetings_select_own" ON public.meetings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "meetings_insert_own" ON public.meetings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meetings_update_own" ON public.meetings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "meetings_delete_own" ON public.meetings
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: Criar perfil ao cadastrar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, fireflies_webhook_secret)
  VALUES (NEW.id, gen_random_uuid()::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RPC: get_profile_by_webhook_secret
-- Valida webhook do Fireflies, contorna RLS
-- ============================================================
DROP FUNCTION IF EXISTS public.get_profile_by_webhook_secret(TEXT);
CREATE OR REPLACE FUNCTION public.get_profile_by_webhook_secret(p_secret TEXT)
RETURNS TABLE(id UUID, openai_api_key TEXT, fireflies_api_key TEXT, fireflies_webhook_secret TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.openai_api_key, p.fireflies_api_key, p.fireflies_webhook_secret
  FROM public.profiles p
  WHERE p.fireflies_webhook_secret = p_secret;
END;
$$;

-- ============================================================
-- RPC: process_webhook_meeting
-- Upsert de reunião pelo backend (contorna RLS)
-- ============================================================
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

-- ============================================================
-- RPC: get_meeting_for_reprocess
-- Busca reunião com transcrição para reprocessamento
-- ============================================================
DROP FUNCTION IF EXISTS public.get_meeting_for_reprocess;
CREATE OR REPLACE FUNCTION public.get_meeting_for_reprocess(p_meeting_id UUID, p_user_id UUID)
RETURNS TABLE(id UUID, fireflies_id TEXT, title TEXT, date TIMESTAMPTZ, duration INTEGER, transcript JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.fireflies_id, m.title, m.date, m.duration, m.transcript
  FROM public.meetings m
  WHERE m.id = p_meeting_id AND m.user_id = p_user_id;
END;
$$;

-- ============================================================
-- RPC: get_unprocessed_fireflies_ids
-- Retorna IDs do Fireflies que ainda não foram processados
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_unprocessed_fireflies_ids(
  p_user_id UUID,
  p_fireflies_ids TEXT[]
)
RETURNS TABLE(fireflies_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT unnest(p_fireflies_ids)
  EXCEPT
  SELECT m.fireflies_id
  FROM public.meetings m
  WHERE m.user_id = p_user_id
    AND m.status = 'completed'
    AND m.fireflies_id = ANY(p_fireflies_ids);
END;
$$;

-- ============================================================
-- RPC: create_processing_meeting
-- Cria registro 'processing' pelo frontend autenticado
-- Usa auth.uid() — não depende do cache do schema (evita PGRST204)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_processing_meeting(
  p_fireflies_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  INSERT INTO public.meetings (user_id, fireflies_id, title, date, duration, status)
  VALUES (v_uid, p_fireflies_id, 'Reunião Importada', NOW(), 0, 'processing')
  ON CONFLICT (user_id, fireflies_id) DO UPDATE SET
    status = 'processing'
  RETURNING to_jsonb(meetings.*) INTO v_row;

  RETURN v_row;
END;
$$;
