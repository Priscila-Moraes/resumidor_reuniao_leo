-- ============================================================
-- MIGRATION v3: RPC para sincronização do Fireflies
-- ============================================================
-- Adiciona: get_unprocessed_fireflies_ids
-- Uso: backend verifica quais IDs ainda não foram processados
-- antes de disparar a sincronização em massa
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
  -- Retorna IDs que NÃO existem como 'completed' para o usuário
  -- (novos ou com status 'error' serão reprocessados)
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
