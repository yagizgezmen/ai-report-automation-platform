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
- OpenAI JavaScript SDK and Responses API
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

The app starts in demo mode when `DATABASE_URL` is missing or `DEMO_MODE=true`. Demo mode includes a sample report and uses in-memory persistence. To enable live AI generation, set:

```env
OPENAI_API_KEY="..."
OPENAI_MODEL="gpt-5.4-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

API keys are read only in server-side route handlers and are never exposed to the browser.

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

Reports, section edits, sources, uploaded document text/chunks, chat messages, and generation job states survive application restarts in PostgreSQL mode. The health endpoint reports the active mode as `demo` or `postgresql`.

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

# Create or refresh the demo user, report, sections, sources, and chat
npm run db:seed

# Open Prisma Studio at http://localhost:5555
npm run db:studio

# Drop local data, reapply migrations, and run the seed
npm run db:reset
```

The seed is idempotent for the fixed `demo-report` record and does not delete unrelated reports. The seeded report is assigned to `demo@arqive.ai` and appears on the dashboard whenever PostgreSQL mode is active.

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
