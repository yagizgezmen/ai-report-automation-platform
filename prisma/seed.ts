import { PrismaClient } from "@prisma/client";
import { DEFAULT_REPORT_TEMPLATES } from "../src/lib/report-types";
import { createTemplateSections } from "../src/lib/templates";

const prisma = new PrismaClient();

const DEMO_USER_ID = "demo-user";
const DEMO_REPORT_ID = "demo-report";
const DEMO_SOURCE_IDS = ["demo-source-municipality", "demo-source-ministry"];

async function main() {
  const template = DEFAULT_REPORT_TEMPLATES[0];
  const sections = createTemplateSections(template.sections.map((section, index) => ({
    id: `seed-section-${index + 1}`,
    title: section.title,
    description: section.description,
    sortOrder: index,
  })));

  await prisma.$transaction(async (tx) => {
    await tx.reportTypeSection.deleteMany();
    await tx.reportTypeSource.deleteMany();
    await tx.reportType.deleteMany();

    const createdTypes = [];
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
            })),
          },
          sources: {
            create: item.sources.map((source) => ({
              name: source.name,
              url: source.url,
              description: source.description,
            })),
          },
        },
      }));
    }
    const primaryReportType = createdTypes[0];

    const demoUser = await tx.user.upsert({
      where: { email: "demo@arqive.ai" },
      update: { name: "Ayşe Yılmaz" },
      create: {
        id: DEMO_USER_ID,
        email: "demo@arqive.ai",
        name: "Ayşe Yılmaz",
      },
    });

    await tx.report.deleteMany({ where: { id: DEMO_REPORT_ID } });

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

  console.log(`Seed completed: ${DEMO_USER_ID}, ${DEMO_REPORT_ID}, ${sections.length} sections.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
