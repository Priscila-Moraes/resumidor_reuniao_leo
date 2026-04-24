-- ============================================================
-- MIGRATION v4: RPC para criar reunião em processamento pelo frontend
-- ============================================================
-- Permite que o frontend autenticado insira um registro 'processing'
-- sem depender do cache do schema do PostgREST (evita PGRST204).
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
  ON CONFLICT (fireflies_id) DO UPDATE SET
    status = 'processing',
    user_id = v_uid
  RETURNING to_jsonb(meetings.*) INTO v_row;

  RETURN v_row;
END;
$$;
