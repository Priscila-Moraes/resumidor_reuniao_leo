-- =============================================================================
-- ReuniãoAI — Schema completo do banco de dados (Supabase / PostgreSQL)
-- =============================================================================
-- Como usar:
--   1. Crie um projeto no Supabase (supabase.com)
--   2. Acesse SQL Editor e execute este arquivo inteiro
--   3. Em Authentication > Providers, habilite Email e (opcional) Google OAuth
--   4. Copie a URL e a Anon Key do projeto para as variáveis de ambiente
-- =============================================================================


-- =============================================================================
-- TABELA: profiles
-- Criada automaticamente quando um usuário se cadastra (via trigger abaixo).
-- Armazena as chaves de API e o secret único de webhook de cada usuário.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                        UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                     TEXT        NOT NULL,
  openai_api_key            TEXT,
  fireflies_api_key         TEXT,
  fireflies_webhook_secret  TEXT,
  created_at                TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver o próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar o próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- =============================================================================
-- TABELA: meetings
-- Cada reunião processada pelo Fireflies + IA fica aqui.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.meetings (
  id                        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   UUID        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  titulo                    TEXT        NOT NULL,
  data                      TIMESTAMP WITH TIME ZONE NOT NULL,
  status                    TEXT        DEFAULT 'concluido',   -- processando | concluido | erro

  -- Metadados do Fireflies
  fireflies_id              TEXT,
  duration                  INTEGER,                           -- duração em minutos
  transcript                JSONB       DEFAULT '{}'::jsonb,  -- transcrição bruta em JSONB
  transcricao_bruta         TEXT,                             -- transcrição formatada em texto

  -- Campos preenchidos pela IA
  tipo_reuniao              TEXT,                             -- Equipe | Vendas | Projeto | ...
  objetivo                  TEXT,
  resumo_executivo          TEXT,
  topicos_discutidos        JSONB       DEFAULT '[]'::jsonb,
  decisoes                  TEXT,                             -- markdown com bullets
  itens_acao                JSONB       DEFAULT '[]'::jsonb,  -- [{tarefa, responsavel, prazo}]
  pendencias                JSONB       DEFAULT '[]'::jsonb,
  aproveitamento_nota       INTEGER,                          -- 0 a 10
  aproveitamento_motivo     TEXT,
  aproveitamento_criterios  JSONB       DEFAULT '{}'::jsonb,  -- {objetivos_claros, decisoes_tomadas, ...}

  -- Campos legados (mantidos para compatibilidade)
  resumo                    TEXT,
  pontos_importantes        JSONB       DEFAULT '[]'::jsonb,

  created_at                TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Row Level Security
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver as próprias reuniões"
  ON public.meetings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir as próprias reuniões"
  ON public.meetings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar as próprias reuniões"
  ON public.meetings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar as próprias reuniões"
  ON public.meetings FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- TRIGGER: handle_new_user
-- Executado automaticamente após cada novo cadastro no Supabase Auth.
-- Cria o registro na tabela profiles com um webhook secret único.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, fireflies_webhook_secret)
  VALUES (
    new.id,
    new.email,
    gen_random_uuid()::text
  )
  ON CONFLICT (id) DO UPDATE
    SET fireflies_webhook_secret = COALESCE(
      public.profiles.fireflies_webhook_secret,
      gen_random_uuid()::text
    );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincula o trigger ao evento de criação de usuário no Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- =============================================================================
-- RPC: get_profile_by_webhook_secret
-- Usada pelo backend no endpoint de webhook do Fireflies.
-- Como o webhook não tem JWT de usuário, esta função SECURITY DEFINER
-- permite buscar o perfil pelo secret sem precisar contornar o RLS manualmente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_profile_by_webhook_secret(p_secret TEXT)
RETURNS TABLE(
  id               UUID,
  openai_api_key   TEXT,
  fireflies_api_key TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.openai_api_key, p.fireflies_api_key
  FROM public.profiles p
  WHERE p.fireflies_webhook_secret = p_secret
  LIMIT 1;
END;
$$;


-- =============================================================================
-- RPC: get_meeting_for_reprocess
-- Usada pelo backend ao reprocessar uma reunião via JWT do usuário.
-- Garante que o usuário só acessa reuniões que lhe pertencem.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_meeting_for_reprocess(p_meeting_id UUID, p_user_id UUID)
RETURNS TABLE(
  id               UUID,
  transcript       JSONB,
  transcricao_bruta TEXT,
  status           TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.transcript, m.transcricao_bruta, m.status
  FROM public.meetings m
  WHERE m.id = p_meeting_id AND m.user_id = p_user_id
  LIMIT 1;
END;
$$;


-- =============================================================================
-- PERMISSÕES das RPCs
-- Permite que clientes com anon key (webhook) e usuários autenticados chamem
-- as funções acima.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_profile_by_webhook_secret(TEXT)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_meeting_for_reprocess(UUID, UUID)      TO authenticated;


-- =============================================================================
-- DADOS INICIAIS: gera webhook secret para perfis que ainda não têm
-- (útil ao rodar em um projeto que já tinha dados antes desta migração)
-- =============================================================================

UPDATE public.profiles
SET fireflies_webhook_secret = gen_random_uuid()::text
WHERE fireflies_webhook_secret IS NULL;
