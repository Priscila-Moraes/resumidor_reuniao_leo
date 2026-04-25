-- ============================================================
-- MIGRATION v2: Novos campos de análise da IA
-- ============================================================
-- Adiciona: topics_discussed, pendencies, productivity_criteria
-- Atualiza: RPC process_webhook_meeting para aceitar novos campos
-- ============================================================

-- 1. Adicionar colunas novas (idempotente)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS topics_discussed JSONB,
  ADD COLUMN IF NOT EXISTS pendencies JSONB,
  ADD COLUMN IF NOT EXISTS productivity_criteria JSONB;

-- 2. Corrigir unicidade para multi-tenant
-- O mesmo fireflies_id pode existir para usuários diferentes. A unicidade deve ser por usuário.
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT user_id, fireflies_id
    FROM public.meetings
    GROUP BY user_id, fireflies_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Existem reuniões duplicadas por (user_id, fireflies_id). Resolva as duplicidades antes de aplicar a constraint unique_user_fireflies_id.';
  ELSE
    ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS unique_fireflies_id;
    ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS unique_user_fireflies_id;
    ALTER TABLE public.meetings
      ADD CONSTRAINT unique_user_fireflies_id UNIQUE (user_id, fireflies_id);
  END IF;
END $$;

-- 3. Recriar RPC process_webhook_meeting com novos parâmetros
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
