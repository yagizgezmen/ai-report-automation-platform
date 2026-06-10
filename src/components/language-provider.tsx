"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UiLanguage = "tr" | "en";

const translations = {
  tr: {
    dashboard: "Ana Sayfa",
    reportIntelligence: "Rapor Zekâsı",
    reports: "Raporlar",
    knowledgeBase: "Bilgi Bankası",
    seniorConsultant: "Kıdemli Danışman",
    workspaceSettings: "Çalışma alanı ayarları",
    notifications: "Bildirimler",
    aiOperational: "Yapay zekâ servisleri çalışıyor",
    reportWorkspace: "Rapor çalışma alanı",
    greeting: "Günaydın, Ayşe",
    dashboardDescription: "Ekibinizin bilgisiyle güvenilir ve kaynaklara dayalı raporlar hazırlayın.",
    newReport: "Yeni rapor",
    allReports: "Tüm raporlar",
    inProgress: "Devam ediyor",
    needsReview: "İnceleme gerekli",
    completed: "Tamamlandı",
    recentReports: "Son raporlar",
    recentReportsDescription: "Düzenlemeye devam edin veya oluşturulan içeriği inceleyin.",
    searchReports: "Raporlarda ara...",
    loadingReports: "Raporlar yükleniyor...",
    progress: "İlerleme",
    noReports: "Henüz rapor yok. Başlamak için ilk raporunuzu oluşturun.",
    backToDashboard: "Ana sayfaya dön",
    newReportEyebrow: "Yeni rapor",
    newReportTitle: "Rapor çalışma alanınızı oluşturun",
    newReportDescription: "Proje bilgilerini girin. Kaynakları ve belgeleri daha sonra da ekleyebilirsiniz.",
    reportDetails: "Rapor bilgileri",
    reportType: "Rapor türü",
    projectName: "Proje adı",
    projectPlaceholder: "örn. Kuzey Bölgesi Gelişim Projesi",
    locationParcel: "Konum ve parsel",
    city: "İl",
    district: "İlçe",
    neighborhood: "Mahalle",
    parcelInfo: "Ada / parsel bilgileri",
    parcelPlaceholder: "Ada 123, Parsel 45",
    sourcesContext: "Kaynaklar ve bağlam",
    companyNotes: "Ek şirket notları",
    companyNotesPlaceholder: "Projeye özel bağlamı, şirket metodolojisini, tercih edilen terminolojiyi veya bilinen kısıtları ekleyin...",
    outputPreferences: "Çıktı tercihleri",
    outputLanguage: "Rapor çıktı dili",
    desiredLength: "Hedef rapor uzunluğu",
    pagesApprox: "Yaklaşık {count} sayfa",
    createReport: "Rapor oluştur",
    creatingWorkspace: "Çalışma alanı oluşturuluyor...",
    whatNext: "Sonraki adımlar",
    nextTemplate: "10 bölümlü profesyonel rapor şablonu oluşturulur.",
    nextConfiguredSources: "Rapor türü için tanımlı kaynaklar otomatik olarak alınır.",
    nextFiles: "PDF, DOCX veya TXT kaynak dosyaları yükleyebilirsiniz.",
    nextGenerate: "Her bölüm kaynaklarla oluşturulur ve incelemeye sunulur.",
    manualReviewNote: "Yeterli kanıtı olmayan yapay zekâ iddiaları otomatik olarak manuel incelemeye işaretlenir.",
    planningReport: "Planlama ve Geliştirme Raporu",
    feasibilityReport: "Fizibilite Raporu",
    dueDiligenceReport: "Durum Tespit Raporu",
    marketAssessment: "Pazar Değerlendirmesi",
    turkish: "Türkçe",
    english: "İngilizce",
    german: "Almanca",
    save: "Kaydet",
    saving: "Kaydediliyor...",
    allChangesLocal: "Tüm değişiklikler yerel",
    exportDocx: "DOCX dışa aktar",
    reportProgress: "RAPOR İLERLEMESİ",
    sectionsStarted: "{completed} / {total} bölüm başlatıldı",
    reportSections: "Rapor bölümleri",
    section: "Bölüm",
    confidence: "güven",
    contentEditor: "İçerik düzenleyici",
    words: "kelime",
    regenerateSection: "Bölümü yeniden oluştur",
    generateSection: "Bölümü oluştur",
    editorPlaceholder: "Bu bölümü yapay zekâ ile oluşturun veya yazmaya başlayın...",
    evidenceChecks: "Kanıt kontrolleri etkin",
    markApproved: "Onaylandı olarak işaretle",
    assistant: "Asistan",
    sources: "Kaynaklar",
    review: "İnceleme",
    quickActions: "Hızlı işlemler",
    formal: "Daha resmî yaz",
    expandEvidence: "Kanıtlarla genişlet",
    findMissing: "Eksik bilgileri bul",
    showUnsupported: "Desteksiz iddiaları göster",
    convertTable: "Tabloya dönüştür",
    officialOnly: "Yalnızca resmî kaynakları kullan",
    assistantReady: "Bu bölümde yardımcı olmaya hazırım. Rapor bağlamını kullanacak ve desteksiz iddiaları görünür tutacağım.",
    applyRevision: "Düzenlemeyi uygula",
    reviewingContext: "Bağlam inceleniyor...",
    askSection: "Bu bölüm hakkında sorun...",
    evidenceLibrary: "Kanıt kütüphanesi",
    evidenceDescription: "Yapay zekâ üretiminde kullanılabilecek internet kaynakları ve yüklenen dosyalar.",
    uploadFiles: "PDF, DOCX veya TXT yükle",
    extractingText: "Metin çıkarılıyor...",
    officialWebSource: "Resmî internet kaynağı",
    webSource: "İnternet kaynağı",
    indexedChunks: "{count} indekslenmiş parça",
    noEvidence: "Henüz kanıt eklenmedi.",
    unsupportedClaims: "Desteksiz iddialar",
    missingInformation: "Eksik bilgiler",
    usedSources: "Kullanılan kaynaklar",
    noWarnings: "Bu bölüm için etkin doğrulama uyarısı yok.",
    loadingWorkspace: "Rapor çalışma alanı yükleniyor...",
    draft: "Taslak",
    notStarted: "Başlanmadı",
    generated: "Oluşturuldu",
    approved: "Onaylandı",
    high: "Yüksek",
    medium: "Orta",
    low: "Düşük",
    allowWebResearch: "AI internet araştırması yapabilsin",
    allowWebResearchHelp: "Kapalıysa AI yalnızca tanımlı kaynakları, yüklenen dokümanları ve kullanıcı notlarını kullanır.",
    settings: "Ayarlar",
    sourceSettings: "Rapor kaynakları",
    reportSourcesTitle: "Rapor türü kaynakları",
    reportSourcesDescription: "Her rapor türü için otomatik olarak kullanılacak varsayılan internet kaynaklarını yönetin.",
    defaultSources: "Varsayılan kaynak adresleri",
    defaultSourcesHelp: "Yeni rapor oluşturulduğunda bu adresler otomatik olarak alınır ve rapora bağlanır.",
    addSourceUrl: "Kaynak ekle",
    loadingSources: "Kaynaklar yükleniyor...",
    deleteSource: "Kaynağı sil",
    noDefaultSources: "Bu rapor türü için henüz varsayılan kaynak tanımlanmadı.",
    saveSources: "Kaynakları kaydet",
    reportSourcesSaved: "Kaynaklar kaydedildi.",
    reportSourcesSaveError: "Kaynaklar kaydedilemedi.",
    webResearchEnabled: "AI internet araştırması açık",
    webResearchDisabled: "AI internet araştırması kapalı",
  },
  en: {
    dashboard: "Dashboard", reportIntelligence: "Report Intelligence", reports: "Reports", knowledgeBase: "Knowledge Base",
    seniorConsultant: "Senior Consultant", workspaceSettings: "Workspace settings",
    notifications: "Notifications", aiOperational: "AI services operational",
    reportWorkspace: "Report workspace", greeting: "Good morning, Ayşe",
    dashboardDescription: "Build reliable, source-grounded reports with your team’s knowledge.",
    newReport: "New report", allReports: "All reports", inProgress: "In progress",
    needsReview: "Needs review", completed: "Completed", recentReports: "Recent reports",
    recentReportsDescription: "Continue editing or review generated content.", searchReports: "Search reports...",
    loadingReports: "Loading reports...", progress: "Progress",
    noReports: "No reports yet. Create the first one to get started.", backToDashboard: "Back to dashboard",
    newReportEyebrow: "New report", newReportTitle: "Set up your report workspace",
    newReportDescription: "Provide the project context. Sources and documents can also be added later.",
    reportDetails: "Report details", reportType: "Report type", projectName: "Project name",
    projectPlaceholder: "e.g. North District Development", locationParcel: "Location and parcel",
    city: "City", district: "District", neighborhood: "Neighborhood",
    parcelInfo: "Parcel / block information", parcelPlaceholder: "Block 123, Parcel 45",
    sourcesContext: "Sources and context",
    companyNotes: "Additional company notes",
    companyNotesPlaceholder: "Add project-specific context, company methodology, preferred terminology, or known constraints...",
    outputPreferences: "Output preferences", outputLanguage: "Report output language",
    desiredLength: "Desired report length", pagesApprox: "Approximately {count} pages",
    createReport: "Create report", creatingWorkspace: "Creating workspace...", whatNext: "What happens next?",
    nextTemplate: "A 10-section professional template is created.", nextConfiguredSources: "Configured report-type sources are fetched automatically.",
    nextFiles: "Upload PDF, DOCX, or TXT source files.", nextGenerate: "Generate and review each section with citations.",
    manualReviewNote: "AI-generated claims without adequate evidence are automatically marked for manual review.",
    planningReport: "Planning & Development Report", feasibilityReport: "Feasibility Report",
    dueDiligenceReport: "Due Diligence Report", marketAssessment: "Market Assessment",
    turkish: "Turkish", english: "English", german: "German", save: "Save", saving: "Saving...",
    allChangesLocal: "All changes local", exportDocx: "Export DOCX", reportProgress: "REPORT PROGRESS",
    sectionsStarted: "{completed} of {total} sections started", reportSections: "Report sections",
    section: "Section", confidence: "confidence", contentEditor: "Content editor", words: "words",
    regenerateSection: "Regenerate section", generateSection: "Generate section",
    editorPlaceholder: "Generate this section with AI or begin writing here...",
    evidenceChecks: "Evidence checks enabled", markApproved: "Mark approved",
    assistant: "Assistant", sources: "Sources", review: "Review", quickActions: "Quick actions",
    formal: "Make more formal", expandEvidence: "Expand with evidence", findMissing: "Find missing information",
    showUnsupported: "Show unsupported claims", convertTable: "Convert into a table",
    officialOnly: "Use only official sources",
    assistantReady: "I’m ready to help with this section. I’ll use the report context and keep unsupported claims visible.",
    applyRevision: "Apply revision", reviewingContext: "Reviewing context...", askSection: "Ask about this section...",
    evidenceLibrary: "Evidence library", evidenceDescription: "Web sources and uploaded files available to AI generation.",
    uploadFiles: "Upload PDF, DOCX, or TXT", extractingText: "Extracting text...",
    officialWebSource: "Official web source", webSource: "Web source",
    indexedChunks: "{count} indexed chunks", noEvidence: "No evidence added yet.",
    unsupportedClaims: "Unsupported claims", missingInformation: "Missing information",
    usedSources: "Used sources", noWarnings: "No active validation warnings for this section.",
    loadingWorkspace: "Loading report workspace...", draft: "Draft", notStarted: "Not started",
    generated: "Generated", approved: "Approved", high: "High", medium: "Medium", low: "Low",
    allowWebResearch: "Allow AI to use web research",
    allowWebResearchHelp: "When disabled, AI only uses configured sources, uploaded documents, and user notes.",
    settings: "Settings", sourceSettings: "Report sources",
    reportSourcesTitle: "Report type sources",
    reportSourcesDescription: "Manage the default web sources automatically used for each report type.",
    defaultSources: "Default source URLs",
    defaultSourcesHelp: "These URLs are fetched and attached automatically when a new report is created.",
    addSourceUrl: "Add source", loadingSources: "Loading sources...",
    deleteSource: "Delete source", noDefaultSources: "No default sources are configured for this report type.",
    saveSources: "Save sources", reportSourcesSaved: "Sources saved.",
    reportSourcesSaveError: "Could not save sources.",
    webResearchEnabled: "AI web research enabled",
    webResearchDisabled: "AI web research disabled",
  },
} as const;

type TranslationKey = keyof typeof translations.tr;

type LanguageContextValue = {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>("tr");

  useEffect(() => {
    const saved = window.localStorage.getItem("ui-language");
    if (saved === "tr" || saved === "en") setLanguageState(saved);
  }, []);

  function setLanguage(next: UiLanguage) {
    setLanguageState(next);
    window.localStorage.setItem("ui-language", next);
    document.documentElement.lang = next;
  }

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, variables) => {
      let text: string = translations[language][key];
      for (const [name, value] of Object.entries(variables || {})) {
        text = text.replace(`{${name}}`, String(value));
      }
      return text;
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider.");
  return context;
}

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  return (
    <label className="relative">
      <span className="sr-only">Arayüz dili</span>
      <select
        aria-label="Arayüz dili"
        value={language}
        onChange={(event) => setLanguage(event.target.value as UiLanguage)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 outline-none"
      >
        <option value="tr">{compact ? "TR" : "Türkçe"}</option>
        <option value="en">{compact ? "EN" : "English"}</option>
      </select>
    </label>
  );
}
