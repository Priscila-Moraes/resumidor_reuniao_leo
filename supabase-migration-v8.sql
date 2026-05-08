-- ============================================================
-- Migration v8 — Habilitar Supabase Realtime na tabela meetings
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Habilita REPLICA IDENTITY FULL para que o Realtime envie
-- os dados completos nas mensagens de UPDATE e DELETE
ALTER TABLE public.meetings REPLICA IDENTITY FULL;

-- Adiciona meetings à publicação do Supabase Realtime
-- (ignora silenciosamente se já estiver na publicação)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'meetings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
  END IF;
END $$;
