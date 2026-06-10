ALTER TABLE "Report"
ADD COLUMN "allowWebResearch" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReportTypeSource" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportTypeSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportTypeSource_reportType_url_key"
ON "ReportTypeSource"("reportType", "url");

CREATE INDEX "ReportTypeSource_reportType_idx"
ON "ReportTypeSource"("reportType");
