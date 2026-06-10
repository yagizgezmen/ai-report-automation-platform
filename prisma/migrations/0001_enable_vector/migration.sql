CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED');
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_STARTED', 'GENERATED', 'NEEDS_REVIEW', 'APPROVED');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "reportType" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "neighborhood" TEXT,
    "parcelInfo" TEXT,
    "manualNotes" TEXT,
    "outputLanguage" TEXT NOT NULL DEFAULT 'English',
    "desiredLength" INTEGER NOT NULL DEFAULT 65,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportSection" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredInputs" JSONB NOT NULL,
    "sourceRequired" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL DEFAULT '',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "confidence" TEXT NOT NULL DEFAULT 'Low',
    "unsupportedClaims" JSONB NOT NULL,
    "missingWarnings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SectionSource" (
    "sectionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    CONSTRAINT "SectionSource_pkey" PRIMARY KEY ("sectionId","sourceId")
);

CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "extractedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sectionId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sectionId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "ReportSection_reportId_position_key" ON "ReportSection"("reportId", "position");
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
CREATE INDEX "ChatMessage_reportId_sectionId_idx" ON "ChatMessage"("reportId", "sectionId");
CREATE INDEX "GenerationJob_reportId_sectionId_idx" ON "GenerationJob"("reportId", "sectionId");

ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportSection" ADD CONSTRAINT "ReportSection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Source" ADD CONSTRAINT "Source_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionSource" ADD CONSTRAINT "SectionSource_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionSource" ADD CONSTRAINT "SectionSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ReportSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ReportSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
