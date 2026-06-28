# g7-dashboard スケジューラ仕様

アプリ全体の仕様は [SPEC.md](./SPEC.md) を参照。

## 概要

g7-dashboard は **2つのプロセス** に分かれている。

| コンポーネント | ホスティング | 役割 |
|----------------|--------------|------|
| **ダッシュボード（Next.js）** | **Vercel** | UI 表示。Vercel KV から `news:latest` を読む |
| **ニュース取得ジョブ（Python）** | **別途デプロイ**（下記） | RSS 取得 → DeepL 翻訳 → KV 書き込み |

> **注意**: 本リポジトリは **trend-dashboard とは別プロジェクト**。  
> trend-dashboard は Fly.io 上でアプリ本体＋スケジューラが一体。  
> g7-dashboard の **UI は Vercel** で、`cron/` はデータ更新用のバッチのみ。

---

## データフロー

```
┌─────────────────────────────────────────────────────────────┐
│  cron/main.py  （1日4回・手動 or 外部スケジューラ）           │
│    RSS (7カ国) → DeepL 翻訳 → Vercel KV                     │
└──────────────────────────┬──────────────────────────────────┘
                           │  SET news:latest
                           ▼
                    ┌──────────────┐
                    │  Vercel KV   │
                    └──────┬───────┘
                           │  GET news:latest
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js (Vercel)  app/page.tsx                             │
│    getNewsData() → Dashboard 表示                             │
│    ISR: revalidate = 21600（最大6時間キャッシュ）            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. ニュース取得ジョブ（`cron/main.py`）

### 実行内容

1. G7 7カ国分の RSS から Top 5 見出しを取得
2. DeepL API でタイトルを日英（必要に応じて他言語）に翻訳
3. JSON を Vercel KV のキー **`news:latest`** に保存

### 実行スケジュール（本番想定）

**1日4回、JST の 01:00 / 07:00 / 13:00 / 19:00**

| JST | UTC (crontab) |
|-----|---------------|
| 01:00 | 16:00 |
| 07:00 | 22:00 |
| 13:00 | 04:00 |
| 19:00 | 10:00 |

crontab 定義: [`cron/crontab`](../cron/crontab)

```
0 16 * * *  … main.py
0 22 * * *  … main.py
0  4 * * *  … main.py
0 10 * * *  … main.py
```

### ホスティング（cron ワーカー）

**現状、Vercel 上にはスケジューラはない。** ジョブ本体は `cron/` にあり、定期実行は **別インフラで crontab 相当を回す** 前提。

| 方式 | 状態 | 備考 |
|------|------|------|
| **Fly.io（`cron/fly.toml`）** | 設定ファイルあり・**未デプロイなら未稼働** | Docker + システム cron で `main.py` を常時スケジュール。`fly deploy` は `cron/` ディレクトリから |
| **Vercel Cron** | **未実装** | API Route + `vercel.json` で代替可能 |
| **GitHub Actions** | **未実装** | `schedule:` で `main.py` を実行可能 |
| **手動** | ローカル / CI から実行 | 本番 KV へ書き込む場合は env 要 |

Fly.io 用ファイル（**ダッシュボード本体ではなく cron 専用**）:

- [`cron/fly.toml`](../cron/fly.toml) — アプリ名 `g7-news-cron`、リージョン `nrt`
- [`cron/Dockerfile`](../cron/Dockerfile) — Python 3.12 + cron
- [`cron/crontab`](../cron/crontab) — 上記4スケジュール

Fly デプロイ時の secrets 例:

```bash
cd cron
fly secrets set DEEPL_API_KEY=... KV_REST_API_URL=... KV_REST_API_TOKEN=...
fly deploy
```

### 必要な環境変数（本番ジョブ）

| 変数 | 用途 |
|------|------|
| `DEEPL_API_KEY` | タイトル翻訳（DeepL API Free: `api-free.deepl.com`） |
| `KV_REST_API_URL` | Vercel KV / Upstash REST URL |
| `KV_REST_API_TOKEN` | KV 認証トークン |

---

## 2. ダッシュボード（Vercel / Next.js）

### データ読み取り

[`lib/kv.ts`](../lib/kv.ts) の優先順位:

1. **開発** — `data/news-snapshot.json` が存在すればそれを使用（スケジューラ不要）
2. **本番** — Vercel KV の `news:latest`
3. **フォールバック** — KV 未設定 / 取得失敗時は `mockData()`

### ページキャッシュ（ISR）

[`app/page.tsx`](../app/page.tsx):

```ts
export const revalidate = 21600; // 秒 = 6時間
```

- cron が KV を更新しても、**ページは最長6時間** 古いキャッシュのまま表示されうる
- 6時間は「1日4回更新」と概ね整合する値（厳密同期ではない）

### Vercel 側の環境変数

ダッシュボード表示に必要:

| 変数 | 用途 |
|------|------|
| `KV_REST_API_URL` | KV 読み取り |
| `KV_REST_API_TOKEN` | KV 読み取り |

`DEEPL_API_KEY` は **Next.js では使わない**（cron / ローカル snapshot のみ）。

---

## 3. ローカル開発

**自動スケジューラは動かない。** 手動でスナップショットを生成する。

```bash
# .env.local に DEEPL_API_KEY を設定（推奨）
npm run fetch:snapshot   # → data/news-snapshot.json
npm run dev
```

- 実装: [`cron/fetch_local.py`](../cron/fetch_local.py)
- RSS フォールバック・MyMemory 翻訳（DeepL 未設定時）あり
- `news-snapshot.json` は `.gitignore` 対象

---

## 4. 「最終更新」時刻について

| 環境 | `updatedAt` の意味 |
|------|-------------------|
| 本番 | 直近の **cron 成功時刻**（KV に書き込んだ時刻） |
| ローカル（snapshot） | **`fetch:snapshot` 実行時刻**（リロードでは変わらない） |
| ローカル（mock） | **リクエストのたびに現在時刻**（未使用推奨） |

ブラウザのリロード **≠** RSS / API の再取得。更新は cron（または手動 snapshot）のみ。

---

## 5. 関連ファイル一覧

| パス | 説明 |
|------|------|
| `cron/main.py` | 本番用バッチ（RSS → DeepL → KV） |
| `cron/fetch_local.py` | ローカル用ワンショット取得 |
| `cron/crontab` | 1日4回の cron 定義 |
| `cron/fly.toml` | Fly.io への cron ワーカーデプロイ設定（任意） |
| `app/page.tsx` | ISR `revalidate` |
| `lib/kv.ts` | データ取得ロジック |
| `.env.example` | 環境変数テンプレート |

---

## 6. 運用チェックリスト

- [ ] Vercel に Next.js をデプロイ、`KV_*` を設定
- [ ] Vercel KV（Upstash）ストアを作成
- [ ] cron を **いずれかの方法** で 1日4回実行（Fly deploy / 未実装の Vercel Cron 等）
- [ ] cron 側に `DEEPL_API_KEY` + `KV_*` を設定
- [ ] 初回: 手動で `cron/main.py` を1回実行し KV にデータがあることを確認

cron を一度も動かしていない場合、本番 UI は **mock 相当の空データ or 古い KV** になる。
