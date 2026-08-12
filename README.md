# AI Report Automation Platform

An enterprise-style MVP for producing long-form, evidence-grounded company reports. The application combines official web sources, uploaded source documents, manual company context, section-by-section AI generation, validation warnings, an in-editor assistant, and DOCX export.

## Features

- Dashboard with report status and progress
- Guided report creation with report type, project, location, language, length, and AI settings
- Report-template management with sections, sources, and general settings
- Per-report AI web research permission with a provider-ready service abstraction
- Template-driven report section creation with stored sort order
- URL content collection with readable-text extraction
- PDF, DOCX, and TXT upload with text extraction and chunking
- PostgreSQL/Prisma data model with a `pgvector` embedding column
- OpenAI Responses API generation with source-only prompting and citations
- No-key demo generation mode for local product evaluation
- Three-panel editor with section navigation, editable content, AI assistant, evidence, and warnings
- Confidence levels, unsupported-claim alerts, and missing-data review items
- DOCX export with cover, table-of-contents placeholder, report sections, review notes, and source register

## Stack

- Next.js 15, React 19, TypeScript
- Tailwind CSS 4
- Next.js Route Handlers
- PostgreSQL, Prisma, pgvector
- Provider-neutral AI runtime with Gemini, OpenAI, and Ollama adapters
- Google GenAI SDK for Gemini development connectivity
- OpenAI JavaScript SDK for future OpenAI-compatible providers
- `pdf-parse`, `mammoth`, `cheerio`, and `docx`
- Vitest

## Local setup

Requirements: Node.js 20+ and npm. PostgreSQL with pgvector is required for persistent mode.

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app starts in demo mode only when `DATABASE_URL` is missing or `DEMO_MODE=true`. If `DATABASE_URL` is present and `DEMO_MODE` is not `"true"`, the application uses PostgreSQL persistence and does not fall back to the in-memory store.

```env
AI_PROVIDER="gemini"
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-3.5-flash"

OPENAI_API_KEY="..."
OPENAI_BASE_URL=""
OPENAI_MODEL="gpt-5.4-mini"

OLLAMA_BASE_URL="http://localhost:11434/v1"
OLLAMA_MODEL="llama3.1"

OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

`AI_PROVIDER=gemini` is the default development path. The retired GitHub Models endpoint must not be used. API keys are read only in server-side code and are never exposed to the browser.

## Authentication

The project now includes a first-step application authentication layer.

Set these environment variables to enable it:

```env
AUTH_USERNAME="admin"
AUTH_PASSWORD="change-me"
AUTH_SECRET="replace-with-a-long-random-secret"
```

When `AUTH_SECRET` is configured and either an existing `.data/workspace-profile.json`
file is present or `AUTH_PASSWORD` is supplied for first bootstrap, the middleware
protects all pages and API routes except `/login`, `/api/auth/login`,
`/api/auth/logout`, and `/api/health`. This is an application-level session gate,
not yet full user-level authorization.

On first start, the app creates a local workspace profile file at
`.data/workspace-profile.json` using the bootstrap username/password from the
environment. There is no fallback default password anymore. After that, name,
contact details, username, and password can be managed from `/settings/profile`.

## Database setup

The application has two persistence modes:

- `DEMO_MODE=true` or no `DATABASE_URL`: in-memory demo repository.
- `DEMO_MODE=false` with `DATABASE_URL`: Prisma and PostgreSQL persistence.

### Docker PostgreSQL (recommended)

Requirements: Docker Desktop or another Docker Engine with Compose v2.

The checked-in `docker-compose.yml` uses the official, version-pinned `pgvector/pgvector:0.8.2-pg17` image. It exposes PostgreSQL on port `5432`, includes a healthcheck, and persists data in the `ai-report-postgres-data` volume.

Copy the environment file and set database mode:

```bash
cp .env.example .env
```

```env
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="report_automation"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/report_automation"
DEMO_MODE="false"
```

Start PostgreSQL:

```bash
docker compose up -d
docker compose ps
```

Apply migrations and seed the dashboard:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

For local prototypes where migration files are not required, synchronize the
current Prisma schema directly:

```bash
npm run db:push
```

Verify the database and pgvector extension:

```bash
docker compose exec postgres pg_isready -U postgres -d report_automation
docker compose exec postgres psql -U postgres -d report_automation -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```

Stop the database without deleting data:

```bash
docker compose down
```

Delete the container and persistent database volume:

```bash
docker compose down -v
```

Port `5432` must be available. If a Homebrew PostgreSQL service is already running on macOS, stop it before starting Docker:

```bash
brew services stop postgresql@17
```

### Manual PostgreSQL

Alternatively, create a PostgreSQL database with the pgvector extension available:

```sql
CREATE DATABASE report_automation;
\c report_automation
CREATE EXTENSION IF NOT EXISTS vector;
```

Configure `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/report_automation"
DEMO_MODE="false"
```

Generate the Prisma client and apply migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

For non-interactive production deployments, use:

```bash
npx prisma migrate deploy
```

The Prisma repository persists `User`, `Report`, `ReportType`, `ReportTypeSection`, `ReportTypeSource`, `ReportSection`, `Source`, `SectionSource`, `UploadedDocument`, `DocumentChunk`, `ChatMessage`, and `GenerationJob`. `DocumentChunk.embedding` is a nullable `vector(1536)` field ready for OpenAI embeddings.

Reports, section edits, sources, uploaded document text/chunks, chat messages, and generation job states survive application restarts in PostgreSQL mode. The public health endpoint intentionally returns only a minimal status payload plus the active persistence mode.

### Persistence architecture

Database access is isolated under `src/lib/repositories`:

- `reportRepository.ts` handles report aggregate reads and report creation/saves.
- `sectionRepository.ts` maps and updates report sections and source links.
- `sourceRepository.ts` persists collected web sources.
- `documentRepository.ts` persists uploaded documents and chunks.
- `chatRepository.ts` persists report assistant messages.
- `generationJobRepository.ts` tracks generation job lifecycle.
- `reportTypeRepository.ts` manages report templates, sections, and default sources.

`src/lib/store.ts` is the application-facing abstraction. It delegates to these repositories in PostgreSQL mode and dynamically loads `src/lib/demo-store.ts` only in demo mode. API routes do not import Prisma directly.

### Report template workflow

Open `/settings/report-templates` to manage report types, section order/content,
and default sources in one place. Each report type includes:

- General settings: name and description
- Sections: add, edit, delete, and drag-to-reorder
- Sources: add, edit, delete default trusted URLs with names/descriptions

The legacy `/settings/report-sources` route now redirects to the template page.

When a user creates a report, the application:

- loads sections from `ReportTypeSection`
- loads default URLs from `ReportTypeSource`
- creates the report structure automatically from the selected template

The new-report form does not require URLs and no longer includes a manual
company-context textarea. Instead, it exposes an **AI Settings** section with an
`Allow AI to use web research` switch. The value is stored as
`Report.allowWebResearch`. When disabled, generation is restricted to
configured sources, uploaded documents, and user notes. When enabled,
`src/lib/services/webResearchService.ts` is invoked and may add trusted,
AI-discovered web sources to the report.

AI prompts enforce `Report.outputLanguage` for section generation and chatbot
editing. Turkish reports use formal Turkish, while English reports use formal
business English.

### Database commands

```bash
# Generate the Prisma client
npm run db:generate

# Synchronize the Prisma schema without creating a migration
npm run db:push

# Apply pending development migrations
npm run db:migrate

# Create demo data only when the database is empty
npm run db:seed

# Open Prisma Studio at http://localhost:5555
npm run db:studio

# WARNING: destructive. Drops local data, reapplies migrations, and runs the seed
npm run db:reset
```

The seed is non-destructive. It creates default report types only when none exist, and creates the demo report only when there are no existing reports. It does not delete user reports, templates, documents, or sources.

## Evidence behavior

Generation prompts instruct the model to:

- use only report inputs, fetched sources, and uploaded documents;
- cite web sources as `[S1]`, `[S2]`, and documents as `[D:filename]`;
- avoid presenting unsupported statements as facts;
- append `[Needs manual review]` where support is incomplete;
- return confidence, source IDs, unsupported claims, and missing-data warnings.

Model output must still be reviewed by a qualified user before publication. URL collection is limited to user-supplied pages and may fail on sites that block automated retrieval or require JavaScript/authentication.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
npm run db:reset
```

Health information is available at `/api/health`.

## API routes

- `GET/POST /api/reports`
- `GET/POST /api/report-types`
- `GET/PATCH/DELETE /api/report-types/:id`
- `GET/PATCH /api/reports/:id`
- `POST /api/reports/:id/sources`
- `POST /api/reports/:id/documents`
- `POST /api/reports/:id/generate`
- `POST /api/reports/:id/chat`
- `GET /api/reports/:id/export`
