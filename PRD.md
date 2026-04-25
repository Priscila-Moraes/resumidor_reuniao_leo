# PRD - AI Meet: Resumo Inteligente de Reunioes com IA

**Produto:** AI Meet
**Versao:** 1.0.0
**Data:** 09 de Marco de 2026
**Autor:** Product Management
**Status:** Em evolucao

---

## Indice

1. [Visao Geral do Produto](#1-visao-geral-do-produto)
2. [Objetivos e Metricas de Sucesso](#2-objetivos-e-metricas-de-sucesso)
3. [Personas e Publico-Alvo](#3-personas-e-publico-alvo)
4. [Funcionalidades Atuais (Implementadas)](#4-funcionalidades-atuais-implementadas)
5. [Arquitetura Tecnica](#5-arquitetura-tecnica)
6. [Fluxos de Usuario](#6-fluxos-de-usuario)
7. [Requisitos Nao-Funcionais](#7-requisitos-nao-funcionais)
8. [Roadmap de Desenvolvimento Futuro](#8-roadmap-de-desenvolvimento-futuro)
9. [Backlog de Melhorias](#9-backlog-de-melhorias)
10. [Riscos e Mitigacoes](#10-riscos-e-mitigacoes)
11. [Glossario](#11-glossario)

---

## 1. Visao Geral do Produto

### 1.1 O que e o AI Meet?

O **AI Meet** e uma plataforma SaaS que transforma automaticamente transcricoes de reunioes em resumos executivos inteligentes, decisoes-chave e itens de acao utilizando inteligencia artificial. O produto integra-se ao Fireflies.ai para captura automatica de transcricoes e utiliza o modelo GPT-4o-mini da OpenAI para analise semantica profunda do conteudo.

### 1.2 Qual problema resolve?

Profissionais gastam em media 31 horas por mes em reunioes improdutivas (fonte: Atlassian). Apos cada reuniao, e comum que:

- Ninguem registre as decisoes tomadas
- Itens de acao se percam sem atribuicao clara
- Pessoas que faltaram nao tenham contexto do que foi discutido
- O tempo gasto fazendo atas manuais seja desperdicado

O AI Meet elimina esses problemas ao automatizar completamente o processo de documentacao pos-reuniao, entregando em segundos o que levaria 20-30 minutos de trabalho manual.

### 1.3 Proposta de Valor

> "Nunca mais perca uma decisao, um compromisso ou o contexto de uma reuniao. O AI Meet transforma horas de gravacao em insights acionaveis em segundos."

### 1.4 Modelo de Negocio Atual

Atualmente o produto opera em modelo **BYOK (Bring Your Own Key)** -- cada usuario fornece suas proprias chaves de API da OpenAI e do Fireflies.ai. Isso elimina custos de infraestrutura de IA para o operador da plataforma e permite escalabilidade sem fricao de billing.

---

## 2. Objetivos e Metricas de Sucesso

### 2.1 Objetivos Estrategicos

| Objetivo | Descricao | Horizonte |
|----------|-----------|-----------|
| **Adocao Inicial** | Validar product-market fit com early adopters | 0-3 meses |
| **Retencao** | Garantir que usuarios processem reunioes recorrentemente | 3-6 meses |
| **Expansao** | Ampliar integracoes e funcionalidades para atrair novos segmentos | 6-12 meses |
| **Monetizacao** | Implementar modelo freemium/pro com billing | 12-18 meses |

### 2.2 KPIs Primarios

| Metrica | Meta (3 meses) | Meta (6 meses) | Meta (12 meses) |
|---------|-----------------|-----------------|------------------|
| Usuarios cadastrados | 100 | 500 | 2.000 |
| Reunioes processadas/mes | 300 | 2.000 | 15.000 |
| Taxa de retencao (D30) | 40% | 55% | 70% |
| NPS | > 30 | > 45 | > 60 |
| Tempo medio de processamento | < 30s | < 20s | < 15s |

### 2.3 KPIs Secundarios

- **Taxa de conversao cadastro -> primeira reuniao processada:** meta > 60%
- **Reunioes processadas por usuario/mes:** meta > 8
- **Taxa de erro no processamento:** meta < 2%
- **Tempo medio de sessao:** meta > 4 minutos

---

## 3. Personas e Publico-Alvo

### Persona 1: Lider de Equipe / Gerente de Projeto

**Nome ficticio:** Mariana, 34 anos
**Cargo:** Product Manager em startup de tecnologia
**Dor principal:** Participa de 6-10 reunioes por semana e nao consegue documentar tudo. Precisa repassar decisoes ao time de forma clara.
**Como usa o AI Meet:** Configura o webhook do Fireflies uma vez e recebe automaticamente resumos de todas as suas reunioes. Consulta decisoes e itens de acao antes de stand-ups.
**Objetivo:** Economizar tempo e garantir que nada se perca entre reunioes.

### Persona 2: Executivo / Diretor

**Nome ficticio:** Ricardo, 45 anos
**Cargo:** Diretor de Operacoes em empresa de medio porte
**Dor principal:** Precisa de visibilidade sobre o que acontece em reunioes das quais nao participa. Quer resumos rapidos sem assistir gravacoes.
**Como usa o AI Meet:** Acessa o dashboard para ler resumos executivos e decisoes-chave de reunioes de seus liderados.
**Objetivo:** Tomar decisoes informadas com base em resumos concisos.

### Persona 3: Consultor / Freelancer

**Nome ficticio:** Ana, 29 anos
**Cargo:** Consultora de negocios independente
**Dor principal:** Faz reunioes com multiplos clientes e precisa manter registro organizado de cada projeto.
**Como usa o AI Meet:** Processa reunioes manualmente por ID quando precisa de documentacao formal para seus clientes.
**Objetivo:** Profissionalizar a entrega de documentacao de reunioes.

### Persona 4: Equipe de Vendas

**Nome ficticio:** Carlos, 31 anos
**Cargo:** Account Executive em empresa B2B SaaS
**Dor principal:** Faz dezenas de calls de vendas por semana e precisa registrar compromissos e proximos passos no CRM.
**Como usa o AI Meet:** Revisa itens de acao apos cada call de vendas para atualizar o pipeline.
**Objetivo:** Nunca esquecer um follow-up com prospect.

---

## 4. Funcionalidades Atuais (Implementadas)

### 4.1 Autenticacao e Gerenciamento de Sessao

| Funcionalidade | Detalhes |
|----------------|----------|
| **Login com email/senha** | Formulario com validacao, mensagens de erro claras |
| **Login social com Google** | OAuth via Supabase Auth (signInWithOAuth) |
| **Gerenciamento de sessao** | Persistencia automatica via Supabase, deteccao de mudancas de estado (onAuthStateChange) |
| **Rotas protegidas** | Componente PrivateRoute que redireciona para /login se nao autenticado |
| **Redirecionamento inteligente** | Rota raiz (/) redireciona para /dashboard se logado ou /login se nao |
| **Logout** | Botao de sair na sidebar com navegacao para tela de login |
| **Link para cadastro** | Presente na tela de login (ainda sem implementacao de pagina propria) |
| **Link "Esqueceu a senha"** | Presente na tela de login (ainda sem implementacao funcional) |

### 4.2 Dashboard de Reunioes

| Funcionalidade | Detalhes |
|----------------|----------|
| **Listagem de reunioes** | Cards ordenados por data (mais recente primeiro), com titulo, data, duracao, tipo e preview do resumo |
| **Badge de tipo de reuniao** | Cores diferenciadas por tipo: Vendas (azul), Equipe (teal), Projeto (roxo), 1on1 (laranja), Geral (cinza) |
| **Navegacao para detalhes** | Clique no card leva para /reuniao/:id |
| **Exclusao de reuniao** | Botao de lixeira em cada card, com modal de confirmacao (ConfirmModal) e toast de feedback |
| **Processamento manual** | Formulario para inserir Meeting ID do Fireflies e processar manualmente, com feedback visual (loading spinner, mensagens de sucesso/erro) |
| **Campo de busca** | Input de pesquisa presente na UI (ainda sem logica de filtragem implementada) |
| **Filtro por data** | Botao presente na UI (ainda sem logica implementada) |
| **Filtro por tipo** | Botao presente na UI (ainda sem logica implementada) |
| **Estado vazio** | Mensagem orientando o usuario a configurar o webhook quando nao ha reunioes |
| **Loading state** | Spinner animado durante carregamento dos dados |

### 4.3 Detalhes da Reuniao

| Funcionalidade | Detalhes |
|----------------|----------|
| **Layout em duas colunas** | Coluna esquerda: analise da IA / Coluna direita: transcricao completa |
| **Header com metadados** | Data formatada em pt-BR, badge de tipo de reuniao, botao voltar |
| **Objetivo da reuniao** | Extraido automaticamente pela IA |
| **Resumo executivo** | Paragrafos gerados pela IA com whitespace preservado |
| **Decisoes-chave** | Lista com icones de check verde, parseada de Markdown bullet points |
| **Itens de acao** | Lista com checkboxes interativos (estado local apenas, sem persistencia) |
| **Transcricao completa** | Exibicao sentenca por sentenca com nome do participante, texto e timestamp |
| **Responsividade** | Layout adapta de duas colunas (desktop) para coluna unica empilhada (mobile) |
| **Navegacao de retorno** | Botao "Voltar" leva ao dashboard |

### 4.4 Configuracoes do Usuario

| Funcionalidade | Detalhes |
|----------------|----------|
| **Chave OpenAI** | Campo password para inserir/atualizar a API key da OpenAI, com orientacao de seguranca |
| **Chave Fireflies** | Campo password para inserir/atualizar a API key do Fireflies.ai, com link para obtencao da chave |
| **Salvar configuracoes** | Botao de salvar com estado de loading e feedback via toast |
| **Webhook URL unica** | Endpoint exclusivo gerado por usuario (baseado em fireflies_webhook_secret), exibido em campo read-only |
| **Copiar webhook** | Botao para copiar URL do webhook para clipboard com feedback visual (icone muda para checkmark) |
| **Aviso de seguranca** | Alerta visual sobre manter o webhook URL em segredo |

### 4.5 Processamento Automatico via Webhook

| Funcionalidade | Detalhes |
|----------------|----------|
| **Endpoint de webhook** | POST /api/webhooks/fireflies/:user_secret |
| **Validacao de secret** | RPC get_profile_by_webhook_secret valida o secret e retorna perfil do usuario |
| **Validacao de chaves** | Verifica se usuario tem OpenAI e Fireflies API keys configuradas |
| **Resposta assincrona** | Retorna 202 imediatamente e processa a reuniao em background |
| **Busca de transcricao** | GraphQL query ao Fireflies para obter sentencas, titulo, duracao e data |
| **Analise com IA** | Prompt especializado que extrai tipo, objetivo, resumo, decisoes e itens de acao |
| **Status de processamento** | Tres estados: "processing" (em andamento), "completed" (sucesso), "error" (falha) |
| **Tratamento de erros** | Em caso de falha na analise, atualiza o registro com status "error" |

### 4.6 Integracao com Fireflies.ai

| Funcionalidade | Detalhes |
|----------------|----------|
| **API GraphQL** | Consulta ao endpoint https://api.fireflies.ai/graphql |
| **Dados extraidos** | ID, titulo, duracao, data, sentencas (speaker_name, text, start_time, end_time) |
| **Texto concatenado** | Sentencas formatadas como "speaker: texto" para envio a OpenAI |
| **Chave por usuario** | Multi-tenant -- cada usuario usa sua propria API key do Fireflies |

### 4.7 Analise com OpenAI

| Funcionalidade | Detalhes |
|----------------|----------|
| **Modelo utilizado** | gpt-4o-mini (128k tokens de contexto) |
| **Temperatura** | 0.2 (baixa, para respostas factuais e consistentes) |
| **Formato de resposta** | JSON estruturado (response_format: json_object) |
| **Campos extraidos** | tipo_reuniao, objetivo, resumo_executivo, decisoes (Markdown), itens_acao (array) |
| **Prompt especializado** | System prompt em portugues focado em analise executiva |
| **Multi-tenant** | SDK inicializado com a chave do usuario final a cada requisicao |

### 4.8 Interface e UX

| Funcionalidade | Detalhes |
|----------------|----------|
| **PWA (Progressive Web App)** | Manifest.json configurado, Service Worker com cache strategies, suporte a instalacao em mobile/desktop |
| **Service Worker** | Cache-first para assets estaticos, network-first para API e navegacao, fallback offline com pagina customizada |
| **Sidebar responsiva** | Navegacao lateral com hamburger menu no mobile, drawer animado com backdrop |
| **Toast notifications** | Componente reutilizavel com suporte a sucesso e erro, auto-dismiss configuravel |
| **Modal de confirmacao** | Componente reutilizavel com suporte a modo "danger" (vermelho), backdrop blur |
| **Tema visual** | Design clean com paleta azul (#2c5282), tipografia moderna, sombras sutis |
| **Icones** | Biblioteca Lucide React (Brain, Calendar, Settings, etc.) |
| **Formatacao de datas** | Biblioteca date-fns com locale pt-BR |

### 4.9 Infraestrutura e Deploy

| Componente | Detalhes |
|------------|----------|
| **Frontend** | React + Vite + TailwindCSS, servido via Nginx em container Docker |
| **Backend** | Express.js (Node 20-alpine) em container Docker |
| **Banco de dados** | Supabase (PostgreSQL gerenciado) com RLS (Row Level Security) |
| **Hospedagem** | EasyPanel em VPS com duas apps separadas (backend + frontend) |
| **RPCs do banco** | get_profile_by_webhook_secret e process_webhook_meeting para contornar RLS de forma segura |

---

## 5. Arquitetura Tecnica

### 5.1 Stack Tecnologico

```
Frontend:
  - React 18 + Vite
  - TailwindCSS
  - React Router DOM (rotas SPA)
  - Lucide React (icones)
  - date-fns (formatacao de datas)
  - Supabase JS SDK (auth + DB)
  - Service Worker (PWA)

Backend:
  - Node.js 20 (Alpine)
  - Express.js 5
  - Supabase JS SDK
  - OpenAI SDK v6
  - Axios (HTTP client para Fireflies GraphQL)
  - dotenv (variaveis de ambiente)
  - CORS middleware

Banco de Dados:
  - Supabase (PostgreSQL)
  - Tabelas: profiles, meetings
  - RLS habilitado
  - RPCs para operacoes seguras

Infraestrutura:
  - EasyPanel (orquestracao de containers)
  - Docker (containerizacao)
  - Nginx (serving frontend)
```

### 5.2 Diagrama de Fluxo de Dados

```
[Reuniao Gravada]
       |
       v
[Fireflies.ai] --(webhook)--> [Backend Express]
       |                              |
       |                    1. Valida webhook secret (RPC)
       |                    2. Retorna 202 (async)
       |                              |
       |                    3. Busca transcricao (GraphQL)
       |<-----------------------------+
       |
       +---(transcricao)---> [Backend Express]
                                      |
                            4. Salva status "processing" (RPC)
                            5. Envia para OpenAI (gpt-4o-mini)
                                      |
                            6. Salva analise completa (RPC)
                                      |
                                      v
                              [Supabase DB]
                                      |
                                      v
                              [Frontend React]
                              (consulta via SDK)
```

### 5.3 Modelo de Dados

**Tabela: profiles**
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID (PK) | ID do usuario (mesmo do auth.users) |
| openai_api_key | TEXT | Chave da API OpenAI do usuario |
| fireflies_api_key | TEXT | Chave da API Fireflies do usuario |
| fireflies_webhook_secret | TEXT | Secret unico para o endpoint de webhook |

**Tabela: meetings**
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID (PK) | Identificador unico da reuniao |
| user_id | UUID (FK) | Referencia ao usuario dono |
| fireflies_id | TEXT | ID da reuniao no Fireflies |
| title | TEXT | Titulo da reuniao |
| date | TIMESTAMPTZ | Data e hora da reuniao |
| duration | INTEGER | Duracao em minutos |
| meeting_type | TEXT | Tipo classificado pela IA |
| objective | TEXT | Objetivo extraido pela IA |
| executive_summary | TEXT | Resumo executivo gerado pela IA |
| decisions | TEXT | Decisoes-chave em formato Markdown |
| action_items | JSONB | Array de itens de acao |
| transcript | JSONB | Array de sentencas da transcricao |
| status | TEXT | processing, completed, error |

---

## 6. Fluxos de Usuario

### 6.1 Primeiro Acesso (Onboarding)

```
1. Usuario acessa a URL do AI Meet
2. Visualiza tela de login com opcoes email/senha ou Google
3. Realiza cadastro (via link "Cadastre-se") ou login com Google
4. E redirecionado para o Dashboard (vazio)
5. Navega ate Configuracoes
6. Insere sua OpenAI API Key
7. Insere sua Fireflies API Key
8. Salva configuracoes
9. Copia a URL do Webhook exclusiva
10. Acessa o painel do Fireflies.ai e configura o webhook
11. Pronto -- proximas reunioes serao processadas automaticamente
```

### 6.2 Processamento Automatico (Fluxo Principal)

```
1. Usuario realiza uma reuniao gravada pelo Fireflies
2. Fireflies finaliza transcricao e dispara webhook
3. Backend recebe webhook, valida o secret do usuario
4. Backend busca transcricao completa via API GraphQL do Fireflies
5. Backend salva registro com status "processing"
6. Backend envia texto para OpenAI gpt-4o-mini
7. IA retorna analise estruturada (tipo, resumo, decisoes, acoes)
8. Backend atualiza registro com status "completed"
9. Usuario acessa o Dashboard e ve a reuniao listada
10. Usuario clica na reuniao para ver detalhes completos
```

### 6.3 Processamento Manual

```
1. Usuario acessa o Dashboard
2. Insere o Meeting ID do Fireflies no campo de processamento manual
3. Clica em "Processar"
4. Sistema busca o webhook secret do usuario no banco
5. Envia requisicao POST para o proprio backend
6. Backend processa a reuniao (mesmo fluxo do webhook)
7. Apos ~8 segundos, Dashboard e atualizado automaticamente
8. Reuniao aparece na lista com resumo da IA
```

### 6.4 Consulta de Reuniao

```
1. Usuario acessa o Dashboard
2. Visualiza lista de reunioes com preview do resumo
3. Clica em uma reuniao para ver detalhes
4. Na tela de detalhes, le o objetivo, resumo executivo e decisoes
5. Revisa itens de acao com checkboxes
6. Consulta a transcricao completa na coluna lateral
7. Clica em "Voltar" para retornar ao Dashboard
```

### 6.5 Exclusao de Reuniao

```
1. No Dashboard, usuario clica no icone de lixeira de uma reuniao
2. Modal de confirmacao e exibido com titulo da reuniao
3. Usuario confirma a exclusao
4. Reuniao e removida do banco (Supabase)
5. Card desaparece da lista
6. Toast de sucesso e exibido
```

---

## 7. Requisitos Nao-Funcionais

### 7.1 Performance

| Requisito | Meta |
|-----------|------|
| Tempo de carregamento inicial (FCP) | < 1.5s |
| Tempo de interacao (TTI) | < 2.5s |
| Tempo de processamento de reuniao (IA) | < 30s para reunioes de ate 1h |
| Tempo de resposta do webhook | < 500ms (retorno 202) |
| Tamanho do bundle JS | < 300KB gzipped |

### 7.2 Seguranca

| Requisito | Implementacao |
|-----------|---------------|
| Autenticacao | Supabase Auth com JWT, suporte a OAuth (Google) |
| Autorizacao | Row Level Security (RLS) no Supabase -- usuarios so acessam seus proprios dados |
| Protecao de chaves | API keys armazenadas no banco com acesso restrito via RLS |
| Webhook seguro | Secret unico por usuario, validado via RPC (contorna RLS) |
| CORS | Middleware configurado no Express |
| Campos sensiveis | Inputs do tipo password para API keys na UI |
| HTTPS | Obrigatorio em producao (via EasyPanel/proxy) |

### 7.3 Disponibilidade e Confiabilidade

| Requisito | Meta |
|-----------|------|
| Uptime | > 99.5% |
| Recuperacao de falha no processamento | Status "error" gravado no banco, reuniao pode ser reprocessada |
| Processamento assincrono | Webhook retorna 202 imediatamente, processamento nao bloqueia |
| Suporte offline (PWA) | Pagina de fallback customizada, cache de assets estaticos |

### 7.4 Escalabilidade

| Aspecto | Estrategia Atual | Evolucao Necessaria |
|---------|-------------------|---------------------|
| Usuarios simultaneos | Single-instance Express | Adicionar load balancer e multiplas replicas |
| Processamento de reunioes | Sincrono in-process | Migrar para fila de mensagens (Redis/BullMQ) |
| Armazenamento | Supabase managed | Escala automaticamente |
| Custo de IA | BYOK (usuario paga) | Manter BYOK ou oferecer plano com chave gerenciada |

### 7.5 Compatibilidade

| Plataforma | Suporte |
|------------|---------|
| Chrome (desktop/mobile) | Completo |
| Safari (desktop/iOS) | Completo (PWA com limitacoes do iOS) |
| Firefox | Completo |
| Edge | Completo |
| Mobile (PWA) | Instalavel, responsivo |

---

## 8. Roadmap de Desenvolvimento Futuro

### Fase 1 -- Fundacao Solida (P0 - Critico) | Semanas 1-4

Itens essenciais para tornar o produto robusto e utilizavel no dia a dia.

| # | Feature | Descricao | Esforco |
|---|---------|-----------|---------|
| 1.1 | **Cadastro de usuario funcional** | Implementar pagina de sign-up com email/senha (atualmente so existe o link) | Pequeno |
| 1.2 | **Recuperacao de senha** | Fluxo de "Esqueceu a senha" funcional via Supabase Auth | Pequeno |
| 1.3 | **Busca funcional no Dashboard** | Implementar filtragem de reunioes por titulo/conteudo no campo de busca existente | Pequeno |
| 1.4 | **Filtros funcionais** | Implementar filtros por data e tipo de reuniao (botoes ja existem na UI) | Medio |
| 1.5 | **Persistencia de checkboxes** | Salvar estado dos itens de acao (marcados/desmarcados) no banco | Pequeno |
| 1.6 | **Indicador de status "processing"** | Mostrar no Dashboard que uma reuniao esta sendo processada (spinner/badge) | Pequeno |
| 1.7 | **Reprocessar reuniao com erro** | Botao para tentar reprocessar reunioes com status "error" | Pequeno |
| 1.8 | **Validacao de API keys** | Testar conexao com OpenAI e Fireflies ao salvar nas configuracoes | Medio |

### Fase 2 -- Experiencia Aprimorada (P1 - Importante) | Semanas 5-10

Funcionalidades que melhoram significativamente a experiencia do usuario.

| # | Feature | Descricao | Esforco |
|---|---------|-----------|---------|
| 2.1 | **Exportacao PDF** | Gerar relatorio PDF da reuniao com resumo, decisoes e itens de acao | Medio |
| 2.2 | **Exportacao por email** | Enviar resumo da reuniao por email para participantes | Medio |
| 2.3 | **Tags e categorias customizadas** | Permitir que o usuario crie tags e categorize reunioes manualmente | Medio |
| 2.4 | **Busca semantica** | Buscar reunioes por significado/contexto usando embeddings vetoriais | Grande |
| 2.5 | **Notificacoes in-app** | Notificar quando uma reuniao termina de ser processada | Medio |
| 2.6 | **Paginacao e scroll infinito** | Otimizar Dashboard para usuarios com muitas reunioes | Medio |
| 2.7 | **Edicao de resumos** | Permitir que o usuario edite/corrija o resumo gerado pela IA | Medio |
| 2.8 | **Tema escuro (Dark Mode)** | Suporte a tema escuro na interface completa | Medio |

### Fase 3 -- Colaboracao e Integracao (P2 - Desejavel) | Semanas 11-20

Recursos que expandem o valor do produto para equipes.

| # | Feature | Descricao | Esforco |
|---|---------|-----------|---------|
| 3.1 | **Compartilhamento de reunioes** | Gerar link publico ou compartilhar com membros da equipe | Grande |
| 3.2 | **Workspaces/Equipes** | Criar espacos de trabalho compartilhados com controle de acesso | Grande |
| 3.3 | **Integracao com Slack** | Enviar resumos automaticamente para canais do Slack | Medio |
| 3.4 | **Integracao com Notion** | Exportar resumos diretamente para paginas do Notion | Medio |
| 3.5 | **Integracao direta com Zoom** | Capturar gravacoes do Zoom sem depender do Fireflies | Grande |
| 3.6 | **Integracao direta com Google Meet** | Capturar gravacoes do Google Meet sem depender do Fireflies | Grande |
| 3.7 | **Integracao direta com Microsoft Teams** | Capturar gravacoes do Teams sem depender do Fireflies | Grande |
| 3.8 | **Comentarios em reunioes** | Permitir que membros da equipe comentem em reunioes | Medio |
| 3.9 | **Notificacoes por email** | Email automatico com resumo apos processamento | Medio |

### Fase 4 -- Inteligencia Avancada e Monetizacao (P3 - Futuro) | Semanas 21-36

Diferenciais competitivos e modelo de receita.

| # | Feature | Descricao | Esforco |
|---|---------|-----------|---------|
| 4.1 | **Dashboard analitico** | Graficos de reunioes por periodo, tempo gasto, topicos recorrentes | Grande |
| 4.2 | **Analise de sentimento** | Detectar tom emocional de participantes ao longo da reuniao | Grande |
| 4.3 | **Deteccao de compromissos e follow-ups** | IA identifica prazos, responsaveis e cria lembretes automaticos | Grande |
| 4.4 | **Planos e Billing (Freemium/Pro)** | Implementar Stripe, limites por plano, trial period | Grande |
| 4.5 | **API publica** | Endpoints REST/GraphQL para integracao com sistemas externos | Grande |
| 4.6 | **Escolha de modelo de IA** | Permitir usuario escolher entre GPT-4o, Claude, Gemini, etc. | Medio |
| 4.7 | **Sumarizacao multi-reuniao** | Gerar resumo semanal/mensal consolidando multiplas reunioes | Grande |
| 4.8 | **Assistente conversacional** | Chat com IA sobre o conteudo das reunioes ("O que foi decidido sobre X?") | Grande |
| 4.9 | **Transcricao em tempo real** | Acompanhar transcricao e analise durante a reuniao | Grande |
| 4.10 | **Whitelabel** | Permitir que empresas usem o AI Meet com sua propria marca | Grande |

---

## 9. Backlog de Melhorias

Listagem detalhada de funcionalidades e melhorias para evolucao continua do produto, organizadas por area.

### 9.1 UX e Interface

| ID | Melhoria | Prioridade | Descricao |
|----|----------|------------|-----------|
| UX-01 | Onboarding guiado | P1 | Wizard de boas-vindas que orienta o usuario na configuracao inicial (API keys + webhook) |
| UX-02 | Skeleton loading | P1 | Substituir spinners por skeleton screens no Dashboard e Detalhes |
| UX-03 | Animacoes de transicao | P2 | Transicoes suaves entre paginas usando Framer Motion |
| UX-04 | Atalhos de teclado | P2 | Navegacao rapida (ex: "N" para nova reuniao, "/" para busca) |
| UX-05 | Tour interativo | P2 | Tooltips guiados para novos usuarios destacando funcionalidades-chave |
| UX-06 | Acessibilidade (WCAG 2.1) | P1 | Garantir conformidade com padroes de acessibilidade (aria labels, contraste, navegacao por teclado) |
| UX-07 | Internacionalizacao (i18n) | P2 | Suporte a ingles alem do portugues |
| UX-08 | Customizacao de layout | P3 | Permitir reordenar/ocultar secoes na tela de detalhes |
| UX-09 | Favoritar reunioes | P1 | Marcar reunioes importantes para acesso rapido |
| UX-10 | Visualizacao em lista/grid | P2 | Alternar entre visualizacao de cards e tabela no Dashboard |

### 9.2 Processamento e IA

| ID | Melhoria | Prioridade | Descricao |
|----|----------|------------|-----------|
| IA-01 | Prompts customizaveis | P2 | Permitir que o usuario ajuste o prompt de analise (ex: focar em decisoes tecnicas) |
| IA-02 | Templates de reuniao | P1 | Templates pre-configurados por tipo (vendas, sprint planning, 1on1, all-hands) |
| IA-03 | Extracao de participantes | P1 | Lista de participantes com tempo de fala e resumo individual |
| IA-04 | Glossario automatico | P3 | IA identifica termos tecnicos/siglas e cria glossario |
| IA-05 | Resumo em multiplos niveis | P2 | Resumo de 1 linha, resumo curto (1 paragrafo) e resumo completo |
| IA-06 | Deteccao de idioma | P2 | Adaptar analise automaticamente ao idioma da transcricao |
| IA-07 | Reprocessar com prompt diferente | P2 | Botao para re-analisar com instrucoes diferentes |
| IA-08 | Custo estimado por reuniao | P1 | Exibir tokens consumidos e custo estimado de cada analise |
| IA-09 | Suporte a audio direto | P3 | Upload de arquivo de audio/video para transcricao (sem depender do Fireflies) |
| IA-10 | IA local/self-hosted | P3 | Opcao de usar modelos locais (Llama, Mistral) para privacidade total |

### 9.3 Colaboracao

| ID | Melhoria | Prioridade | Descricao |
|----|----------|------------|-----------|
| COL-01 | Compartilhar via link | P1 | Gerar link publico com token unico para uma reuniao especifica |
| COL-02 | Permissoes granulares | P2 | Definir quem pode ver, editar ou administrar reunioes compartilhadas |
| COL-03 | Mencoes (@) em itens de acao | P2 | Atribuir itens de acao a pessoas especificas com notificacao |
| COL-04 | Historico de alteracoes | P3 | Log de quem editou resumos ou marcou itens como concluidos |
| COL-05 | Discussao em thread | P3 | Comentarios aninhados em trechos especificos da transcricao |

### 9.4 Integracao e Automacao

| ID | Melhoria | Prioridade | Descricao |
|----|----------|------------|-----------|
| INT-01 | Webhooks de saida | P2 | Disparar webhook quando uma reuniao e processada (para integracoes customizadas) |
| INT-02 | Zapier/Make | P2 | Conectores oficiais para plataformas de automacao |
| INT-03 | Google Calendar sync | P1 | Vincular reunioes a eventos do Google Calendar automaticamente |
| INT-04 | CRM integration (HubSpot, Pipedrive) | P2 | Enviar resumos e itens de acao para CRMs automaticamente |
| INT-05 | Jira/Linear | P2 | Criar tasks automaticamente a partir de itens de acao |
| INT-06 | Google Docs export | P2 | Exportar resumo formatado para Google Docs |
| INT-07 | Integracao com Calendly | P3 | Vincular reunioes agendadas via Calendly |

### 9.5 Analytics e Relatorios

| ID | Melhoria | Prioridade | Descricao |
|----|----------|------------|-----------|
| ANA-01 | Metricas de reuniao | P1 | Total de reunioes, horas gastas, media de duracao por periodo |
| ANA-02 | Mapa de topicos | P2 | Word cloud ou grafo de topicos mais discutidos |
| ANA-03 | Tendencias semanais | P2 | Grafico de tendencia de quantidade e duracao de reunioes |
| ANA-04 | Relatorio semanal por email | P2 | Email automatico com resumo semanal de todas as reunioes |
| ANA-05 | Score de produtividade | P3 | Pontuacao baseada em decisoes/acoes vs tempo gasto |
| ANA-06 | Analise de participacao | P2 | Quem fala mais, quem contribui com mais decisoes |
| ANA-07 | Export CSV/Excel | P1 | Exportar dados de reunioes em formato tabular |

### 9.6 Infraestrutura e DevOps

| ID | Melhoria | Prioridade | Descricao |
|----|----------|------------|-----------|
| INF-01 | Fila de processamento | P0 | Migrar de processamento in-process para BullMQ/Redis |
| INF-02 | Monitoramento e alertas | P0 | Sentry para erros, health checks automatizados, alertas |
| INF-03 | Rate limiting | P1 | Limitar requisicoes por IP/usuario para prevenir abuso |
| INF-04 | Logging estruturado | P1 | Logs em formato JSON com niveis (info, warn, error) para observabilidade |
| INF-05 | Testes automatizados | P1 | Testes unitarios (services) e E2E (fluxos criticos) |
| INF-06 | CI/CD pipeline | P1 | Deploy automatizado via GitHub Actions |
| INF-07 | Backup automatico | P1 | Backup diario do banco de dados com retencao de 30 dias |
| INF-08 | CDN para frontend | P2 | Distribuir assets estaticos via CloudFlare ou similar |
| INF-09 | Auto-scaling | P3 | Escalar replicas do backend automaticamente por carga |
| INF-10 | Multi-regiao | P3 | Deploy em multiplas regioes para menor latencia global |

---

## 10. Riscos e Mitigacoes

### 10.1 Riscos Tecnicos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| **Falha na API do Fireflies** | Media | Alto | Implementar retry com backoff exponencial; manter status "error" para reprocessamento manual |
| **Limites de tokens da OpenAI** | Media | Medio | gpt-4o-mini suporta 128k tokens (suficiente para reunioes de ate ~3h); implementar truncagem inteligente para reunioes maiores |
| **Indisponibilidade do Supabase** | Baixa | Alto | Supabase oferece SLA de 99.9%; implementar cache local para dados frequentes |
| **Processamento in-process sem fila** | Alta | Alto | Risco atual: se o servidor reiniciar durante processamento, a reuniao fica em "processing" para sempre. Solucao: migrar para fila (BullMQ) |
| **Vazamento de API keys** | Baixa | Critico | RLS do Supabase protege o acesso; monitorar logs; considerar criptografia adicional no banco |

### 10.2 Riscos de Produto

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| **Modelo BYOK e barreira de entrada** | Alta | Alto | Muitos usuarios podem desistir por nao ter API keys. Mitigacao: oferecer plano gerenciado no futuro ou trial com chave da plataforma |
| **Dependencia exclusiva do Fireflies** | Alta | Alto | Se o Fireflies mudar a API ou pricing, o produto e impactado. Mitigacao: adicionar integracoes diretas com Zoom/Meet/Teams |
| **Qualidade da analise da IA** | Media | Medio | Reunioes muito curtas ou com audio ruim geram resumos fracos. Mitigacao: feedback do usuario para iterar no prompt; templates por tipo |
| **Concorrencia** | Alta | Medio | Ferramentas como Otter.ai, Fireflies e Fathom ja oferecem resumos. Diferencial: foco em equipes, integracao flexivel, prompt customizavel |

### 10.3 Riscos de Negocio

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| **Dificuldade de monetizacao** | Media | Alto | Modelo BYOK atual nao gera receita direta. Mitigacao: implementar planos pagos com features premium (analytics, equipes, integracao) |
| **Custo de API para o usuario** | Media | Medio | Usuarios podem achar caro usar sua propria chave OpenAI. Mitigacao: usar gpt-4o-mini (mais barato) e exibir custo estimado |
| **LGPD/GDPR** | Media | Alto | Transcricoes contem dados pessoais. Mitigacao: politica de privacidade clara, opcao de exclusao de dados, DPA com subprocessadores |
| **Churn por falta de engagement** | Alta | Alto | Sem notificacoes, o usuario pode esquecer de usar. Mitigacao: emails periodicos, resumo semanal, notificacoes push (PWA) |

---

## 11. Glossario

| Termo | Definicao |
|-------|-----------|
| **BYOK** | Bring Your Own Key -- modelo onde o usuario fornece suas proprias chaves de API |
| **Fireflies.ai** | Plataforma de transcricao automatica de reunioes que grava e transcreve chamadas de video/audio |
| **GraphQL** | Linguagem de consulta para APIs que permite solicitar exatamente os dados necessarios |
| **gpt-4o-mini** | Modelo de linguagem da OpenAI, versao otimizada para custo-beneficio com janela de 128k tokens |
| **PWA** | Progressive Web App -- aplicacao web que pode ser instalada no dispositivo como app nativo |
| **RLS** | Row Level Security -- recurso do PostgreSQL/Supabase que restringe acesso a dados por usuario |
| **RPC** | Remote Procedure Call -- funcao executada no servidor de banco de dados (Supabase) |
| **Service Worker** | Script que roda em background no navegador, habilitando cache offline e notificacoes push |
| **Supabase** | Plataforma open-source alternativa ao Firebase, baseada em PostgreSQL |
| **Webhook** | Mecanismo de notificacao HTTP onde um sistema envia dados automaticamente para outro quando um evento ocorre |
| **Multi-tenant** | Arquitetura onde uma unica instancia do software atende multiplos usuarios/organizacoes com isolamento de dados |
| **EasyPanel** | Plataforma de gerenciamento de servidores que simplifica o deploy de aplicacoes via Docker |
| **SaaS** | Software as a Service -- modelo de distribuicao de software via internet com cobranca recorrente |
| **NPS** | Net Promoter Score -- metrica que mede a lealdade e satisfacao do cliente |
| **FCP** | First Contentful Paint -- metrica de performance que mede o tempo ate o primeiro conteudo visivel na tela |
| **TTI** | Time to Interactive -- metrica de performance que mede o tempo ate a pagina estar totalmente interativa |
| **Embedding vetorial** | Representacao numerica de texto que captura significado semantico, usada para busca por similaridade |
| **Token** | Unidade basica de texto processada por modelos de IA (aproximadamente 0.75 palavras em portugues) |

*Documento vivo -- atualizado conforme o produto evolui. Ultima revisao: 09/03/2026.*
