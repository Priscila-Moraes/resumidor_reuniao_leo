# Informações Importantes — ReuniãoAI

## Infraestrutura

O software está hospedado em VPS (DigitalOcean) via **EasyPanel**.

- **VPS:** DigitalOcean Droplet `trafego-automatizado` — IP `159.65.242.77` (NYC3, 4GB/80GB)
- **EasyPanel:** [http://159.65.242.77:3000](http://159.65.242.77:3000) — Projeto `n8n`
- **Backend (Node.js/Express):** [n8n-backend.gfime0.easypanel.host](https://n8n-backend.gfime0.easypanel.host)
- **Frontend (React/Vite):** [n8n-front.gfime0.easypanel.host](https://n8n-front.gfime0.easypanel.host)
- **Banco de dados:** Supabase — [fnjivgsmbaxssuutacpq.supabase.co](https://fnjivgsmbaxssuutacpq.supabase.co)

## Contas e Acessos

| Serviço | Conta / E-mail | Observação |
| --- | --- | --- |
| **Supabase** | `moraes.automax@gmail.com` | Projeto `moraes.automax@Project` |
| **DigitalOcean** | *(verificar)* | Droplet `trafego-automatizado` |
| **GitHub** | `Priscila-Moraes` | Repo `resumidor_reuniao_leo` |
| **Fireflies.ai** | *(verificar)* | Webhook configurado no painel |

## Deploy

O deploy é feito via **GitHub → EasyPanel** com auto-deploy ao pushear na branch `main`.

- Para redeployar o backend: faça push em `main` **e acesse o painel do EasyPanel e clique em "Redeploy"** (o auto-deploy por push nem sempre funciona)
- O EasyPanel passa `GIT_SHA` como build arg para bustar o cache do Docker a cada deploy
- Para confirmar a versão deployada: acesse `/health` — deve retornar `{"status":"OK","version":"2026-08-25-gpt-5.6-luna"}`

## Endpoints principais

| Rota | Método | Descrição |
| --- | --- | --- |
| `/health` | GET | Health check do backend (retorna versão) |
| `/api/meetings/:id/reprocess` | POST | Reprocessa/analisa reunião existente (requer `user_secret` e `fireflies_id` no body) |
| `/api/webhooks/fireflies/:user_secret` | POST | Webhook chamado pelo Fireflies após reunião terminar |
| `/api/sync/fireflies` | POST | Sincroniza reuniões recentes do Fireflies |
| `/api/validate-keys` | POST | Valida chaves OpenAI e Fireflies |

## Webhook do Fireflies

A URL do webhook deve ser configurada em:
**Fireflies.ai → Settings → Developer Settings → Integrations → Webhooks**

Usar a URL completa **com o secret no final**:
`https://n8n-backend.gfime0.easypanel.host/api/webhooks/fireflies/[USER_SECRET]`

⚠️ **Nunca usar a URL sem o secret** — retorna 404.

## Tecnologias

- **Frontend:** React (JSX) + Vite + Tailwind CSS
- **Backend:** Node.js + Express (JavaScript, `server.js`)
- **Auth + DB:** Supabase (RLS ativado, RPCs com SECURITY DEFINER)
- **Transcrição:** Fireflies.ai (GraphQL API)
- **IA:** OpenAI `gpt-5.6-luna` via `chat.completions` (primário) com fallback `gpt-5.6-terra`
- **Infraestrutura:** Docker + EasyPanel VPS (DigitalOcean)

## Histórico de Problemas Conhecidos e Soluções

### 1. Modelo OpenAI e parâmetro `max_completion_tokens` (2026-08-25)
- **Causa raiz:** O endpoint de validação de chave e modelos da família GPT-5 da OpenAI descontinuaram o parâmetro antigo `max_tokens` em favor de `max_completion_tokens`. O modelo `gpt-5-mini` com Responses API também apresentava instabilidades.
- **Solução:** Migrado para `gpt-5.6-luna` (10x mais econômico e estável) e `gpt-5.6-terra` como fallback, utilizando `max_completion_tokens` e a API estável `chat.completions`.

### 2. Reprocessamento com `fireflies_id undefined` (2026-08-25)
- **Causa raiz:** A RPC do banco `get_meeting_for_reprocess` não retornava o campo `fireflies_id` na query, fazendo com que o backend tentasse buscar a transcrição com `id: undefined` no GraphQL do Fireflies (`Variable "$id" of required type "String!" was not provided.`).
- **Solução:**
  1. Frontend agora envia `fireflies_id` no body da requisição POST.
  2. Backend aceita `req.body.fireflies_id` prioritariamente e atualiza título, data e duração reais recebidos do Fireflies.
  3. Atualizada a RPC no banco para incluir `fireflies_id, title, date, duration, transcript`.

### 3. Migração de Servidor EasyPanel / Domínios (2026-08-25)
- **Causa raiz:** O Droplet anterior da DigitalOcean foi recriado, alterando o sufixo de domínio de `.v6mtnf.` para `.gfime0.`.
- **Solução:**
  1. Backend `CORS_ORIGIN` atualizado no EasyPanel.
  2. Supabase Auth (Site URL + Redirect URLs) atualizado para `https://n8n-front.gfime0.easypanel.host/**`.
  3. Webhook do Fireflies atualizado com a nova URL do backend.

---

## Status da Aplicação (2026-08-25)
- [x] Backend no ar e saudável em `https://n8n-backend.gfime0.easypanel.host/health`
- [x] Frontend ativo e com login funcionando em `https://n8n-front.gfime0.easypanel.host`
- [x] Validação de chaves OpenAI e Fireflies 100% OK
- [x] Importação, transcrição e geração de resumos com IA testados e validados end-to-end
