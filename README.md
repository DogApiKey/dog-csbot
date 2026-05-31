# CSBot - Customer Service Bot

A multi-channel, RAG-powered customer service bot built with TypeScript, Bun, and the Pi Agent framework.

## Features

- **Multi-channel architecture**: Web widget (MVP), Telegram/Discord (planned)
- **RAG-based Q&A**: Document ingestion, chunking, embedding, hybrid search
- **Streaming responses**: Real-time SSE streaming for instant feedback
- **Admin dashboard**: Document management, conversation viewer, statistics
- **Horizontal scaling**: Stateless servers, Redis Pub/Sub, containerized deployment
- **LLM agnostic**: Supports Anthropic, OpenAI, Google, and 20+ providers via pi-ai

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Web Widget  │  │   Telegram   │  │   Discord    │
│   (MVP)      │  │   (Phase 2)  │  │   (Phase 2)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
┌──────▼─────────────────▼─────────────────▼───────┐
│              CSBot Server (Bun + Hono)            │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Channel  │  │  Agent   │  │  RAG Pipeline  │  │
│  │ Adapters │  │ Orchestr.│  │ (Qdrant +      │  │
│  │          │  │          │  │  OpenAI embed) │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
└──────────────────────┬───────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───▼───┐  ┌──────────▼──┐  ┌───────────▼──┐
│ Redis │  │ PostgreSQL  │  │   Qdrant     │
│ Pub/Sub│  │ (sessions)  │  │ (vectors)    │
└───────┘  └─────────────┘  └──────────────┘
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.1.0
- [Docker](https://docker.com) (for PostgreSQL, Redis, Qdrant)
- An LLM API key (Anthropic, OpenAI, etc.)

### 1. Clone & Install

```bash
cd csbot
bun install
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and Qdrant
docker compose -f deploy/docker-compose.yml up -d postgres redis qdrant
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env with your API keys and settings
```

### 4. Run

```bash
# Start the server
bun run dev

# In another terminal, start the admin dashboard
cd packages/admin && bun run dev

# Open the widget preview
open packages/web-widget/index.html
```

### 5. Docker (Full Stack)

```bash
# Build and run everything
docker compose -f deploy/docker-compose.yml up -d
```

## Project Structure

```
csbot/
├── packages/
│   ├── server/          # Backend API (Bun + Hono)
│   ├── web-widget/      # Embeddable chat widget (Lit Web Component)
│   └── admin/           # Admin dashboard (React + Vite)
├── deploy/
│   ├── docker-compose.yml
│   └── nginx/nginx.conf
└── .env.example
```

## API Endpoints

### Chat
- `POST /api/chat` — Send a message
- `GET /api/chat/:id/stream` — SSE stream for responses
- `GET /api/chat/:id/messages` — Message history
- `POST /api/chat/conversations` — Create conversation

### Admin
- `GET /api/admin/stats` — Dashboard statistics
- `GET /api/admin/documents` — List documents
- `POST /api/admin/documents` — Upload document
- `DELETE /api/admin/documents/:id` — Delete document
- `POST /api/admin/documents/:id/reindex` — Re-index document
- `POST /api/admin/sync/github` — Sync from GitHub repo
- `GET /api/admin/conversations` — List conversations
- `GET /api/admin/conversations/:id/messages` — Conversation messages

### Health
- `GET /health` — Liveness probe
- `GET /ready` — Readiness probe

## Widget Embedding

Add the chat widget to any website:

```html
<script src="https://your-domain/csbot-widget.js"></script>
<csbot-widget
  api-url="https://your-domain/api"
  title="Support Chat"
  greeting="Hi! How can I help you?"
></csbot-widget>
```

## Deployment

### Railway (Recommended)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
./scripts/deploy-railway.sh
```

See [deploy/railway/RAILWAY.md](deploy/railway/RAILWAY.md) for detailed instructions.

### Docker Compose (Self-hosted)

```bash
docker compose -f deploy/docker-compose.yml up -d
```

## Knowledge Base Sync

CSBot can sync documents from a GitHub repository:

1. Create a knowledge base repo (e.g., `dogapi-kb`)
2. Add Markdown documents to the repo
3. In Admin Dashboard, click "📦 Sync from GitHub"
4. Enter repo details and sync

```bash
# Or use the API directly
curl -X POST http://localhost:3000/api/admin/sync/github \
  -H "Content-Type: application/json" \
  -d '{"owner": "DogApiKey", "repo": "dogapi-kb"}'
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | `postgres://csbot:csbot@localhost:5432/csbot` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant connection |
| `LLM_PROVIDER` | `anthropic` | LLM provider |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | LLM model |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `OPENAI_API_KEY` | - | OpenAI API key (for embeddings) |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |

## License

MIT
