CREATE INDEX "Report_userId_idx" ON "Report"("userId");
CREATE INDEX "Report_status_updatedAt_idx" ON "Report"("status", "updatedAt");
CREATE INDEX "Source_reportId_idx" ON "Source"("reportId");
CREATE INDEX "UploadedDocument_reportId_idx" ON "UploadedDocument"("reportId");
