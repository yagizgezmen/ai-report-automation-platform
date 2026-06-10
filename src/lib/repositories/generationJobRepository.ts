import { JobStatus } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";

export async function createRunningGenerationJob(reportId: string, sectionId: string) {
  return getPrismaClient().generationJob.create({
    data: {
      reportId,
      sectionId,
      status: JobStatus.RUNNING,
      startedAt: new Date(),
    },
  });
}

export async function finishGenerationJob(jobId: string, error?: string) {
  return getPrismaClient().generationJob.update({
    where: { id: jobId },
    data: {
      status: error ? JobStatus.FAILED : JobStatus.COMPLETED,
      error: error || null,
      endedAt: new Date(),
    },
  });
}
