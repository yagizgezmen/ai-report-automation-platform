ALTER TABLE "Report" ADD COLUMN "reportTypeId" TEXT;

CREATE TABLE "ReportType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportTypeSection" (
    "id" TEXT NOT NULL,
    "reportTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTypeSection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReportTypeSource"
    ADD COLUMN "reportTypeId" TEXT,
    ADD COLUMN "name" TEXT,
    ADD COLUMN "description" TEXT;

INSERT INTO "ReportType" ("id", "name", "createdAt", "updatedAt")
SELECT md5(name), name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "reportType" AS name FROM "Report"
    UNION
    SELECT DISTINCT "reportType" AS name FROM "ReportTypeSource"
) AS names
WHERE name IS NOT NULL AND name <> '';

UPDATE "Report"
SET "reportTypeId" = "ReportType"."id"
FROM "ReportType"
WHERE "ReportType"."name" = "Report"."reportType";

UPDATE "ReportTypeSource"
SET
    "reportTypeId" = "ReportType"."id",
    "name" = regexp_replace(regexp_replace(replace(replace("ReportTypeSource"."url", 'https://', ''), 'http://', ''), '/$', ''), '^www\.', ''),
    "description" = COALESCE("ReportTypeSource"."description", '')
FROM "ReportType"
WHERE "ReportType"."name" = "ReportTypeSource"."reportType";

ALTER TABLE "ReportTypeSource"
    ALTER COLUMN "reportTypeId" SET NOT NULL,
    ALTER COLUMN "name" SET NOT NULL;

DROP INDEX IF EXISTS "ReportTypeSource_reportType_url_key";
DROP INDEX IF EXISTS "ReportTypeSource_reportType_idx";

ALTER TABLE "ReportTypeSource" DROP COLUMN "reportType";

ALTER TABLE "Report"
    ADD CONSTRAINT "Report_reportTypeId_fkey"
    FOREIGN KEY ("reportTypeId") REFERENCES "ReportType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReportTypeSection"
    ADD CONSTRAINT "ReportTypeSection_reportTypeId_fkey"
    FOREIGN KEY ("reportTypeId") REFERENCES "ReportType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportTypeSource"
    ADD CONSTRAINT "ReportTypeSource_reportTypeId_fkey"
    FOREIGN KEY ("reportTypeId") REFERENCES "ReportType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ReportType_name_key" ON "ReportType"("name");
CREATE UNIQUE INDEX "ReportTypeSection_reportTypeId_sortOrder_key" ON "ReportTypeSection"("reportTypeId", "sortOrder");
CREATE INDEX "ReportTypeSection_reportTypeId_sortOrder_idx" ON "ReportTypeSection"("reportTypeId", "sortOrder");
CREATE UNIQUE INDEX "ReportTypeSource_reportTypeId_url_key" ON "ReportTypeSource"("reportTypeId", "url");
CREATE INDEX "ReportTypeSource_reportTypeId_idx" ON "ReportTypeSource"("reportTypeId");
CREATE INDEX "Report_reportTypeId_idx" ON "Report"("reportTypeId");
