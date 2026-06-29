# g7-dashboard スケジューラ仕様

アプリ全体の仕様は [SPEC.md](./SPEC.md) を参照。

## 概要

| コンポーネント | ホスティング | 役割 |
|----------------|--------------|------|
| **ダッシュボード（Next.js）** | **Vercel** | UI 表示。Vercel KV から `news:latest` を読む |
| **スケジューラ** | **Upstash QStash** | JST 01/07/13/19 に `/api/cron/fetch` を POST |
| **ニュース取得** | **Vercel Serverless** | `lib/fetch-news.ts` — RSS → DeepL → KV |

> g7-dashboard の UI・データ更新とも **Vercel 上**。QStash は Upstash（KV と同アカウント）の cron サービス。

---

## データフロー

```
┌─────────────────────────────────────────────────────────────┐
│  Upstash QStash (JST 01/07/13/19)                           │
│    POST /api/cron/fetch  (署名検証)                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel  app/api/cron/fetch/route.ts                        │
│    lib/fetch-news.ts → RSS (9カ国) → DeepL → KV             │
│    revalidatePath("/")                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │  SET news:latest
                           ▼
                    ┌──────────────┐
                    │  Vercel KV   │
                    └──────┬───────┘
                           │  GET news:latest
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js  app/page.tsx                                      │
│    getNewsData() → Dashboard 表示                             │
│    ISR: revalidate = 21600（フォールバック最大6時間）         │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 定期実行（Upstash QStash）

### スケジュール

**1日4回、JST の 01:00 / 07:00 / 13:00 / 19:00**

QStash cron（JST タイムゾーン指定）:

```
CRON_TZ=Asia/Tokyo 0 1,7,13,19 * * *
```

| 方式 | 状態 | 備考 |
|------|------|------|
| **Upstash QStash** | **本番** | 時刻精度が高い。無料枠で 1日4回は十分 |
| **GitHub Actions** | 手動バックアップ | `workflow_dispatch` のみ（Python `cron/main.py`） |
| **ローカル** | 開発用 | `npm run fetch:snapshot` |

### 初回セットアップ

#### 1. Vercel 環境変数

[Upstash Console → QStash](https://console.upstash.com/qstash) から取得し、Vercel **Production** に設定:

| 変数 | 用途 |
|------|------|
| `DEEPL_API_KEY` | タイトル翻訳 |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | KV 読み書き（Redis 連携で自動設定可） |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash 署名検証 |
| `QSTASH_NEXT_SIGNING_KEY` | QStash 署名検証（ローテーション用） |
| `DISCORD_WEBHOOK_URL` | 任意 — 失敗時 Discord 通知 |

設定後 **Redeploy**。

#### 2. QStash スケジュール登録

デプロイ後、ローカルから 1 回実行:

```bash
# .env.local に QSTASH_TOKEN を追加（QStash Console → QSTASH_TOKEN）
SITE_URL=https://g7-dashboard.vercel.app npm run setup:qstash
```

スクリプト: [`scripts/setup-qstash.mjs`](../scripts/setup-qstash.mjs)

Upstash Console → **QStash → Schedules** に `world-front-page-fetch` が表示されれば OK。

#### 3. 動作確認

QStash Console → Schedules → 対象スケジュール → **Trigger now**  
または数分待って本番の「最終更新」時刻が変わることを確認。

---

## 2. API エンドポイント

### `POST /api/cron/fetch`

- QStash からのみ受け付け（`verifySignatureAppRouter`）
- RSS 取得 → DeepL → KV 書込 → `revalidatePath("/")`
- 失敗時: HTTP 500 + Discord 通知（Webhook 設定時）
- `maxDuration = 300`（9カ国並列取得のため Pro 推奨）

実装: [`app/api/cron/fetch/route.ts`](../app/api/cron/fetch/route.ts)  
ロジック: [`lib/fetch-news.ts`](../lib/fetch-news.ts)

### `POST /api/revalidate`（レガシー）

手動 ISR 破棄用。QStash 経路では `/api/cron/fetch` 内で revalidate するため通常不要。

---

## 3. ローカル開発

**QStash は本番のみ。** ローカルでは手動スナップショット:

```bash
npm run fetch:snapshot   # → data/news-snapshot.json
npm run dev
```

---

## 4. 「最終更新」時刻について

| 環境 | `updatedAt` の意味 |
|------|-------------------|
| 本番 | 直近の **QStash → /api/cron/fetch 成功時刻** |
| ローカル（snapshot） | `fetch:snapshot` 実行時刻 |
| ローカル（mock） | リクエスト毎に現在時刻（非推奨） |

ブラウザのリロード **≠** RSS 再取得。

---

## 5. GitHub Actions（手動バックアップ）

[`.github/workflows/fetch-news.yml`](../.github/workflows/fetch-news.yml) — **`workflow_dispatch` のみ**。

QStash 障害時の予備。Python `cron/main.py` を実行し `/api/revalidate` を呼ぶ。

GitHub Secrets: `DEEPL_API_KEY`, `KV_*`, `REVALIDATE_SECRET`（任意: `DISCORD_WEBHOOK_URL`）

---

## 6. Python cron（レガシー）

[`cron/main.py`](../cron/main.py) — ローカル実行・GHA 手動バックアップ用。  
本番の定期実行は TypeScript（`lib/fetch-news.ts`）に移行済み。

---

## 7. 関連ファイル

| パス | 説明 |
|------|------|
| `scripts/setup-qstash.mjs` | QStash スケジュール登録 |
| `app/api/cron/fetch/route.ts` | QStash ワーカー |
| `lib/fetch-news.ts` | RSS + DeepL + KV |
| `lib/news-sources.ts` | 9カ国ソース定義 |
| `.github/workflows/fetch-news.yml` | 手動バックアップ（Python） |
| `cron/main.py` | Python 版（バックアップ） |

---

## 8. 運用チェックリスト

- [ ] Vercel に `DEEPL_API_KEY`, `KV_*`, `QSTASH_*_SIGNING_KEY` を設定して Redeploy
- [ ] `npm run setup:qstash` でスケジュール登録
- [ ] QStash Console で Trigger now → 本番「最終更新」が変わることを確認
- [ ] （任意）Vercel に `DISCORD_WEBHOOK_URL` を設定
