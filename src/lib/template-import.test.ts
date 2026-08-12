import { describe, expect, it } from "vitest";
import { extractTemplateSectionsFromText } from "@/lib/template-import";

describe("extractTemplateSectionsFromText", () => {
  it("extracts numbered headings and subheadings as ordered sections", () => {
    const sections = extractTemplateSectionsFromText(`
1. Giris

Bu raporun amaci ve kapsami burada anlatilir.

1.1 Amac

Amac bolumu aciklamasi.

1.2 Kapsam

Kapsam bolumu aciklamasi.

2. Analiz

Analiz bulgulari burada yer alir.
`);

    expect(sections.map((section) => section.title)).toEqual([
      "1. Giris",
      "1.1 Amac",
      "1.2 Kapsam",
      "2. Analiz",
    ]);
    expect(sections[1].description).toContain("Amac bolumu aciklamasi");
    expect(sections.every((section) => section.aiPrompt === "")).toBe(true);
  });

  it("falls back to a single generic section when no headings are found", () => {
    const sections = extractTemplateSectionsFromText("Bu dokuman tek parca metinden olusuyor ve ayri baslik icermiyor.");

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Genel Bölüm");
  });

  it("does not treat regular paragraph lines as headings", () => {
    const sections = extractTemplateSectionsFromText(`
Bu raporun amacı ve kapsamı aşağıda açıklanmaktadır
ve uygulama esasları takip eden satırlarda devam etmektedir.

Sonraki paragraf normal akışla sürer.
`);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Genel Bölüm");
  });

  it("prefers table of contents entries when an icindekiler section exists", () => {
    const sections = extractTemplateSectionsFromText(`
İçindekiler
1. Giriş ........ 1
1.1 Amaç ........ 2
2. BULGULAR ..... 5

1. Giriş
Bu içerik kısmı daha sonra geliyor.
`);

    expect(sections.map((section) => section.title)).toEqual([
      "1. Giriş",
      "1.1 Amaç",
      "2. BULGULAR",
    ]);
  });

  it("detects fully uppercase headings from the body", () => {
    const sections = extractTemplateSectionsFromText(`
GENEL ESASLAR
Bu bölüm genel esasları açıklar.

ALT BÖLÜM
Bu bölüm alt detayları açıklar.
`);

    expect(sections.map((section) => section.title)).toEqual([
      "GENEL ESASLAR",
      "ALT BÖLÜM",
    ]);
  });
});