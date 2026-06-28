# g7-dashboard スケジューラ仕様

アプリ全体の仕様は [SPEC.md](./SPEC.md) を参照。

## 概要

g7-dashboard は **2つのプロセス** に分かれている。

| コンポーネント | ホスティング | 役割 |
|----------------|--------------|------|
| **ダッシュボード（Next.js）** | **Vercel** | UI 表示。Vercel KV から `news:latest` を読む |
| **ニュース取得ジョブ（Python）** | **別途デプロイ**（下記） | RSS 取得 → DeepL 翻訳 → KV 書き込み |

> **注意**: 本リポジトリは **trend-dashboard とは別プロジェクト**。  
> g7-dashboard の **UI は Vercel**、`cron/` はデータ更新用の Python バッチのみ。

---

## データフロー

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions (1日4回 + workflow_dispatch)                 │
│    cron/main.py → RSS (9カ国) → DeepL → Vercel KV           │
│    成功時 → POST /api/revalidate                             │
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
│    ISR: revalidate = 21600（フォールバック最大6時間）         │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. ニュース取得ジョブ（`cron/main.py`）

### 実行内容

1. G7 + 主要経済国（計9カ国）の RSS から Top 5 見出しを取得
2. DeepL API でタイトルを日英（必要に応じて他言語）に翻訳
3. JSON を Vercel KV のキー **`news:latest`** に保存

### 実行スケジュール（本番想定）

**1日4回、JST の 01:00 / 07:00 / 13:00 / 19:00**

| JST | UTC |
|-----|-----|
| 01:00 | 16:00 |
| 07:00 | 22:00 |
| 13:00 | 04:00 |
| 19:00 | 10:00 |

```
0 16 * * *  … main.py   # 01:00 JST
0 22 * * *  … main.py   # 07:00 JST
0  4 * * *  … main.py   # 13:00 JST
0 10 * * *  … main.py   # 19:00 JST
```

### 定期実行（GitHub Actions）

[`.github/workflows/fetch-news.yml`](../.github/workflows/fetch-news.yml) で **1日4回 + 手動実行** を実行する。

| 方式 | 状態 | 備考 |
|------|------|------|
| **GitHub Actions** | **実装済** | `schedule:` + `workflow_dispatch` |
| **手動（ローカル）** | 利用可 | `cd cron && python3 main.py`（`.env.local` の env 使用） |
| **Vercel Cron** | 未採用 | Python バッチには向かない |

#### GitHub Secrets（Repository → Settings → Secrets and variables → Actions）

| Secret | 必須 | 用途 |
|--------|------|------|
| `DEEPL_API_KEY` | ✅ | タイトル翻訳 |
| `KV_REST_API_URL` | ✅ | KV REST URL |
| `KV_REST_API_TOKEN` | ✅ | KV 認証 |
| `REVALIDATE_SECRET` | ✅ | cron 成功後の ISR 破棄（Vercel と同じ値） |
| `SITE_URL` | 任意 | 本番 URL（未設定時 `https://g7-dashboard.vercel.app`） |
| `DISCORD_WEBHOOK_URL` | 任意 | 失敗時 Discord 通知 |
| `SLACK_WEBHOOK_URL` | 任意 | 失敗時 Slack 通知 |

#### 手動実行

GitHub → **Actions** → **Fetch news** → **Run workflow**

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

### ページキャッシュ（ISR + On-Demand Revalidation）

[`app/page.tsx`](../app/page.tsx):

```ts
export const revalidate = 21600; // 秒 = 6時間
```

- cron 成功後、GitHub Actions が [`app/api/revalidate/route.ts`](../app/api/revalidate/route.ts) を POST し **即時キャッシュ破棄**
- revalidate API が失敗した場合のみ、**最大6時間** 古いキャッシュが残りうる

### Vercel 側の環境変数

| 変数 | 用途 |
|------|------|
| `KV_REST_API_URL` | KV 読み取り |
| `KV_REST_API_TOKEN` | KV 読み取り |
| `REVALIDATE_SECRET` | `/api/revalidate` 認証（GitHub Actions と同じ値） |

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
| `.github/workflows/fetch-news.yml` | 定期 cron + revalidate + 失敗通知 |
| `app/api/revalidate/route.ts` | On-Demand ISR |
| `cron/main.py` | 本番用バッチ（RSS → DeepL → KV） |
| `cron/fetch_local.py` | ローカル用ワンショット取得 |
| `cron/requirements.txt` | Python 依存 |
| `app/page.tsx` | ISR `revalidate` |
| `lib/kv.ts` | データ取得ロジック |
| `.env.example` | 環境変数テンプレート |

---

## 6. 運用チェックリスト

- [ ] Vercel に Next.js をデプロイ、`KV_*` + `REVALIDATE_SECRET` を設定
- [ ] Vercel KV（Upstash）ストアを作成
- [ ] GitHub Secrets に `DEEPL_API_KEY`, `KV_*`, `REVALIDATE_SECRET` を設定
- [ ] （任意）`DISCORD_WEBHOOK_URL` / `SLACK_WEBHOOK_URL` を設定
- [ ] Actions → **Fetch news** → **Run workflow** で初回実行し KV にデータがあることを確認

cron を一度も動かしていない場合、本番 UI は **mock 相当の空データ or 古い KV** になる。
