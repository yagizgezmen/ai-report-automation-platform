export const DEFAULT_REPORT_TEMPLATES = [
  {
    name: "İmar Planı Açıklama Raporu",
    description: "Planlama kararlarını, kurum görüşlerini ve alan analizlerini bir araya getiren resmî açıklama raporu şablonu.",
    sections: [
      { title: "Giriş", description: "Raporun amacı, kapsamı ve dayandığı temel proje bilgileri." },
      { title: "Planlama Alanının Konumu", description: "Alan sınırları, çevresel ilişkiler ve temel konum bilgileri." },
      { title: "Bölgesel Analiz", description: "Bölgesel gelişim, nüfus, yapılaşma ve üst ölçek bağlamın özeti." },
      { title: "Ulaşım", description: "Karayolu, toplu taşıma ve erişilebilirlik değerlendirmesi." },
      { title: "Kurum Görüşleri", description: "İlgili kamu kurumları ve altyapı birimlerinden gelen görüşlerin özeti." },
      { title: "Sonuç", description: "Bulguların değerlendirilmesi ve planlama açısından genel sonuç bölümü." },
    ],
    sources: [
      { name: "Mersin Valiliği", url: "https://www.mersin.gov.tr", description: "İl düzeyindeki resmî duyurular ve yönetim bilgileri." },
      { name: "TÜİK", url: "https://www.tuik.gov.tr", description: "Nüfus, demografi ve istatistik kaynakları." },
      { name: "Resmî Gazete", url: "https://www.resmigazete.gov.tr", description: "Mevzuat ve yayımlanmış idarî kararlar." },
    ],
  },
  {
    name: "Fizibilite Raporu",
    description: "Yatırım, pazar, operasyon ve finansal yapılabilirlik analizi için temel şablon.",
    sections: [
      { title: "Yönetici Özeti", description: "Çalışmanın kapsamı, ana varsayımlar ve öne çıkan sonuçların özeti." },
      { title: "Proje Tanımı", description: "Projenin amacı, kapsamı, hedef kullanıcıları ve temel bileşenleri." },
      { title: "Pazar Analizi", description: "Talep, rekabet, hedef segmentler ve makro pazar görünümü." },
      { title: "Teknik Yapılabilirlik", description: "Teknik gereksinimler, saha koşulları ve operasyonel ihtiyaçlar." },
      { title: "Finansal Değerlendirme", description: "Maliyet, gelir, yatırım ihtiyacı ve temel finansal varsayımlar." },
      { title: "Sonuç ve Öneriler", description: "Uygulanabilirlik sonucu ve önerilen aksiyonlar." },
    ],
    sources: [
      { name: "TÜİK", url: "https://www.tuik.gov.tr", description: "Makro veri ve sektör göstergeleri." },
      { name: "Sanayi ve Teknoloji Bakanlığı", url: "https://www.sanayi.gov.tr", description: "Sektörel politika ve yatırım bilgileri." },
    ],
  },
  {
    name: "Pazar Araştırması Raporu",
    description: "Hedef pazar, müşteri davranışı ve rekabet görünümünü özetleyen araştırma şablonu.",
    sections: [
      { title: "Araştırma Kapsamı", description: "Raporun amacı, hedef pazarı ve değerlendirme yaklaşımı." },
      { title: "Pazar Büyüklüğü", description: "Toplam pazar, alt segmentler ve büyüme dinamikleri." },
      { title: "Müşteri Profili", description: "Hedef kitlenin ihtiyaçları, davranışları ve tercihleri." },
      { title: "Rekabet Analizi", description: "Rakipler, konumlanma ve ayırt edici pazar unsurları." },
      { title: "Fırsatlar ve Riskler", description: "Pazar giriş fırsatları ile temel risk unsurları." },
      { title: "Sonuç", description: "Araştırmadan çıkan genel değerlendirme ve öneriler." },
    ],
    sources: [
      { name: "TÜİK", url: "https://www.tuik.gov.tr", description: "İstatistiksel pazar ve nüfus verileri." },
      { name: "Ticaret Bakanlığı", url: "https://www.trade.gov.tr", description: "Ticaret ve sektör raporu kaynakları." },
    ],
  },
  {
    name: "Teknik Değerlendirme Raporu",
    description: "Teknik uygunluk, riskler ve uygulama gereksinimleri için yapılandırılmış rapor şablonu.",
    sections: [
      { title: "Amaç ve Kapsam", description: "Teknik incelemenin kapsamı ve temel değerlendirme kriterleri." },
      { title: "Mevcut Durum", description: "Saha, yapı, sistem veya proje bileşenlerinin mevcut durumu." },
      { title: "Teknik Bulgular", description: "Tespit edilen teknik gözlemler ve ölçülebilir bulgular." },
      { title: "Uygunluk Analizi", description: "Standartlara, şartnamelere veya mevzuata uygunluk değerlendirmesi." },
      { title: "Riskler", description: "Teknik riskler, kısıtlar ve kritik dikkat noktaları." },
      { title: "Sonuç ve Öneriler", description: "Teknik değerlendirme sonucu ve önerilen iyileştirmeler." },
    ],
    sources: [
      { name: "Resmî Gazete", url: "https://www.resmigazete.gov.tr", description: "Güncel mevzuat ve düzenlemeler." },
      { name: "Çevre, Şehircilik ve İklim Değişikliği Bakanlığı", url: "https://www.csb.gov.tr", description: "Teknik ve idarî standartlara dair kaynaklar." },
    ],
  },
] as const;
