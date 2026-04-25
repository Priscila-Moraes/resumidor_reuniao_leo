-- ============================================================
-- MIGRATION v6: Corrigir unicidade multi-tenant das reuniões
-- ============================================================
-- Data: 25/04/2026
--
-- Contexto:
-- A constraint antiga UNIQUE(fireflies_id) tratava o ID do Fireflies como
-- global no banco inteiro. Em um SaaS multi-tenant, o mesmo fireflies_id pode
-- aparecer para usuários diferentes, então a unicidade correta é por usuário:
-- UNIQUE(user_id, fireflies_id).
--
-- Também atualiza os UPSERTs das RPCs que gravam reuniões para usar
-- ON CONFLICT (user_id, fireflies_id).
--
-- Commit relacionado:
--   8a929a0 Improve meeting processing security and UX
-- ============================================================

-- 1. Trocar constraint global por constraint por usuário
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

-- 2. Recriar RPC process_webhook_meeting com ON CONFLICT correto
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

-- 3. Recriar RPC create_processing_meeting com ON CONFLICT correto
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
