# jersey-bot

Bot de atendimento para loja de camisas via WhatsApp, com integração de IA e PostgreSQL.

## Requisitos

- Node.js 18+
- npm
- Banco PostgreSQL (ex.: Supabase)

## Instalação

```bash
npm install
cp .env.example .env
```

Depois, preencha o `.env` com suas credenciais reais.

## Rodando localmente

```bash
npm run dev
```

ou

```bash
npm start
```

## Endpoints

- `GET /health` -> status geral da API
- `GET /health/db` -> status de conexão com banco
- `GET /webhook` -> validação do webhook WhatsApp
- `POST /webhook` -> recebimento de mensagens

## Variáveis de ambiente

Veja todas em `.env.example`.

Principais:

- `DATABASE_URL`: string principal de conexão
- `DATABASE_URL_DIRECT`: opcional, fallback para conexão direta
- `DB_SSL`: habilita SSL (default `true`)
- `WHATSAPP_VERIFY_TOKEN`: token de validação do webhook
- `GROQ_API_KEY`: chave do provedor de IA

## Segurança

- Nunca commitar `.env`
- Rotacione imediatamente qualquer credencial já exposta
- Use secrets no provedor de deploy (Vercel/Render/Railway/etc.) em vez de arquivo `.env` em produção
