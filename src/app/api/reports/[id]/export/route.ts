import { NextResponse } from "next/server";
import { exportDocx } from "@/lib/export-service";
import { getReport } from "@/lib/store";
import { requireSessionUsername } from "@/lib/session";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const username = await requireSessionUsername();
  const { id } = await context.params;
  const report = await getReport(id, username);
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const file = await exportDocx(report);
  const name = report.projectName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name || "report"}.docx"`,
    },
  });
}
