export const adminTr = {
  shell: {
    eyebrow: "Zeylora yönetim paneli"
  },
  nav: {
    overview: "Genel Bakış",
    users: "Kullanıcılar",
    tools: "AI Araçları",
    jobs: "İşlemler",
    credits: "Krediler",
    pricing: "Fiyatlama",
    payments: "Ödemeler",
    cms: "İçerik",
    providers: "Sağlayıcılar",
    featureFlags: "Özellikler",
    analytics: "Analizler",
    settings: "Ayarlar",
    logs: "Kayıtlar"
  },
  overview: {
    title: "Zeylora yönetim temeli",
    description:
      "Araçlar, kullanıcılar, ödemeler, krediler, sağlayıcılar, içerikler, analizler, kayıtlar, özellikler ve bakım modu için sade kontrol merkezi.",
    modules: {
      users: {
        title: "Kullanıcılar",
        description: "Hesapları, kredi bakiyelerini, durumları ve ileride eklenecek güvenlik kontrollerini yönetin."
      },
      tools: {
        title: "AI Araçları",
        description: "Araç durumunu, kredi maliyetini, sağlayıcı ayarlarını, fallback ve versiyonları yönetin."
      },
      payments: {
        title: "Ödemeler",
        description: "Stripe ödemelerini, iadeleri, kredi teslimini ve webhook kayıtlarını takip edin."
      },
      featureFlags: {
        title: "Özellikler",
        description: "Özellikleri, paketleri, dilleri ve deneyleri güvenli şekilde açıp kapatın."
      },
      providerBudgets: {
        title: "Sağlayıcı Bütçeleri",
        description: "Aylık maliyetleri izleyin ve sağlayıcı limitlerini kontrol altında tutun."
      },
      usageAnalytics: {
        title: "Kullanım Analizi",
        description: "İşlem sayısı, gelir, hata oranı, kredi kullanımı ve depolama durumunu görün."
      },
      cms: {
        title: "İçerik",
        description: "Blog yazılarını, yasal sayfaları, SEO alanlarını ve yayın durumunu yönetin."
      },
      errorLogs: {
        title: "Hata Kayıtları",
        description: "Sağlayıcı hatalarını, webhook problemlerini ve sistem kayıtlarını inceleyin."
      }
    },
    priorityTitle: "Yönetim paneli önceliği",
    priorityDescription:
      "Bu panel bilinçli olarak geniş bir temel sunar. Tam yönetim ekranları, çekirdek mimari netleştikçe modül modül eklenecek."
  }
} as const;
