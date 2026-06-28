import { NewsData } from "./types";

/** Generates mock data with timestamps relative to now for realistic relative-time display. */
export function mockData(): NewsData {
  const now = Date.now();
  const ago = (min: number) => new Date(now - min * 60 * 1000).toISOString();

  return {
    updatedAt: new Date(now).toISOString(),
    countries: [
      {
        code: "jp",
        flag: "🇯🇵",
        name: { ja: "日本", en: "Japan" },
        source: { name: "NHK", url: "https://www3.nhk.or.jp", originalLang: { ja: "日本語", en: "Japanese" } },
        headlines: [
          { title: { original: "政府、物価高対策として新たな支援策を検討", ja: "政府、物価高対策として新たな支援策を検討", en: "Government considers new support measures for rising prices" }, publishedAt: ago(12), url: "https://www3.nhk.or.jp" },
          { title: { original: "大雨の影響で西日本の交通機関に乱れ", ja: "大雨の影響で西日本の交通機関に乱れ", en: "Heavy rain disrupts transport across western Japan" }, publishedAt: ago(28), url: "https://www3.nhk.or.jp" },
          { title: { original: "日銀、金融政策をめぐり慎重な姿勢を維持", ja: "日銀、金融政策をめぐり慎重な姿勢を維持", en: "Bank of Japan maintains cautious stance on monetary policy" }, publishedAt: ago(60), url: "https://www3.nhk.or.jp" },
          { title: { original: "生成AI活用をめぐる企業の新方針が相次ぐ", ja: "生成AI活用をめぐる企業の新方針が相次ぐ", en: "Companies announce new policies for generative AI use" }, publishedAt: ago(120), url: "https://www3.nhk.or.jp" },
          { title: { original: "各地で猛暑日、熱中症への警戒呼びかけ", ja: "各地で猛暑日、熱中症への警戒呼びかけ", en: "Heatstroke warnings issued as extreme heat spreads" }, publishedAt: ago(240), url: "https://www3.nhk.or.jp" },
        ],
      },
      {
        code: "us",
        flag: "🇺🇸",
        name: { ja: "アメリカ", en: "United States" },
        source: { name: "CNN", url: "https://edition.cnn.com", originalLang: { ja: "英語", en: "English" } },
        headlines: [
          { title: { original: "Congress continues bipartisan talks over AI regulation", ja: "米議会、AI規制法案をめぐり超党派協議を継続", en: "Congress continues bipartisan talks over AI regulation" }, publishedAt: ago(8), url: "https://edition.cnn.com" },
          { title: { original: "Inflation cools slightly in May, data shows", ja: "5月の物価上昇率、予想をわずかに下回る", en: "Inflation cools slightly in May, data shows" }, publishedAt: ago(35), url: "https://edition.cnn.com" },
          { title: { original: "Major tech firms expand data center investment", ja: "大手テック企業、データセンター投資を拡大", en: "Major tech firms expand data center investment" }, publishedAt: ago(72), url: "https://edition.cnn.com" },
          { title: { original: "Severe storms damage parts of the Central US", ja: "中部地域を襲った激しい嵐で被害広がる", en: "Severe storms damage parts of the Central US" }, publishedAt: ago(130), url: "https://edition.cnn.com" },
          { title: { original: "Markets turn cautious ahead of jobs data", ja: "雇用統計を前に市場は慎重な値動き", en: "Markets turn cautious ahead of jobs data" }, publishedAt: ago(250), url: "https://edition.cnn.com" },
        ],
      },
      {
        code: "gb",
        flag: "🇬🇧",
        name: { ja: "イギリス", en: "United Kingdom" },
        source: { name: "BBC", url: "https://www.bbc.com", originalLang: { ja: "英語", en: "English" } },
        headlines: [
          { title: { original: "UK inflation falls to lowest level in nearly three years", ja: "英国のインフレ率、約3年ぶりの低水準に", en: "UK inflation falls to lowest level in nearly three years" }, publishedAt: ago(15), url: "https://www.bbc.com" },
          { title: { original: "Prime minister rules out early election", ja: "首相、早期総選挙の可能性を否定", en: "Prime minister rules out early election" }, publishedAt: ago(40), url: "https://www.bbc.com" },
          { title: { original: "New train strike dates announced", ja: "鉄道ストライキの新日程が発表される", en: "New train strike dates announced" }, publishedAt: ago(90), url: "https://www.bbc.com" },
          { title: { original: "NHS waiting times show signs of improvement", ja: "NHSの待機時間、改善の兆しを示す", en: "NHS waiting times show signs of improvement" }, publishedAt: ago(150), url: "https://www.bbc.com" },
          { title: { original: "England beat Australia in thriller", ja: "イングランド代表、接戦でオーストラリアに勝利", en: "England beat Australia in thriller" }, publishedAt: ago(260), url: "https://www.bbc.com" },
        ],
      },
      {
        code: "de",
        flag: "🇩🇪",
        name: { ja: "ドイツ", en: "Germany" },
        source: { name: "Deutsche Welle", url: "https://www.dw.com", originalLang: { ja: "英語", en: "English" } },
        headlines: [
          { title: { original: "German economy expected to see modest growth", ja: "ドイツ経済、2024年は小幅成長へ", en: "German economy expected to see modest growth" }, publishedAt: ago(20), url: "https://www.dw.com" },
          { title: { original: "EU agrees on further sanctions over Ukraine support", ja: "ウクライナ支援、EUが追加制裁で合意", en: "EU agrees on further sanctions over Ukraine support" }, publishedAt: ago(45), url: "https://www.dw.com" },
          { title: { original: "Renewable energy generation reaches record high", ja: "再生可能エネルギーの発電量が過去最高に", en: "Renewable energy generation reaches record high" }, publishedAt: ago(95), url: "https://www.dw.com" },
          { title: { original: "Concerns grow over prolonged rail strikes", ja: "長期化する鉄道ストライキに懸念広がる", en: "Concerns grow over prolonged rail strikes" }, publishedAt: ago(160), url: "https://www.dw.com" },
          { title: { original: "EU and China seek to ease trade tensions", ja: "EUと中国、貿易摩擦の緩和を目指す", en: "EU and China seek to ease trade tensions" }, publishedAt: ago(280), url: "https://www.dw.com" },
        ],
      },
      {
        code: "fr",
        flag: "🇫🇷",
        name: { ja: "フランス", en: "France" },
        source: { name: "Le Monde", url: "https://www.lemonde.fr", originalLang: { ja: "フランス語", en: "French" } },
        headlines: [
          { title: { original: "Les partis lancent leurs campagnes pour les législatives", ja: "議会選挙に向け、各党が選挙戦を本格化", en: "Parties launch campaigns ahead of legislative elections" }, publishedAt: ago(18), url: "https://www.lemonde.fr" },
          { title: { original: "L'inflation recule légèrement en mai", ja: "5月のインフレ率、わずかに低下", en: "Inflation eases slightly in May" }, publishedAt: ago(42), url: "https://www.lemonde.fr" },
          { title: { original: "Macron en visite officielle au Canada", ja: "マクロン大統領、カナダを公式訪問", en: "President Macron makes official visit to Canada" }, publishedAt: ago(100), url: "https://www.lemonde.fr" },
          { title: { original: "La qualité de l'eau de la Seine scrutée avant les JO", ja: "パリ五輪に向け、セーヌ川の水質に注目", en: "Seine water quality under scrutiny ahead of Paris Olympics" }, publishedAt: ago(170), url: "https://www.lemonde.fr" },
          { title: { original: "Les grèves SNCF continuent de perturber les transports", ja: "SNCFのストライキ、交通への影響続く", en: "SNCF strikes continue to affect transport" }, publishedAt: ago(290), url: "https://www.lemonde.fr" },
        ],
      },
      {
        code: "it",
        flag: "🇮🇹",
        name: { ja: "イタリア", en: "Italy" },
        source: { name: "ANSA", url: "https://www.ansa.it", originalLang: { ja: "イタリア語", en: "Italian" } },
        headlines: [
          { title: { original: "L'inflazione sale dello 0,6% a maggio", ja: "5月のインフレ率、前月比0.6％上昇", en: "Inflation rises 0.6% in May" }, publishedAt: ago(22), url: "https://www.ansa.it" },
          { title: { original: "Il premier sottolinea il ruolo dell'Italia in Europa", ja: "首相、欧州におけるイタリアの役割を強調", en: "Prime minister highlights Italy's role in Europe" }, publishedAt: ago(50), url: "https://www.ansa.it" },
          { title: { original: "Alluvioni in Emilia-Romagna, danni e vittime", ja: "エミリア・ロマーニャ州の洪水で被害、死者も", en: "Floods in Emilia-Romagna cause damage and casualties" }, publishedAt: ago(105), url: "https://www.ansa.it" },
          { title: { original: "Fiat presenta il nuovo modello elettrico", ja: "フィアット、新型電気自動車を発表", en: "Fiat unveils new electric vehicle model" }, publishedAt: ago(180), url: "https://www.ansa.it" },
          { title: { original: "Europei: confermati gli avversari dell'Italia", ja: "サッカー欧州選手権、イタリアの対戦相手が決定", en: "Italy's Euro opponents confirmed" }, publishedAt: ago(300), url: "https://www.ansa.it" },
        ],
      },
      {
        code: "ca",
        flag: "🇨🇦",
        name: { ja: "カナダ", en: "Canada" },
        source: { name: "CBC", url: "https://www.cbc.ca", originalLang: { ja: "英語", en: "English" } },
        headlines: [
          { title: { original: "Canada to ease student visa rules", ja: "カナダ、学生ビザ規則の緩和を検討", en: "Canada to ease student visa rules" }, publishedAt: ago(10), url: "https://www.cbc.ca" },
          { title: { original: "Bank of Canada holds interest rate", ja: "カナダ銀行、政策金利を据え置き", en: "Bank of Canada holds interest rate" }, publishedAt: ago(30), url: "https://www.cbc.ca" },
          { title: { original: "Wildfires force thousands to evacuate in Alberta", ja: "アルバータ州の山火事で数千人が避難", en: "Wildfires force thousands to evacuate in Alberta" }, publishedAt: ago(80), url: "https://www.cbc.ca" },
          { title: { original: "New housing plan aims to boost supply", ja: "新たな住宅供給計画で価格高騰に対応へ", en: "New housing plan aims to boost supply" }, publishedAt: ago(140), url: "https://www.cbc.ca" },
          { title: { original: "Canada's jobs report surprises economists", ja: "雇用統計、専門家の予想を上回る結果に", en: "Canada's jobs report surprises economists" }, publishedAt: ago(270), url: "https://www.cbc.ca" },
        ],
      },
    ],
  };
}
