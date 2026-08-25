# Informações Importantes — ReuniãoAI

## Infraestrutura

O software está hospedado em VPS via **EasyPanel**.

- **Backend (Node.js/Express):** [n8n-backend.v6mtnf.easypanel.host](https://n8n-backend.v6mtnf.easypanel.host)
- **Frontend (React/Vite):** servido via EasyPanel no mesmo servidor
- **Banco de dados:** Supabase — [fnjivgsmbaxssuutacpq.supabase.co](https://fnjivgsmbaxssuutacpq.supabase.co)

## Deploy

O deploy é feito via **GitHub → EasyPanel** com auto-deploy ao pushear na branch `main`.

- Para redeployar o backend: faça push em `main` **e acesse o painel do EasyPanel e clique em "Redeploy"** (o auto-deploy por push nem sempre funciona)
- O EasyPanel passa `GIT_SHA` como build arg para bustar o cache do Docker a cada deploy
- Para confirmar a versão deployada: acesse `/health` — deve retornar `{"status":"OK","version":"2026-06-02-fix-reprocess"}`

## Endpoints principais

| Rota | Método | Descrição |
| --- | --- | --- |
| `/health` | GET | Health check do backend |
| `/api/meetings/:id/reprocess` | POST | Reprocessa reunião existente (requer `user_secret` no body) |
| `/api/webhooks/fireflies/:user_secret` | POST | Webhook chamado pelo Fireflies após reunião |
| `/api/sync/fireflies` | POST | Sincroniza reuniões recentes do Fireflies |
| `/api/validate-keys` | POST | Valida chaves OpenAI e Fireflies |

## Webhook do Fireflies

A URL do webhook deve ser configurada em:
**Fireflies.ai → Settings → Developer Settings → Integrations → Webhooks**

Usar a URL completa **com o secret no final**:
`https://n8n-backend.v6mtnf.easypanel.host/api/webhooks/fireflies/[USER_SECRET]`

⚠️ **Nunca usar a URL sem o secret** — retorna 404.

## Tecnologias

- **Frontend:** React (JSX) + Vite + Tailwind CSS
- **Backend:** Node.js + Express (JavaScript, `server.js`)
- **Auth + DB:** Supabase (RLS ativado, RPCs com SECURITY DEFINER)
- **Transcrição:** Fireflies.ai (GraphQL API)
- **IA:** OpenAI `gpt-5.6-luna` via `chat.completions` (primário) com fallback `gpt-5.6-terra`
- **Infraestrutura:** Docker + EasyPanel VPS

## Problemas Conhecidos e Soluções (sessão 2026-06-02)

### Por que as reuniões ficavam com "Erro"

**Causa raiz:** O `openai.js` usava `openai.responses.create` com `model: 'gpt-5-mini'` e `reasoning: { effort: 'low' }`. Esse parâmetro de reasoning parou de funcionar corretamente (mudança na API da OpenAI), e `response.output_text` retornava vazio/indefinido → `JSON.parse(undefined)` → erro silencioso.

**Correção:** Migrado para `openai.chat.completions.create` com `gpt-4o-mini` como modelo primário e `gpt-4o` como fallback. Arquivo: `backend/services/openai.js`.

### Por que o botão ↺ dizia "Transcrição não encontrada no banco"

**Causa raiz:** O endpoint `/api/meetings/:id/reprocess` só sabia reanalisar transcrições já salvas no banco. Quando o processamento inicial falhou antes de salvar a transcrição, o botão não fazia nada.

**Correção:** O endpoint agora re-busca a transcrição no Fireflies quando não há dados salvos (usa `fireflies_id` + `fireflies_api_key` do perfil). Arquivo: `backend/server.js`.

### Status "Processando" não aparecia imediatamente

**Causa raiz:** O status `processing` era salvo no banco APÓS buscar a transcrição do Fireflies, não antes.

**Correção:** Status agora é salvo como `processing` imediatamente ao clicar em ↺, antes de qualquer operação assíncrona.

### URL do webhook configurada errada no Fireflies

**Causa raiz:** A URL estava sem o secret: `...api/webhooks/fireflies` em vez de `...api/webhooks/fireflies/[SECRET]`.

**Correção:** URL corrigida diretamente nas configurações do Fireflies.

### Deploy falhava com "npm ci" — package.json com devDependencies

**Causa raiz:** `package.json` foi modificado para incluir devDependencies TypeScript, mas `package-lock.json` não foi atualizado. `npm ci` exige sincronização exata.

**Correção:** `package.json` revertido para incluir apenas dependencies de produção. O `server.js` não precisa de TypeScript para rodar.

## Limitações do Plano Gratuito Fireflies

- **"0 Free meetings"**: cota mensal de gravações esgotada
- Bot Fred **não entra automaticamente** em novas reuniões quando a cota está zerada
- Reuniões sem bot = sem transcrição = processamento falha
- **Auto-record desativado**: ativar em Fireflies → Settings → Recording & Privacy

## Reuniões que funcionam vs. falham

Reuniões que **funcionam** (têm sentences via API):
- Todas as reuniões de maio que foram processadas com sucesso

Reuniões que **falham** (sem transcript disponível):
- Reuniões de junho 2 ("Reunião Importada") — bot não estava presente ou cota zerada
- Essas podem ser deletadas com segurança
