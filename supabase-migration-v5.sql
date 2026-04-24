-- ============================================================
-- MIGRATION v5: Adicionar colunas inglês que o código espera
-- ============================================================
-- A tabela foi criada com nomes em português (titulo, data, etc.)
-- O código usa nomes em inglês (title, date, etc.)
-- Esta migration adiciona as colunas faltantes e corrige tipos.
-- ============================================================

-- 1. Adicionar colunas inglês que estão faltando
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Reunião Importada',
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS meeting_type TEXT,
  ADD COLUMN IF NOT EXISTS objective TEXT,
  ADD COLUMN IF NOT EXISTS pendencies JSONB,
  ADD COLUMN IF NOT EXISTS productivity_criteria JSONB;

-- 2. Corrigir action_items de TEXT para JSONB
ALTER TABLE public.meetings DROP COLUMN IF EXISTS action_items;
ALTER TABLE public.meetings ADD COLUMN action_items JSONB;

-- 3. Corrigir topics_discussed de TEXT para JSONB
ALTER TABLE public.meetings DROP COLUMN IF EXISTS topics_discussed;
ALTER TABLE public.meetings ADD COLUMN topics_discussed JSONB;

-- 4. Garantir constraint UNIQUE em fireflies_id (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_fireflies_id'
      AND conrelid = 'public.meetings'::regclass
  ) THEN
    ALTER TABLE public.meetings ADD CONSTRAINT unique_fireflies_id UNIQUE (fireflies_id);
  END IF;
END$$;

-- 5. Recriar RPC create_processing_meeting com colunas corretas
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
  ON CONFLICT (fireflies_id) DO UPDATE SET
    status = 'processing',
    user_id = v_uid
  RETURNING to_jsonb(meetings.*) INTO v_row;

  RETURN v_row;
END;
$$;
