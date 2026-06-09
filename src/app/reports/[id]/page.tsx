import { ReportEditor } from "@/components/report-editor";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportEditor reportId={id} />;
}
