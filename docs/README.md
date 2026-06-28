# g7-dashboard ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [SPEC.md](./SPEC.md) | アプリ全体の仕様（UI・データ・構成） |
| [SCHEDULER.md](./SCHEDULER.md) | スケジューラ・データ更新・デプロイ |

## クイックスタート

```bash
cp .env.example .env.local   # DEEPL_API_KEY 等を設定
npm install
npm run fetch:snapshot       # ローカル用データ生成（任意）
npm run dev
```

## リポジトリ構成（概要）

```
g7-dashboard/
├── app/           Next.js App Router（ページ・レイアウト）
├── components/    UI コンポーネント
├── lib/           型・KV・ユーティリティ
├── cron/          RSS 取得バッチ（本番データ更新）
├── data/          ローカルスナップショット（gitignore）
└── docs/          仕様書
```
