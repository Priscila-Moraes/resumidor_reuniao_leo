-- ============================================================
-- MIGRATION v7: Não sincronizar reuniões já existentes
-- ============================================================
-- Data: 27/04/2026
--
-- Contexto:
-- A sincronização em massa do Fireflies usava get_unprocessed_fireflies_ids
-- para ignorar apenas reuniões com status 'completed'. Isso permitia que
-- reuniões já existentes com status 'processing' ou 'error' fossem reenviadas.
--
-- Novo comportamento:
-- Se o fireflies_id já existe para o usuário, a sincronização ignora,
-- independentemente do status.
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
    AND m.fireflies_id = ANY(p_fireflies_ids);
END;
$$;
