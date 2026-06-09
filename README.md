# AI Report Automation Platform

An enterprise-style MVP for producing long-form, evidence-grounded company reports. The application combines official web sources, uploaded source documents, manual company context, section-by-section AI generation, validation warnings, an in-editor assistant, and DOCX export.

## Features

- Dashboard with report status and progress
- Guided report creation with location, parcel, source, language, and length inputs
- Ten-section professional report template
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

Requirements: Node.js 20+, npm, and optionally PostgreSQL with pgvector.

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app starts in demo mode without credentials. It includes a sample report and produces deterministic evidence-aware placeholder drafts. To enable live AI generation, set:

```env
OPENAI_API_KEY="..."
OPENAI_MODEL="gpt-5.4-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

API keys are read only in server-side route handlers and are never exposed to the browser.

## Database setup

Create a PostgreSQL database with the pgvector extension available, set `DATABASE_URL`, then run:

```bash
npm run db:generate
npm run db:push
```

The Prisma schema defines `User`, `Report`, `ReportSection`, `Source`, `UploadedDocument`, `DocumentChunk`, `ChatMessage`, and `GenerationJob`. `DocumentChunk.embedding` is a `vector(1536)` field.

The checked-in MVP uses an in-process repository so the interface can be evaluated immediately without infrastructure. The Prisma schema is the production persistence contract; replacing `src/lib/store.ts` with Prisma queries is the intended deployment step.

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
```

Health information is available at `/api/health`.

## API routes

- `GET/POST /api/reports`
- `GET/PATCH /api/reports/:id`
- `POST /api/reports/:id/sources`
- `POST /api/reports/:id/documents`
- `POST /api/reports/:id/generate`
- `POST /api/reports/:id/chat`
- `GET /api/reports/:id/export`
