# Kuara — Marketplace de Serviços Residenciais com Custódia Segura

A **Kuara** (*sol*, em tupi) é uma PoC de marketplace desenhada com base nas pesquisas e requisitos em `docs/`, conectando contratantes que precisam de manutenção e reformas a prestadores autônomos verificados, com pagamento protegido e transparência nas etapas do serviço.

---

## 🚀 Principais Fluxos e Regras da PoC

1. **Separação entre Mão de Obra e Materiais:** Quando o orçamento inclui materiais (`PROVIDER_ADVANCE`), o valor dos insumos é repassado imediatamente após o pagamento para viabilizar a compra, enquanto apenas a **mão de obra** fica retida em custódia até a aprovação da entrega (ou prazo automático de 72h).
2. **Taxa de Serviço (5%):** Não há cobrança de moedas ou leads para enviar orçamentos. A taxa de **5%** incide apenas sobre a mão de obra e é detalhada no contexto de orçamento, checkout e carteira financeira.
3. **Moderação de Prestadores:** Documentos (RG/CNH e comprovante de residência) passam por aprovação administrativa antes de liberar o envio de propostas.
4. **Chat com Anti-Leakage:** Antes da confirmação da custódia, o chat interno bloqueia e mascara telefones, links, WhatsApp e e-mails; após o pagamento retido, o alinhamento completo é liberado.
5. **Central de Disputas & Mediação:** Identifica explicitamente quem abriu a contestação (**Contratante** ou **Contratado**), compara alegação e contraprova lado a lado e permite ao Admin decidir entre liberação integral, estorno integral, divisão parcial (`SPLIT`) ou retrabalho (`REWORK`).
6. **Paginação & Interface Sob Demanda:** Listagens operacionais do Contratante, Prestador e Admin utilizam paginação server-side e carregamento por aba ativa.

---

## 🛠️ Arquitetura e Tecnologias

- **Back-end:** Node.js (22+), Express, TypeScript, Prisma ORM, PostgreSQL, JWT, Bcryptjs, Zod, Vitest, Supertest.
- **Banco de Dados:** PostgreSQL 16 (via Docker Compose) com schema gerenciado por migrations em `backend/prisma/migrations/`.
- **Front-end:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, React Router DOM (consome a API configurada em `VITE_API_URL`, padrão `http://localhost:3001/api`).
- **Estrutura Modular:** Separação por domínio no backend (`routes`, `controllers`, `services`, `rules`, `shared`) e componentes UI + páginas por perfil no frontend.

---

## 📋 Pré-requisitos

- **Docker** e **Docker Compose** (para subir PostgreSQL e API rapidamente)
- **Node.js 22+** e **npm** (para rodar o frontend localmente e/ou executar testes e backend fora do container)

---

## ⚡ Como Rodar o Projeto (Clone Limpo / PoC)

> Os arquivos `.env` e `node_modules/` são ignorados pelo `.gitignore`. Para uso direto via Docker Compose, as variáveis do ambiente PoC já estão configuradas no `docker-compose.yml`.

### 1. Subir PostgreSQL + Backend via Docker (Migration + Seed PoC automáticos)

Ao iniciar, o container `kuara-backend` executa automaticamente `npx prisma migrate deploy`, popula os dados PoC idempotentes com `npm run seed` e sobe a API na porta `3001`:

```bash
# Na raiz do projeto
docker compose up -d --build
```

Se quiser **resetar o banco local** (limpar dados antigos/testes e recriar apenas os dados PoC iniciais):

```bash
docker compose down -v
docker compose up -d --build
```

Para validar se a API respondeu após a inicialização e acompanhar logs:

```bash
curl http://localhost:3001/api/health
docker logs -f kuara-backend
```

### 2. Iniciar o Front-end (Localmente)

Em outro terminal, na raiz do projeto:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Acesse no navegador: **`http://localhost:5173`**

*(Opcional: caso a API esteja em outro host/porta que não `http://localhost:3001/api`, crie `frontend/.env` com `VITE_API_URL=...`.)*

### Alternativa: Rodar Backend Fora do Docker (Modo Dev)

Se preferir rodar apenas o PostgreSQL no Docker e o backend direto pelo Node.js:

```bash
# 1. Suba apenas o banco
docker compose up -d postgres

# 2. Configure o .env do backend e instale dependências
cp .env.example backend/.env
npm --prefix backend install

# 3. Aplique migrations, gere o Prisma Client, execute o seed e inicie em modo dev
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate:deploy
npm --prefix backend run seed
npm --prefix backend run dev
```

---

## 🧪 Como Rodar os Testes e Build

> Em um clone novo, instale antes as dependências com `npm --prefix backend install` e `npm --prefix frontend install`.

### Testes e Build do Front-end (não dependem do banco)

```bash
npm --prefix frontend test
npm --prefix frontend run build
```

### Testes do Back-end

- **Apenas testes unitários** (regras de custódia e anti-leakage — não dependem do Postgres):
  ```bash
  npm --prefix backend run test:unit
  ```
- **Suíte completa (unitários + integração com API/Postgres):** requer o PostgreSQL ativo na porta `5432` e `backend/.env` criado (`cp .env.example backend/.env`):
  ```bash
  npm --prefix backend test
  ```

---

## 👥 Usuários Pré-Configurados (Seed PoC)

O seed inicial (`backend/prisma/seed.ts`) cria usuários para todos os perfis e 13 chamados PoC distribuídos em todos os estágios (`OPEN`, `PROPOSALS_RECEIVED`, `ESCROW_PENDING`, `IN_PROGRESS`, `COMPLETED_PENDING_APPROVAL`, `IN_DISPUTE`, `FINISHED`, `CANCELLED`):

| Papel | E-mail | Senha | Descrição |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@kuara.com.br` | `admin123` | Moderação de prestadores, métricas financeiras e disputas |
| **Prestador Verificado** | `carlos.eletricista@kuara.com.br` | `senha123` | Eletricista verificado com histórico pago e disputa aberta pelo contratado |
| **Prestador Verificado** | `ana.hidraulica@kuara.com.br` | `senha123` | Especialista em hidráulica com ordens ativas e disputa aberta pelo contratante |
| **Prestador Pendente** | `joao.pedreiro@kuara.com.br` | `senha123` | Cadastro aguardando validação documental |
| **Prestador Rejeitado** | `marcos.pintura@kuara.com.br` | `senha123` | Exemplo de cadastro rejeitado para reenvio |
| **Contratante** | `maria.cliente@kuara.com.br` | `senha123` | Contratante principal com múltiplos chamados (incluindo paginação) |
| **Contratante** | `roberto.cliente@kuara.com.br` | `senha123` | Contratante com entrega em inspeção 72h e disputa ativa |
