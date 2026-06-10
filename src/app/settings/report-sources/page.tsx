import { redirect } from "next/navigation";

export default function ReportSourcesRedirectPage() {
  redirect("/settings/report-templates");
}
