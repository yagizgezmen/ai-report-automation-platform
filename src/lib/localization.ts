import { UiLanguage } from "@/components/language-provider";
import { Confidence, ReportStatus, ReviewStatus } from "@/lib/types";

const sectionTranslations: Record<string, { tr: [string, string]; en: [string, string] }> = {
  "Executive Summary": {
    tr: ["Yönetici Özeti", "Projenin, temel bulguların ve önerilerin kısa özeti."],
    en: ["Executive Summary", "A concise overview of the project, key findings, and recommendation."],
  },
  "Project Information": {
    tr: ["Proje Bilgileri", "Temel proje bilgileri, kapsam, mülkiyet bağlamı ve parsel detayları."],
    en: ["Project Information", "Core project facts, scope, ownership context, and parcel details."],
  },
  "Planning Area Location": {
    tr: ["Planlama Alanının Konumu", "Saha konumu, yakın çevre, erişim ve mekânsal bağlam."],
    en: ["Planning Area Location", "The site location, immediate surroundings, access, and spatial context."],
  },
  "Regional Context": {
    tr: ["Bölgesel Bağlam", "Bölgesel gelişim eğilimleri, altyapı, demografi ve pazar bağlamı."],
    en: ["Regional Context", "Regional development patterns, infrastructure, demographics, and market context."],
  },
  "Legal / Administrative Background": {
    tr: ["Hukuki / İdari Arka Plan", "Geçerli planlar, kararlar, izinler ve idari çerçeve."],
    en: ["Legal / Administrative Background", "Applicable plans, decisions, permits, and administrative framework."],
  },
  "Data Collected from Sources": {
    tr: ["Kaynaklardan Toplanan Veriler", "Resmî kaynaklardan ve belgelerden alınan bilgilerin yapılandırılmış özeti."],
    en: ["Data Collected from Sources", "Structured synthesis of facts retrieved from official sources and documents."],
  },
  Analysis: {
    tr: ["Analiz", "Toplanan planlama ve proje bilgilerinin kanıta dayalı yorumu."],
    en: ["Analysis", "Evidence-based interpretation of the collected planning and project information."],
  },
  "Company Assessment": {
    tr: ["Şirket Değerlendirmesi", "Şirketin tercih ettiği üslupla yazılmış profesyonel değerlendirme."],
    en: ["Company Assessment", "Professional assessment written in the company’s preferred style."],
  },
  Conclusion: {
    tr: ["Sonuç", "Bulguların, kısıtların, fırsatların ve önerilen sonraki adımların özeti."],
    en: ["Conclusion", "Summary of findings, constraints, opportunities, and recommended next steps."],
  },
  References: {
    tr: ["Kaynakça", "Raporda kullanılan resmî internet siteleri ve yüklenen belgelerin tam listesi."],
    en: ["References", "Complete list of official websites and uploaded documents cited in the report."],
  },
};

export function localizeSection(title: string, description: string, language: UiLanguage) {
  const translated = sectionTranslations[title]?.[language];
  return translated ? { title: translated[0], description: translated[1] } : { title, description };
}

export function localizeReportStatus(status: ReportStatus, language: UiLanguage) {
  const labels: Record<UiLanguage, Record<ReportStatus, string>> = {
    tr: { Draft: "Taslak", "In Progress": "Devam ediyor", "Needs Review": "İnceleme gerekli", Completed: "Tamamlandı" },
    en: { Draft: "Draft", "In Progress": "In Progress", "Needs Review": "Needs Review", Completed: "Completed" },
  };
  return labels[language][status];
}

export function localizeReviewStatus(status: ReviewStatus, language: UiLanguage) {
  const labels: Record<UiLanguage, Record<ReviewStatus, string>> = {
    tr: { "Not started": "Başlanmadı", Generated: "Oluşturuldu", "Needs review": "İnceleme gerekli", Approved: "Onaylandı" },
    en: { "Not started": "Not started", Generated: "Generated", "Needs review": "Needs review", Approved: "Approved" },
  };
  return labels[language][status];
}

export function localizeConfidence(confidence: Confidence, language: UiLanguage) {
  const labels: Record<UiLanguage, Record<Confidence, string>> = {
    tr: { High: "Yüksek", Medium: "Orta", Low: "Düşük" },
    en: { High: "High", Medium: "Medium", Low: "Low" },
  };
  return labels[language][confidence];
}

export function localizeReportType(reportType: string, language: UiLanguage) {
  const labels: Record<string, Record<UiLanguage, string>> = {
    "Legacy report / No template assigned": { tr: "Eski rapor / Şablon atanmamış", en: "Legacy report / No template assigned" },
    "Template-linked report": { tr: "Şablon bağlantılı rapor", en: "Template-linked report" },
    "Planning & Development Report": { tr: "Planlama ve Geliştirme Raporu", en: "Planning & Development Report" },
    "Feasibility Report": { tr: "Fizibilite Raporu", en: "Feasibility Report" },
    "Due Diligence Report": { tr: "Durum Tespit Raporu", en: "Due Diligence Report" },
    "Market Assessment": { tr: "Pazar Değerlendirmesi", en: "Market Assessment" },
  };
  return labels[reportType]?.[language] || reportType;
}
