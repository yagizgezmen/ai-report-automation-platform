import { PrismaClient } from "@prisma/client";
import { DEFAULT_REPORT_TEMPLATES } from "../src/lib/report-types";
import { createTemplateSections } from "../src/lib/templates";

const prisma = new PrismaClient();

const DEMO_USER_ID = "demo-user";
const DEMO_REPORT_ID = "demo-report";
const DEMO_SOURCE_IDS = ["demo-source-municipality", "demo-source-ministry"];

async function main() {
  await prisma.$transaction(async (tx) => {
    const existingReportTypeCount = await tx.reportType.count();
    const existingReportCount = await tx.report.count();

    const createdTypes = [];
    if (existingReportTypeCount === 0) {
      for (const item of DEFAULT_REPORT_TEMPLATES) {
        createdTypes.push(await tx.reportType.create({
          data: {
            name: item.name,
            description: item.description,
            sections: {
              create: item.sections.map((section, index) => ({
                title: section.title,
                description: section.description,
                sortOrder: index,
                requiredInputs: [],
                sourceRequired: false,
                aiPrompt: "",
                isRequired: true,
                isEnabled: true,
              })),
            },
            sources: {
              create: item.sources.map((source) => ({
                name: source.name,
                url: source.url,
                description: source.description,
                priority: "MEDIUM",
              })),
            },
          },
        }));
      }
    }

    if (existingReportCount > 0) {
      console.log("Seed skipped demo data creation because existing reports were found.");
      return;
    }

    const template = DEFAULT_REPORT_TEMPLATES[0];
    const primaryReportType = createdTypes[0]
      || await tx.reportType.findFirst({ orderBy: { createdAt: "asc" } });

    if (!primaryReportType) {
      console.log("Seed skipped demo data creation because no report types were available.");
      return;
    }

    const sections = createTemplateSections(template.sections.map((section, index) => ({
      id: `seed-section-${index + 1}`,
      title: section.title,
      description: section.description,
      sortOrder: index,
    })));

    const demoUser = await tx.user.upsert({
      where: { email: "demo@arqive.ai" },
      update: { name: "Ayşe Yılmaz" },
      create: {
        id: DEMO_USER_ID,
        email: "demo@arqive.ai",
        name: "Ayşe Yılmaz",
      },
    });

    const existingDemoReport = await tx.report.findUnique({ where: { id: DEMO_REPORT_ID } });
    if (existingDemoReport) {
      console.log("Seed skipped demo report creation because demo-report already exists.");
      return;
    }

    await tx.report.create({
      data: {
        id: DEMO_REPORT_ID,
        userId: demoUser.id,
        reportTypeId: primaryReportType.id,
        reportType: primaryReportType.name,
        projectName: "Kadıköy Coastal Planning Assessment",
        city: "İstanbul",
        district: "Kadıköy",
        neighborhood: "Fenerbahçe",
        parcelInfo: "Ada 348, Parseller 12-15",
        manualNotes: "Plan uyumluluğu, ulaşım erişimi ve kamusal alan etkisine odaklanın.",
        outputLanguage: "Turkish",
        desiredLength: 65,
        status: "NEEDS_REVIEW",
        sections: {
          create: sections.map((section, position) => ({
            id: `demo-section-${position + 1}`,
            position,
            title: section.title,
            description: section.description,
            requiredInputs: section.requiredInputs,
            sourceRequired: section.sourceRequired,
            content: position === 0
              ? "Bu rapor, Kadıköy Fenerbahçe'deki proje alanının planlama bağlamını ve gelişim koşullarını değerlendirmektedir [S1]. Mevcut resmî kaynaklar ön değerlendirme için temel sağlamakla birlikte, parsel bazlı güncel plan notlarının nihai rapor öncesinde doğrulanması gerekmektedir [S2]."
              : position === 1
                ? "Proje, İstanbul ili Kadıköy ilçesi Fenerbahçe Mahallesi'nde yer alan 348 ada 12-15 parseller için planlama ve gelişim değerlendirmesini kapsamaktadır."
                : "",
            reviewStatus: position < 2 ? "GENERATED" : "NOT_STARTED",
            confidence: position === 0 ? "Medium" : position === 1 ? "High" : "Low",
            unsupportedClaims: [],
            missingWarnings: position === 0
              ? ["Parsel bazlı güncel plan notları doğrulanmalıdır."]
              : section.missingWarnings,
          })),
        },
        sources: {
          create: [
            {
              id: DEMO_SOURCE_IDS[0],
              title: "Kadıköy Belediyesi - İmar ve Şehircilik",
              url: "https://www.kadikoy.bel.tr/",
              content: "Kadıköy Belediyesi tarafından yayımlanan resmî planlama ve idari bilgiler için örnek kaynak kaydı.",
              isOfficial: true,
              origin: "CONFIGURED",
            },
            {
              id: DEMO_SOURCE_IDS[1],
              title: "T.C. Çevre, Şehircilik ve İklim Değişikliği Bakanlığı",
              url: "https://www.csb.gov.tr/",
              content: "Planlama mevzuatı ve idari çerçeve için örnek resmî bakanlık kaynak kaydı.",
              isOfficial: true,
              origin: "CONFIGURED",
            },
          ],
        },
      },
    });

    await tx.sectionSource.createMany({
      data: [
        { sectionId: "demo-section-1", sourceId: DEMO_SOURCE_IDS[0] },
        { sectionId: "demo-section-1", sourceId: DEMO_SOURCE_IDS[1] },
        { sectionId: "demo-section-5", sourceId: DEMO_SOURCE_IDS[1] },
      ],
    });

    await tx.chatMessage.createMany({
      data: [
        {
          reportId: DEMO_REPORT_ID,
          sectionId: "demo-section-1",
          role: "user",
          content: "Yönetici özetini yalnızca resmî kaynakları kullanarak daha kısa yaz.",
        },
        {
          reportId: DEMO_REPORT_ID,
          sectionId: "demo-section-1",
          role: "assistant",
          content: "Yönetici özeti resmî kaynaklara dayalı ve daha kısa olacak şekilde hazırlandı.",
        },
      ],
    });
  });

  console.log(`Seed completed safely for ${DEMO_USER_ID} / ${DEMO_REPORT_ID}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
