# g7-dashboard アプリ仕様

## 1. 概要

### 1.1 目的

G7（日・米・英・独・仏・伊・加）7カ国の主要メディアから **Top 5 見出し** を集約し、**日本語 / 英語** で一覧表示するニュースダッシュボード。

- ユーザーが各国の「今」を、自分の言語で素早く把握できる
- 本文はホストせず、**元記事へリンク** して送客する

### 1.2 非機能要件・制約

| 項目 | 方針 |
|------|------|
| 本文 | **保存・表示しない**（タイトルのみ） |
| 取得手段 | **RSS / 公開 API のみ**（スクレイピングなし） |
| 翻訳 | **DeepL API**（タイトルのみ） |
| UI ホスティング | **Vercel**（Next.js） |
| データストア | **Vercel KV**（Upstash Redis） |
| 更新頻度 | 1日4回（[SCHEDULER.md](./SCHEDULER.md) 参照） |

### 1.3 他プロジェクトとの関係

- **trend-dashboard** とは **別リポジトリ・別アプリ**
- g7-dashboard の UI は Vercel。定期 RSS 取得は `cron/` の Python バッチ（別デプロイ）

---

## 2. システム構成

```
[ cron/main.py ]  ──write──▶  Vercel KV (news:latest)
                                    │
                                    │ read
                                    ▼
[ Next.js @ Vercel ]  ──▶  ブラウザ（ダッシュボード UI）
```

| レイヤ | 技術 | 役割 |
|--------|------|------|
| フロント | Next.js 15, React 19, Tailwind CSS | 単一ページダッシュボード |
| テーマ | next-themes | ライト / ダーク |
| データ読取 | `@vercel/kv` | 本番 KV から JSON 取得 |
| データ更新 | Python 3.12, feedparser, DeepL | RSS → 翻訳 → KV 書込 |
| キャッシュ | Next.js ISR | `revalidate = 21600`（6時間） |

スケジューラ・環境変数・ローカル開発の詳細は [SCHEDULER.md](./SCHEDULER.md)。

---

## 3. 画面仕様

### 3.1 ページ構成

**ルート `/` のみ**（シングルページアプリ）。

```
┌─────────────────────────────────────────────────┐
│ Header                                          │
│  G7 logo / タイトル / サブタイトル / 最終更新    │
│  [日本語 | English]  [ダークモード切替]           │
├─────────────────────────────────────────────────┤
│ 各国のトップ5                                    │
├─────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐                         │
│ │ 🇯🇵  │ │ 🇺🇸  │ │ 🇬🇧  │  … 7カ国（3列グリッド）│
│ └─────┘ └─────┘ └─────┘                         │
├─────────────────────────────────────────────────┤
│ Footer: About | Privacy | Source Attribution    │
└─────────────────────────────────────────────────┘
```

### 3.2 Header

| 要素 | 仕様 |
|------|------|
| タイトル | `G7 news dashboard`（固定・英語） |
| サブタイトル | ja: `今日のG7を、あなたの言語で。` / en: `Today's G7, in your language.` |
| 最終更新 | KV / スナップショットの `updatedAt` を JST 表示（言語に応じたフォーマット） |
| 言語切替 | 日本語 / English（クライアント state、URL 変更なし） |
| テーマ切替 | ライト / ダーク（`next-themes`、システム連動なし・明示トグル） |

**初期言語**: デフォルト `ja`。`navigator.language` が `en` 始まりなら `en`。

### 3.3 国別カード（CountryCard）

7カ国分をグリッド表示（デスクトップ 3 列、モバイル 1 列）。

| 要素 | 仕様 |
|------|------|
| 国旗・国名 | 選択言語の `country.name[lang]` |
| メディア名 | `country.source.name`（例: NHK, BBC） |
| 原文バッジ | ja: `原文: 日本語` / en: `Original: Japanese` 等 |
| 見出し | 最大 **5件**。選択言語の `headline.title[lang]` |
| 見出しリンク | タイトル文字 + ↗ アイコン → `headline.url`（新規タブ） |
| 相対時刻 | `publishedAt` から `○分前` / `○時間前` / `○日前` |
| フッターリンク | メディアトップへ（`country.source.url`） |

### 3.4 ローディング

初回マウント前は **7枚のスケルトンカード** を表示（`SkeletonCard`）。Hydration 後に実データへ差し替え。

### 3.5 Footer

About / Privacy / Source Attribution リンクは **プレースホルダ**（`href="#"`）。未実装。

---

## 4. データ仕様

### 4.1 ストレージ

| キー | 形式 | 書込 | 読込 |
|------|------|------|------|
| `news:latest` | JSON (`NewsData`) | `cron/main.py` | `lib/kv.ts` |

### 4.2 型定義（`lib/types.ts`）

```ts
NewsData {
  updatedAt: string      // ISO 8601（UTC）
  countries: CountryNews[]
}

CountryNews {
  code: string           // jp, us, gb, de, fr, it, ca
  flag: string           // 絵文字
  name: { ja, en }
  source: {
    name: string
    url: string          // メディアトップ
    originalLang: { ja, en }
  }
  headlines: Headline[]  // 最大5
}

Headline {
  title: {
    original: string     // RSS 原文
    ja: string
    en: string
  }
  publishedAt: string    // ISO 8601
  url: string            // 記事 URL（RSS link）
}
```

### 4.3 データ取得優先順位（`lib/kv.ts`）

1. **開発** + `data/news-snapshot.json` 存在 → スナップショット
2. **本番** + `KV_*` 設定 → `kv.get("news:latest")`
3. 上記失敗 or 未設定 → `mockData()`（開発用ダミー）

### 4.4 翻訳ルール（cron）

| ソース言語 | `ja` | `en` |
|-----------|------|------|
| JA（日本） | 原文 | DeepL → EN |
| EN（米英独加等） | DeepL → JA | 原文 |
| FR / IT | DeepL → JA | DeepL → EN |

DeepL エンドポイント: `https://api-free.deepl.com/v2/translate`（Developer 無料枠）

### 4.5 ニュースソース（G7）

| code | 国 | メディア | RSS |
|------|-----|---------|-----|
| jp | 日本 | NHK | `https://www3.nhk.or.jp/rss/news/cat0.xml` |
| us | アメリカ | AP News | `https://feeds.apnews.com/rss/apf-topnews` |
| gb | イギリス | BBC | `http://feeds.bbci.co.uk/news/rss.xml` |
| de | ドイツ | Deutsche Welle | `https://rss.dw.com/rdf/rss-en-top` |
| fr | フランス | Le Monde | `https://www.lemonde.fr/rss/une.xml` |
| it | イタリア | ANSA | `https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml` |
| ca | カナダ | CBC | `https://www.cbc.ca/webfeed/rss/rss-topstories` |

定義の正: `cron/main.py` の `SOURCES`。  
ローカル `fetch_local.py` は取得失敗時に代替 RSS を使用（本番 cron とは異なる場合あり）。

---

## 5. 表示ロジック

### 5.1 時刻表示

| 関数 | 用途 |
|------|------|
| `formatUpdatedAt` | 最終更新（JST、曜日付き） |
| `relativeTime` | 各見出しの経過時間 |

いずれも **クライアント / サーバーのローカルタイムゾーン** で `Date` を解釈。JST 表記ラベルは固定。

### 5.2 言語切替

- サーバーから渡された `NewsData` は **日英両方** を含む
- 言語切替は **再 fetch 不要**（クライアントで `title[lang]` を切替）

### 5.3 最終更新の意味

| 環境 | 挙動 |
|------|------|
| 本番 | cron 最終成功時刻 |
| ローカル（snapshot） | `fetch:snapshot` 実行時刻（リロードで変わらない） |
| ローカル（mock） | リクエスト毎に現在時刻（非推奨） |

ブラウザのリロード **≠** RSS 再取得。

---

## 6. 技術スタック

| カテゴリ | 選定 |
|---------|------|
| フレームワーク | Next.js 15（App Router, Turbopack dev） |
| 言語 | TypeScript |
| スタイル | Tailwind CSS 3 + カスタム CSS（`globals.css`） |
| デプロイ（UI） | Vercel |
| DB / キャッシュ | Vercel KV（Upstash Redis REST） |
| バッチ | Python 3.12（`cron/`） |
| 翻訳 | DeepL API |

---

## 7. 環境変数

テンプレート: [`.env.example`](../.env.example)

| 変数 | 必要な場所 | 用途 |
|------|-----------|------|
| `KV_REST_API_URL` | Vercel, cron, ローカル（KV 直読時） | KV REST URL |
| `KV_REST_API_TOKEN` | 同上 | KV 認証 |
| `DEEPL_API_KEY` | cron, `fetch:snapshot` | タイトル翻訳 |

Next.js 本番表示に DeepL は **不要**。

---

## 8. 開発・デプロイ

### 8.1 ローカル

```bash
cp .env.example .env.local
npm install
npm run fetch:snapshot   # 推奨: 本番相当データ
npm run dev              # http://localhost:3000
```

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー（ローカル） |
| `npm run lint` | ESLint |
| `npm run fetch:snapshot` | RSS + 翻訳 → `data/news-snapshot.json` |

### 8.2 本番（UI）

1. GitHub 等から **Vercel** に Next.js プロジェクトを接続
2. Vercel ダッシュボードで KV ストアを作成・連携
3. 環境変数 `KV_REST_API_URL`, `KV_REST_API_TOKEN` を設定
4. デプロイ

### 8.3 本番（データ更新）

cron を 1日4回実行し KV を更新。詳細は [SCHEDULER.md](./SCHEDULER.md)。

---

## 9. ディレクトリ構成

```
g7-dashboard/
├── app/
│   ├── layout.tsx          ルートレイアウト・メタデータ
│   ├── page.tsx            トップページ（Server Component）
│   └── globals.css         グローバルスタイル
├── components/
│   ├── Dashboard.tsx       メインレイアウト（Client）
│   ├── Header.tsx          ヘッダー
│   ├── CountryCard.tsx     国別カード
│   ├── SkeletonCard.tsx    ローディング
│   └── ThemeProvider.tsx   テーマプロバイダ
├── lib/
│   ├── types.ts            型定義
│   ├── kv.ts               データ取得
│   ├── mock-data.ts        開発用モック
│   └── utils.ts            時刻フォーマット
├── cron/
│   ├── main.py             本番バッチ
│   ├── fetch_local.py      ローカルスナップショット
│   ├── crontab             スケジュール定義
│   ├── Dockerfile          cron ワーカー用
│   └── fly.toml            Fly.io デプロイ設定（任意）
├── data/
│   └── news-snapshot.json  ローカル用（gitignore）
└── docs/
    ├── README.md           ドキュメント索引
    ├── SPEC.md             本ファイル
    └── SCHEDULER.md        スケジューラ仕様
```

---

## 10. 未実装・既知の制限

| 項目 | 状態 |
|------|------|
| Footer 各ページ | リンクのみ（`#`） |
| Vercel Cron によるバッチ | 未実装（`cron/fly.toml` 等で代替可能） |
| ユーザー認証 | なし |
| 記事本文表示 | 意図的に非対応 |
| 国フィルタ / 検索 | なし（全 G7 固定表示） |
| G7 以外の国 | 非対応 |
| `updatedAt` の厳密 TZ | ラベルは JST だが `Date` は実行環境 TZ 依存 |

---

## 11. メタデータ

| 項目 | 値 |
|------|-----|
| `title` | G7 news dashboard |
| `description` | 今日のG7を、あなたの言語で。See what the world is reading. |
| `html lang` | `ja`（固定） |
| OGP | title / description / type=website |

定義: `app/layout.tsx`
